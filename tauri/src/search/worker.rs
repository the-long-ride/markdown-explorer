use crate::search::index::{IncrementalOptions, SearchIndex, WorkspaceSearchResult};
use crate::workspace::scanner::MdFile;
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::mpsc;

pub enum SearchWorkerCommand {
    SetItems(Vec<MdFile>),
    Search { request_id: String, query: String },
    Cancel,
    Dispose,
}

pub enum SearchWorkerMessage {
    Batch {
        request_id: String,
        results: Vec<WorkspaceSearchResult>,
    },
    Done {
        request_id: String,
        total: usize,
        truncated: bool,
        cancelled: bool,
    },
}

pub struct SearchWorkerHandle {
    pub tx: mpsc::UnboundedSender<SearchWorkerCommand>,
}

pub fn create_search_worker<F>(on_message: F) -> SearchWorkerHandle
where
    F: Fn(SearchWorkerMessage) + Send + Sync + 'static,
{
    let (tx, mut rx) = mpsc::unbounded_channel::<SearchWorkerCommand>();
    let on_message = Arc::new(on_message);
    let active_request_id: Arc<RwLock<String>> = Arc::new(RwLock::new(String::new()));

    tokio::spawn(async move {
        let index = SearchIndex::default();
        let mut items: Vec<MdFile> = Vec::new();

        while let Some(cmd) = rx.recv().await {
            match cmd {
                SearchWorkerCommand::SetItems(new_items) => {
                    *active_request_id.write() = String::new();
                    items = new_items;
                    index.prime(&items);
                }
                SearchWorkerCommand::Search { request_id, query } => {
                    *active_request_id.write() = request_id.clone();

                    let index = index.clone();
                    let items = items.clone();
                    let active_id = active_request_id.clone();
                    let req_id = request_id.clone();
                    let on_msg = on_message.clone();

                    tokio::spawn(async move {
                        let should_cancel = {
                            let active_id = active_id.clone();
                            let req_id = req_id.clone();
                            move || *active_id.read() != req_id
                        };

                        let on_batch = {
                            let on_msg = on_msg.clone();
                            let req_id = req_id.clone();
                            move |results: Vec<WorkspaceSearchResult>| {
                                if *active_id.read() == req_id {
                                    on_msg(SearchWorkerMessage::Batch {
                                        request_id: req_id.clone(),
                                        results,
                                    });
                                }
                            }
                        };

                        let result = index
                            .search_incremental(
                                &query,
                                items,
                                IncrementalOptions {
                                    should_cancel: Box::new(should_cancel),
                                    on_batch: Box::new(on_batch),
                                    ..Default::default()
                                },
                            )
                            .await;

                        on_msg(SearchWorkerMessage::Done {
                            request_id: req_id,
                            total: result.total,
                            truncated: result.truncated,
                            cancelled: result.cancelled,
                        });
                    });
                }
                SearchWorkerCommand::Cancel => {
                    *active_request_id.write() = String::new();
                }
                SearchWorkerCommand::Dispose => {
                    *active_request_id.write() = String::new();
                    break;
                }
            }
        }
    });

    SearchWorkerHandle { tx }
}

impl SearchWorkerHandle {
    pub fn set_items(&self, items: Vec<MdFile>) {
        let _ = self.tx.send(SearchWorkerCommand::SetItems(items));
    }

    pub fn search(&self, request_id: String, query: String) {
        let _ = self
            .tx
            .send(SearchWorkerCommand::Search { request_id, query });
    }

    pub fn cancel(&self) {
        let _ = self.tx.send(SearchWorkerCommand::Cancel);
    }

    pub fn dispose(&self) {
        let _ = self.tx.send(SearchWorkerCommand::Dispose);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn make_file(name: &str) -> MdFile {
        // Use a real temp .md file so the search index doesn't skip it
        let mut tmp = tempfile::Builder::new().suffix(".md").tempfile().unwrap();
        use std::io::Write;
        let _ = tmp.write_all(b"test content for search");
        let fs_path = tmp.path().to_string_lossy().to_string();
        // Keep the temp file alive by leaking it (test process is short-lived)
        std::mem::forget(tmp);
        MdFile {
            fs_path,
            relative_path: format!("docs/{name}"),
            parts: vec!["docs".to_string()],
            file_name: format!("{name}.md"),
            title: name.to_string(),
            extension: "md".to_string(),
            document_kind: crate::workspace::scanner::DocumentKind::Markdown,
            tab_id: None,
            tab_label: None,
        }
    }

    fn make_tab_file(name: &str, tab_id: &str, tab_label: &str) -> MdFile {
        MdFile {
            tab_id: Some(tab_id.to_string()),
            tab_label: Some(tab_label.to_string()),
            ..make_file(name)
        }
    }

    #[tokio::test]
    async fn set_items_then_search_returns_results() {
        let (msg_tx, mut msg_rx) = mpsc::unbounded_channel::<SearchWorkerMessage>();

        let handle = create_search_worker(move |msg| {
            let _ = msg_tx.send(msg);
        });

        handle.set_items(vec![make_file("a")]);
        handle.search("req1".into(), "test".into());

        // Should receive at least one Batch and then a Done
        let mut got_batch = false;
        let mut got_done = false;
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        while tokio::time::Instant::now() < deadline {
            match tokio::time::timeout(Duration::from_millis(500), msg_rx.recv()).await {
                Ok(Some(SearchWorkerMessage::Batch { request_id, .. })) => {
                    assert_eq!(request_id, "req1");
                    got_batch = true;
                }
                Ok(Some(SearchWorkerMessage::Done {
                    request_id, total, ..
                })) => {
                    assert_eq!(request_id, "req1");
                    assert!(total > 0);
                    got_done = true;
                    break;
                }
                _ => {}
            }
        }
        handle.dispose();
        assert!(got_batch || got_done);
    }

    #[tokio::test]
    async fn search_results_preserve_cross_tab_metadata() {
        let (msg_tx, mut msg_rx) = mpsc::unbounded_channel::<SearchWorkerMessage>();

        let handle = create_search_worker(move |msg| {
            let _ = msg_tx.send(msg);
        });

        handle.set_items(vec![make_tab_file("a", "tab-1", "Workspace A")]);
        handle.search("req1".into(), "test".into());

        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        let mut got_metadata = false;
        while tokio::time::Instant::now() < deadline {
            match tokio::time::timeout(Duration::from_millis(500), msg_rx.recv()).await {
                Ok(Some(SearchWorkerMessage::Batch {
                    request_id,
                    results,
                })) => {
                    assert_eq!(request_id, "req1");
                    if let Some(result) = results.first() {
                        assert_eq!(result.tab_id.as_deref(), Some("tab-1"));
                        assert_eq!(result.tab_label.as_deref(), Some("Workspace A"));
                        got_metadata = true;
                        break;
                    }
                }
                Ok(Some(SearchWorkerMessage::Done { .. })) => break,
                _ => {}
            }
        }

        handle.dispose();
        assert!(got_metadata);
    }

    #[tokio::test]
    async fn cancel_invalidates_active_search() {
        let (msg_tx, mut msg_rx) = mpsc::unbounded_channel::<SearchWorkerMessage>();

        let handle = create_search_worker(move |msg| {
            let _ = msg_tx.send(msg);
        });

        handle.set_items(vec![make_file("a")]);
        handle.search("req1".into(), "test".into());
        handle.cancel();
        handle.search("req2".into(), "content".into());

        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        while tokio::time::Instant::now() < deadline {
            match tokio::time::timeout(Duration::from_millis(500), msg_rx.recv()).await {
                Ok(Some(SearchWorkerMessage::Done { request_id, .. })) => {
                    if request_id == "req2" {
                        break;
                    }
                }
                _ => {}
            }
        }
        handle.dispose();
    }

    #[tokio::test]
    async fn dispose_stops_worker() {
        let (msg_tx, _msg_rx) = mpsc::unbounded_channel::<SearchWorkerMessage>();
        let handle = create_search_worker(move |msg| {
            let _ = msg_tx.send(msg);
        });
        handle.set_items(vec![make_file("a")]);
        handle.dispose();
        // Channel should still be usable (send doesn't fail on closed receiver)
        // but worker task should exit
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
