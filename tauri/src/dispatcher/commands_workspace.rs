use super::*;

impl Dispatcher {
    pub(super) async fn handle_workspace_command(&self, cmd: &str, msg: &Value) -> Result<bool, String> {
        match cmd {
            // ── B1 handlers ──
            "openFolder" => {
                let open_first_file = msg
                    .get("openFirstFile")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let operation = host_message::current_workspace_operation(&self.app);
                if let Some(path) = self.pick_folder() {
                    if let Some(old_path) = msg
                        .get("replaceRecentWorkspacePath")
                        .and_then(Value::as_str)
                        .filter(|old_path| Path::new(old_path) != path.as_path())
                    {
                        let store = self.recents_store();
                        store.remove(Path::new(old_path));
                        host_message::emit_recent_workspaces_changed(&self.app, store.load());
                    }
                    self.handle_open_path(&path, open_first_file);
                } else {
                    host_message::emit_scoped(
                        &self.app,
                        "workspaceOpenCancelled",
                        serde_json::Map::new(),
                        operation.as_ref(),
                    );
                    let mut state = self.state.inner.write();
                    state.workspace_operation_id = None;
                    state.workspace_tab_id = None;
                }
            }
            "openFile" => {
                if let Some(path) = self.pick_file() {
                    self.handle_open_path(&path, false);
                }
            }
            "openPath" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    let open_first_file = msg
                        .get("openFirstFile")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    self.handle_open_path(Path::new(path_str), open_first_file);
                }
            }
            "activateWorkspace" => {
                if let Some(workspace_path_str) = msg.get("workspacePath").and_then(Value::as_str) {
                    let file_path = msg
                        .get("filePath")
                        .and_then(Value::as_str)
                        .map(PathBuf::from);
                    let open_first_file = msg
                        .get("openFirstFile")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    let path = PathBuf::from(workspace_path_str);
                    let status = get_workspace_path_status(&path);
                    if !status.ok {
                        self.send_workspace_unavailable(
                            &path,
                            status.reason.unwrap_or(WorkspaceUnavailableReason::Missing),
                        );
                    } else {
                        let current_file = file_path.filter(|p| p.exists());
                        self.save_recent_workspace(&path);
                        self.set_workspace(path, current_file);
                        self.ensure_workspace_watch();
                        self.bind_watch();
                        host_message::emit_loading(&self.app, "Loading workspace...", None);
                        self.send_workspace_data(open_first_file);
                    }
                }
            }
            "openRecentWorkspace" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    let open_first_file = msg
                        .get("openFirstFile")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    self.handle_open_path(Path::new(path_str), open_first_file);
                }
            }
            "closeWorkspace" => {
                let operation = {
                    let mut state = self.state.inner.write();
                    let operation = host_message::WorkspaceOperationMetadata::from_parts(
                        state.workspace_operation_id.as_deref(),
                        state.workspace_tab_id.as_deref(),
                    );
                    state.workspace_path = None;
                    state.current_file = None;
                    state.flat_list.clear();
                    state.ready_handled = false;
                    state.workspace_scan_generation = state.workspace_scan_generation.wrapping_add(1);
                    state.workspace_operation_id = None;
                    state.workspace_tab_id = None;
                    if let Some(ref wc) = state.watch_controller {
                        wc.dispose();
                    }
                    operation
                };
                let ready_message = operation
                    .as_ref()
                    .map(|operation| {
                        json!({
                            "workspaceOperationId": operation.operation_id.clone(),
                            "workspaceTabId": operation.tab_id.clone(),
                        })
                    })
                    .unwrap_or_else(|| json!({}));
                self.handle_ready(&ready_message).await;
            }
            "cancelWorkspaceScan" => {
                let requested_operation = msg
                    .get("workspaceOperationId")
                    .and_then(Value::as_str);
                let cancelled = {
                    let mut state = self.state.inner.write();
                    let matches = requested_operation.is_some()
                        && state.workspace_operation_id.as_deref() == requested_operation;
                    if !matches {
                        None
                    } else {
                        let operation = host_message::WorkspaceOperationMetadata::from_parts(
                            state.workspace_operation_id.as_deref(),
                            state.workspace_tab_id.as_deref(),
                        );
                        state.workspace_scan_generation =
                            state.workspace_scan_generation.wrapping_add(1);
                        state.runtime_state = RuntimeState::Ready;
                        let scanned_files = state.flat_list.len();
                        state.workspace_operation_id = None;
                        state.workspace_tab_id = None;
                        Some((scanned_files, operation))
                    }
                };
                if let Some((scanned_files, operation)) = cancelled {
                    host_message::emit_workspace_scan_progress_scoped(
                        &self.app,
                        scanned_files,
                        false,
                        operation.as_ref(),
                    );
                }
            }
            "cancelAllWorkspaceScans" => {
                let mut state = self.state.inner.write();
                state.workspace_scan_generation = state.workspace_scan_generation.wrapping_add(1);
                state.runtime_state = RuntimeState::Ready;
                state.workspace_operation_id = None;
                state.workspace_tab_id = None;
            }
            "confirmOpenPath" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    if Path::new(path_str).exists() {
                        self.handle_open_path(Path::new(path_str), false);
                    }
                }
            }
            "deleteRecentWorkspace" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    let store = self.recents_store();
                    store.remove(Path::new(path_str));
                    host_message::emit_recent_workspaces_changed(&self.app, store.load());
                }
            }
            "replaceRecentWorkspaces" => {
                let entries = msg
                    .get("recentWorkspaces")
                    .cloned()
                    .and_then(|value| {
                        serde_json::from_value::<Vec<RecentWorkspaceInput>>(value).ok()
                    })
                    .unwrap_or_default();
                let store = self.recents_store();
                store.replace(entries);
                host_message::emit_recent_workspaces_changed(&self.app, store.load());
            }
            // ── B2 handlers ──
            "ready" => {
                self.handle_ready(&msg).await;
            }
            "refresh" => {
                self.handle_refresh().await;
            }
            "navigate" => {
                let file_path = msg.get("path").and_then(Value::as_str).unwrap_or("");
                self.handle_navigate(file_path).await;
            }
            "searchWorkspace" => {
                let request_id = msg
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let query = msg
                    .get("query")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let items = msg.get("items").cloned();
                self.handle_search_workspace(&request_id, &query, items);
            }
            "searchAcrossWorkspaces" => {
                let request_id = msg
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let query = msg
                    .get("query")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                self.handle_search_across_workspaces(&request_id, &query);
            }
            "indexWorkspaceSearchItems" => {
                let items = msg.get("items").cloned();
                self.handle_index_workspace_search_items(items);
            }
            "loadWorkspaceSearchIndexes" => {
                let tabs = msg.get("tabs").cloned().unwrap_or(Value::Array(vec![]));
                self.handle_load_workspace_search_indexes(tabs).await;
            }
            _ => return Ok(false),
        }
        Ok(true)
    }
}
