use super::*;

impl Dispatcher {
    pub(super) fn handle_search_workspace(
        &self,
        request_id: &str,
        query: &str,
        items: Option<Value>,
    ) {
        let idx = self.ensure_search_index();
        let flat_list = self.state.inner.read().flat_list.clone();
        let items = resolve_search_items(items, &flat_list);
        let results = idx.search(&query.trim().to_lowercase(), &items, 10000);
        host_message::emit_workspace_search_results(&self.app, request_id, json!(results));
    }

    pub(super) fn handle_search_across_workspaces(&self, request_id: &str, query: &str) {
        self.ensure_search_worker();
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.search(request_id.to_string(), query.trim().to_lowercase());
        }
    }

    pub(super) fn handle_index_workspace_search_items(&self, items: Option<Value>) {
        self.ensure_search_worker();
        let flat_list = self.state.inner.read().flat_list.clone();
        let items = resolve_search_items(items, &flat_list);
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.set_items(items);
        }
    }

    pub(super) async fn handle_load_workspace_search_indexes(&self, tabs: Value) {
        let tab_requests = tabs.as_array().cloned().unwrap_or_default();
        if tab_requests.is_empty() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
        for tab in &tab_requests {
            let tab_id = tab.get("tabId").and_then(Value::as_str).unwrap_or("");
            let ws_path = tab
                .get("workspacePath")
                .and_then(Value::as_str)
                .unwrap_or("");
            if !tab_id.is_empty() && !ws_path.is_empty() {
                let (flat, tree) = if Path::new(ws_path).exists() {
                    let doc_conv = self.state.inner.read().document_conversion_enabled;
                    scan(
                        Path::new(ws_path),
                        ScanOptions {
                            document_conversion_enabled: doc_conv,
                        },
                    )
                    .map(|result| {
                        self.ensure_search_index().prime(&result.flat);
                        (json!(result.flat), json!(result.tree))
                    })
                    .unwrap_or((json!([]), Value::Null))
                } else {
                    (json!([]), Value::Null)
                };
                host_message::emit_workspace_search_index_loaded(
                    &self.app, tab_id, ws_path, flat, tree,
                );
            }
            tokio::time::sleep(Duration::from_millis(150)).await;
        }
    }
}
