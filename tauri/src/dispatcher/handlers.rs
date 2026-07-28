use super::*;
use crate::host_message::WorkspaceOperationMetadata;

#[derive(Clone)]
struct WorkspaceContentRequest {
    workspace_path: Option<PathBuf>,
    current_file: Option<PathBuf>,
    scan_generation: u64,
    operation: Option<WorkspaceOperationMetadata>,
}

impl Dispatcher {
    pub(super) fn recents_store(&self) -> RecentWorkspacesStore {
        let app_config = self
            .app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        RecentWorkspacesStore::new(app_config)
    }

    pub(super) fn send_workspace_unavailable(
        &self,
        path: &Path,
        reason: WorkspaceUnavailableReason,
    ) {
        let store = self.recents_store();
        let operation = {
            let mut state = self.state.inner.write();
            let operation = WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            );
            state.workspace_path = None;
            state.current_file = None;
            state.flat_list.clear();
            state.workspace_scan_generation = state.workspace_scan_generation.wrapping_add(1);
            state.workspace_operation_id = None;
            state.workspace_tab_id = None;
            operation
        };
        host_message::emit_workspace_unavailable_scoped(
            &self.app,
            &path.to_string_lossy(),
            reason,
            store.load(),
            operation.as_ref(),
        );
    }

    pub(super) fn save_recent_workspace(&self, workspace_path: &Path) {
        let store = self.recents_store();
        store.save(workspace_path);
        host_message::emit_recent_workspaces_changed(&self.app, store.load());
    }

    pub(super) fn set_workspace(&self, workspace_path: PathBuf, current_file: Option<PathBuf>) {
        let mut state = self.state.inner.write();
        state.workspace_path = Some(workspace_path);
        state.current_file = current_file;
        state.flat_list.clear();
        state.runtime_state = RuntimeState::Initializing;
        state.workspace_scan_generation = state.workspace_scan_generation.wrapping_add(1);
    }

    pub(super) fn handle_open_path(&self, path: &Path, open_first_file: bool) {
        let document_conversion_enabled = self.state.inner.read().document_conversion_enabled;
        match choose_workspace_and_file(path, document_conversion_enabled) {
            Ok((workspace_path, current_file)) => {
                self.save_recent_workspace(&workspace_path);
                self.set_workspace(workspace_path, current_file);
                self.ensure_workspace_watch();
                self.bind_watch();
                host_message::emit_loading(&self.app, "Loading workspace...", None);
                self.send_workspace_data(open_first_file);
            }
            Err("unavailable") => {
                let reason = get_workspace_path_status(path)
                    .reason
                    .unwrap_or(WorkspaceUnavailableReason::Missing);
                self.send_workspace_unavailable(path, reason);
            }
            Err("unsupported") => {
                host_message::emit_loading(
                    &self.app,
                    "Unsupported file type",
                    Some("Turn on document conversion to preview this file type."),
                );
            }
            Err(_) => {}
        }
    }

    pub(super) fn pick_folder(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_folder()
            .and_then(|p| p.into_path().ok())
    }

    pub(super) fn pick_file(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_file()
            .and_then(|p| p.into_path().ok())
    }

    pub(super) fn ensure_search_index(&self) -> SearchIndex {
        {
            let state = self.state.inner.read();
            if let Some(ref idx) = state.search_index {
                return idx.clone();
            }
        }
        let idx = SearchIndex::default();
        let mut state = self.state.inner.write();
        state.search_index = Some(idx.clone());
        idx
    }

    pub(super) fn ensure_search_worker(&self) {
        let mut state = self.state.inner.write();
        if state.search_worker.is_some() {
            return;
        }
        let app = self.app.clone();
        let handle = create_search_worker(move |msg| match msg {
            SearchWorkerMessage::Batch {
                request_id,
                results,
            } => {
                host_message::emit_cross_tab_search_results_batch(
                    &app,
                    &request_id,
                    json!(results),
                );
            }
            SearchWorkerMessage::Done {
                request_id,
                total,
                truncated,
                cancelled,
            } => {
                host_message::emit_cross_tab_search_results_done(
                    &app,
                    &request_id,
                    total,
                    truncated,
                    cancelled,
                );
            }
        });
        state.search_worker = Some(handle);
    }

    pub(super) fn ensure_workspace_watch(&self) {
        let mut state = self.state.inner.write();
        if state.watch_controller.is_some() {
            return;
        }
        let app = self.app.clone();
        let state_clone = self.state.clone();
        let controller = WorkspaceWatchController::new(120, move |workspace_path, change| {
            let app = app.clone();
            let state = state_clone.clone();
            tauri::async_runtime::spawn(async move {
                let dispatcher = Dispatcher { app, state };
                dispatcher.refresh_from_watch(workspace_path, change).await;
            });
        });
        state.watch_controller = Some(controller);
    }

    pub(super) fn bind_watch(&self) {
        let base_dir = self.get_workspace_base_dir();
        let state = self.state.inner.read();
        if let Some(ref wc) = state.watch_controller {
            wc.watch_workspace(base_dir.as_deref());
        }
    }

    pub(super) fn get_workspace_base_dir(&self) -> Option<PathBuf> {
        let ws = self.state.inner.read().workspace_path.clone()?;
        if !ws.exists() {
            return None;
        }
        Some(if ws.is_file() {
            ws.parent().unwrap_or(&ws).to_path_buf()
        } else {
            ws
        })
    }

    pub(super) fn is_current_file_still_available(&self) -> bool {
        let state = self.state.inner.read();
        let Some(ref current_file) = state.current_file else {
            return false;
        };
        let status = get_workspace_path_status(current_file);
        if !status.ok || !status.is_file {
            return false;
        }
        let doc_conv = state.document_conversion_enabled;
        if !crate::workspace::file_types::is_supported_file_path(
            &current_file.to_string_lossy(),
            doc_conv,
        ) {
            return false;
        }
        state
            .flat_list
            .iter()
            .any(|f| f.fs_path == current_file.to_string_lossy())
    }

    pub(super) fn send_workspace_files_changed(&self) -> bool {
        let (workspace_path, document_conversion_enabled, scan_generation, operation) = {
            let state = self.state.inner.read();
            (
                state.workspace_path.clone(),
                state.document_conversion_enabled,
                state.workspace_scan_generation,
                WorkspaceOperationMetadata::from_parts(
                    state.workspace_operation_id.as_deref(),
                    state.workspace_tab_id.as_deref(),
                ),
            )
        };
        let Some(workspace_path) = workspace_path else {
            return false;
        };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            if self.is_workspace_scan_current(
                &workspace_path,
                scan_generation,
                operation.as_ref(),
            ) {
                self.send_workspace_unavailable(
                    &workspace_path,
                    status.reason.unwrap_or(WorkspaceUnavailableReason::Missing),
                );
            }
            return false;
        }

        let result = match scan(
            &workspace_path,
            ScanOptions {
                document_conversion_enabled,
            },
        ) {
            Ok(r) => r,
            Err(err) => {
                eprintln!("Failed to scan workspace on watch: {err}");
                return false;
            }
        };

        {
            let mut state = self.state.inner.write();
            let current_operation = WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            );
            if state.workspace_path.as_deref() != Some(workspace_path.as_path())
                || state.workspace_scan_generation != scan_generation
                || current_operation.as_ref() != operation.as_ref()
            {
                return false;
            }
            state.flat_list = result.flat.clone();
        }

        let idx = self.ensure_search_index();
        idx.prime(&result.flat);

        let workspace_name = workspace_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| workspace_path.to_string_lossy().to_string());

        host_message::emit_workspace_files_changed_scoped(
            &self.app,
            json!(result.flat),
            json!(result.tree),
            &workspace_name,
            &workspace_path.to_string_lossy(),
            document_conversion_enabled,
            operation.as_ref(),
        );
        true
    }

    fn capture_workspace_request(&self) -> WorkspaceContentRequest {
        let state = self.state.inner.read();
        WorkspaceContentRequest {
            workspace_path: state.workspace_path.clone(),
            current_file: state.current_file.clone(),
            scan_generation: state.workspace_scan_generation,
            operation: WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            ),
        }
    }

    fn is_workspace_request_current(&self, request: &WorkspaceContentRequest) -> bool {
        let state = self.state.inner.read();
        state.workspace_path.as_ref() == request.workspace_path.as_ref()
            && state.current_file.as_ref() == request.current_file.as_ref()
            && state.workspace_scan_generation == request.scan_generation
            && WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            )
            .as_ref()
                == request.operation.as_ref()
    }

    fn is_workspace_scan_current(
        &self,
        workspace_path: &Path,
        scan_generation: u64,
        operation: Option<&WorkspaceOperationMetadata>,
    ) -> bool {
        let state = self.state.inner.read();
        state.workspace_path.as_deref() == Some(workspace_path)
            && state.workspace_scan_generation == scan_generation
            && WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            )
            .as_ref()
                == operation
    }

    pub(super) fn send_initial_content_for_scan(
        &self,
        open_first_file: bool,
        workspace_path: &Path,
        scan_generation: u64,
        operation: Option<&WorkspaceOperationMetadata>,
    ) {
        if !self.is_workspace_scan_current(workspace_path, scan_generation, operation) {
            return;
        }
        if open_first_file {
            let mut state = self.state.inner.write();
            let current_operation = WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            );
            if state.workspace_path.as_deref() != Some(workspace_path)
                || state.workspace_scan_generation != scan_generation
                || current_operation.as_ref() != operation
            {
                return;
            }
            if state.current_file.is_none() {
                state.current_file = state
                    .flat_list
                    .first()
                    .map(|file| PathBuf::from(&file.fs_path));
            }
        }
        let request = self.capture_workspace_request();
        if request.workspace_path.as_deref() != Some(workspace_path)
            || request.scan_generation != scan_generation
            || request.operation.as_ref() != operation
        {
            return;
        }
        if request.current_file.is_some() {
            self.send_content_for_request(request);
        } else {
            self.send_welcome_for_request(request);
        }
    }

    pub(super) fn send_content(&self) {
        let request = self.capture_workspace_request();
        self.send_content_for_request(request);
    }

    fn send_content_for_request(&self, request: WorkspaceContentRequest) {
        let Some(current_file) = request.current_file.as_ref() else {
            return;
        };
        let Some(_workspace_path) = request.workspace_path.as_ref() else {
            return;
        };
        if !self.is_workspace_request_current(&request) {
            return;
        }

        let file_path_str = current_file.to_string_lossy().to_string();
        let (doc_conv, converter, flat_list) = {
            let state = self.state.inner.read();
            if state.workspace_path.as_ref() != request.workspace_path.as_ref()
                || state.current_file.as_ref() != request.current_file.as_ref()
                || state.workspace_scan_generation != request.scan_generation
            {
                return;
            }
            (
                state.document_conversion_enabled,
                state.converter.clone(),
                state.flat_list.clone(),
            )
        };
        let is_html_document = current_file
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("html") || ext.eq_ignore_ascii_case("htm"));
        let source_document_text = if is_html_document {
            std::fs::read_to_string(&current_file).ok()
        } else {
            None
        };
        let native_html_conversion = current_file
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("html"));
        let conversion_enabled = if is_html_document { true } else { doc_conv };
        let result = if is_html_document && !native_html_conversion {
            None
        } else {
            Some(converter.read_markdown(&file_path_str, conversion_enabled))
        };
        if !self.is_workspace_request_current(&request) {
            return;
        }
        let raw = result
            .as_ref()
            .map(|value| value.markdown.clone())
            .unwrap_or_default();
        let preview_info = result.and_then(|value| value.preview_info);

        let file_info = flat_list.iter().find(|file| file.fs_path == file_path_str);
        let relative_path = file_info
            .map(|file| file.relative_path.clone())
            .unwrap_or_else(|| file_path_str.clone());
        let title = file_info.map(|file| file.title.clone()).unwrap_or_else(|| {
            current_file
                .file_stem()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default()
        });

        let mut extra = serde_json::Map::new();
        extra.insert("html".into(), "".into());
        extra.insert("markdownSource".into(), raw.into());
        extra.insert("sourceDocumentText".into(), source_document_text.into());
        extra.insert("frontmatter".into(), json!({}));
        extra.insert("toc".into(), json!([]));
        extra.insert("filePath".into(), file_path_str.into());
        extra.insert("relativePath".into(), relative_path.into());
        extra.insert("title".into(), title.into());
        extra.insert("fileList".into(), json!(flat_list));
        extra.insert(
            "previewInfo".into(),
            serde_json::to_value(preview_info).unwrap_or(Value::Null),
        );
        host_message::emit_scoped(
            &self.app,
            "renderContent",
            extra,
            request.operation.as_ref(),
        );
    }

    pub(super) fn send_welcome(&self) {
        let request = self.capture_workspace_request();
        self.send_welcome_for_request(request);
    }

    fn send_welcome_for_request(&self, request: WorkspaceContentRequest) {
        if !self.is_workspace_request_current(&request) {
            return;
        }
        let flat_list = self.state.inner.read().flat_list.clone();
        if !self.is_workspace_request_current(&request) {
            return;
        }
        host_message::emit_render_content_empty_welcome_scoped(
            &self.app,
            json!(flat_list),
            request.operation.as_ref(),
        );
    }

}
