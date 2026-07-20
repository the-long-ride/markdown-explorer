use super::*;

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
        {
            let mut state = self.state.inner.write();
            state.workspace_path = None;
            state.current_file = None;
            state.flat_list.clear();
            state.workspace_scan_generation = state.workspace_scan_generation.wrapping_add(1);
        }
        let store = self.recents_store();
        host_message::emit_workspace_unavailable(
            &self.app,
            &path.to_string_lossy(),
            reason,
            store.load(),
        );
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
                let store = self.recents_store();
                store.save(&workspace_path);
                self.set_workspace(workspace_path, current_file);
                self.ensure_workspace_watch();
                self.bind_watch();
                host_message::emit_loading(&self.app, "Loading workspace...", None);
                self.send_workspace_data();
                self.send_initial_content(open_first_file);
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

    pub(super) fn send_workspace_files_changed(&self) {
        let workspace_path = {
            let state = self.state.inner.read();
            state.workspace_path.clone()
        };
        let Some(workspace_path) = workspace_path else {
            return;
        };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(
                &workspace_path,
                status.reason.unwrap_or(WorkspaceUnavailableReason::Missing),
            );
            return;
        }

        let document_conversion_enabled = self.state.inner.read().document_conversion_enabled;
        let result = match scan(
            &workspace_path,
            ScanOptions {
                document_conversion_enabled,
            },
        ) {
            Ok(r) => r,
            Err(err) => {
                eprintln!("Failed to scan workspace on watch: {err}");
                return;
            }
        };

        {
            let mut state = self.state.inner.write();
            state.flat_list = result.flat.clone();
        }

        let idx = self.ensure_search_index();
        idx.prime(&result.flat);

        let workspace_name = workspace_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| workspace_path.to_string_lossy().to_string());

        host_message::emit_workspace_files_changed(
            &self.app,
            json!(result.flat),
            json!(result.tree),
            &workspace_name,
            &workspace_path.to_string_lossy(),
            document_conversion_enabled,
        );
    }

    pub(super) fn send_initial_content(&self, open_first_file: bool) {
        let should_open_first = open_first_file && {
            let state = self.state.inner.read();
            state.current_file.is_none() && !state.flat_list.is_empty()
        };
        if should_open_first {
            let first = self
                .state
                .inner
                .read()
                .flat_list
                .first()
                .map(|f| f.fs_path.clone());
            if let Some(first_path) = first {
                self.state.inner.write().current_file = Some(PathBuf::from(first_path));
            }
        }
        let has_current = self.state.inner.read().current_file.is_some();
        if has_current {
            self.send_content();
        } else {
            self.send_welcome();
        }
    }

    pub(super) fn send_content(&self) {
        let current_file = self.state.inner.read().current_file.clone();
        let Some(ref current_file) = current_file else {
            return;
        };
        let file_path_str = current_file.to_string_lossy().to_string();

        let doc_conv = self.state.inner.read().document_conversion_enabled;
        let converter = self.state.inner.read().converter.clone();
        let sidecar_available = doc_conv;

        let result = converter.read_markdown(&file_path_str, sidecar_available);
        let raw = result.markdown;
        let preview_info = result.preview_info;

        let flat_list = self.state.inner.read().flat_list.clone();
        let file_info = flat_list.iter().find(|f| f.fs_path == file_path_str);

        let relative_path = file_info
            .map(|f| f.relative_path.clone())
            .unwrap_or_else(|| file_path_str.clone());
        let title = file_info.map(|f| f.title.clone()).unwrap_or_else(|| {
            current_file
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default()
        });

        let mut extra = serde_json::Map::new();
        extra.insert("html".into(), "".into());
        extra.insert("markdownSource".into(), raw.into());
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
        host_message::emit(&self.app, "renderContent", extra);
    }

    pub(super) fn send_welcome(&self) {
        let flat_list = self.state.inner.read().flat_list.clone();
        host_message::emit_render_content_empty_welcome(&self.app, json!(flat_list));
    }
}
