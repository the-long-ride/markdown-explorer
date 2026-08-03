use super::*;

impl Dispatcher {
    pub(super) fn handle_search_workspace(
        &self,
        request_id: &str,
        query: &str,
        items: Option<Value>,
        match_case: bool,
    ) {
        let idx = self.ensure_search_index();
        let flat_list = self.state.inner.read().flat_list.clone();
        let items = resolve_search_items(items, &flat_list);
        let results = idx.search_with_case(query.trim(), &items, 10000, match_case);
        host_message::emit_workspace_search_results(&self.app, request_id, json!(results));
    }

    pub(super) fn handle_search_across_workspaces(
        &self,
        request_id: &str,
        query: &str,
        match_case: bool,
        tab_ids: Option<Vec<String>>,
    ) {
        self.ensure_search_worker();
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.search_with_case_and_tabs(
                request_id.to_string(),
                query.trim().to_string(),
                match_case,
                tab_ids,
            );
        }
    }

    pub(super) fn handle_index_workspace_search_items(&self, items: Option<Value>) {
        self.ensure_search_worker();
        let flat_list = self.state.inner.read().flat_list.clone();
        let items = resolve_search_items(items, &flat_list);
        self.ensure_search_index().prime(&items);
        {
            let mut state = self.state.inner.write();
            state.search_preview_paths = items.iter().map(|item| item.fs_path.clone()).collect();
        }
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.set_items(items);
        }
    }

    pub(super) fn handle_load_search_preview(&self, request_id: &str, file_path: &str) {
        let allowed = {
            let state = self.state.inner.read();
            state.flat_list.iter().any(|item| item.fs_path == file_path)
                || state.search_preview_paths.contains(file_path)
        };
        let mut extra = serde_json::Map::new();
        extra.insert("requestId".into(), json!(request_id));
        extra.insert("filePath".into(), json!(file_path));
        if !allowed {
            extra.insert("ok".into(), json!(false));
            extra.insert("reason".into(), json!("outside-workspace"));
            host_message::emit(&self.app, "searchPreviewResult", extra);
            return;
        }
        match self.ensure_search_index().read(file_path) {
            Some(markdown_source) => {
                extra.insert("ok".into(), json!(true));
                extra.insert("markdownSource".into(), json!(markdown_source));
            }
            None => {
                extra.insert("ok".into(), json!(false));
                extra.insert("reason".into(), json!("missing"));
            }
        }
        host_message::emit(&self.app, "searchPreviewResult", extra);
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
