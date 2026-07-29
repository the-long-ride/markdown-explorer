use super::*;

impl Dispatcher {
    pub async fn handle(self, msg: Value) -> Result<(), String> {
        let cmd = msg.get("command").and_then(|v| v.as_str()).unwrap_or("");
        if matches!(
            cmd,
            "openFolder" | "openFile" | "openPath" | "activateWorkspace" | "openRecentWorkspace"
        ) {
            let mut state = self.state.inner.write();
            state.workspace_operation_id = msg
                .get("workspaceOperationId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            state.workspace_tab_id = msg
                .get("workspaceTabId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
        }
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
            // ── C5: Clipboard / External / Editor ──
            "openInEditor" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    if Path::new(path_str).exists() {
                        let _ = self.app.opener().open_path(path_str, None::<&str>);
                    }
                }
            }
            "readWorkspaceTextResource" => {
                let request_id = msg
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let mut extra = serde_json::Map::new();
                extra.insert("requestId".into(), request_id.into());
                let document_path = msg.get("documentPath").and_then(Value::as_str);
                let resource_path = msg.get("resourcePath").and_then(Value::as_str);
                let workspace_path = self.state.inner.read().workspace_path.clone();
                let result = (|| -> Result<(String, String), &'static str> {
                    let document_path = document_path.ok_or("unsupported")?;
                    let resource_path = resource_path.ok_or("unsupported")?;
                    let workspace_path = workspace_path.ok_or("missing")?;
                    let workspace_base = if workspace_path.is_file() {
                        workspace_path.parent().unwrap_or(workspace_path.as_path()).to_path_buf()
                    } else {
                        workspace_path
                    };
                    let reference = resource_path
                        .split(|character| character == '?' || character == '#')
                        .next()
                        .unwrap_or("");
                    if reference.is_empty()
                        || reference.starts_with("http://")
                        || reference.starts_with("https://")
                        || reference.starts_with("//")
                        || reference.starts_with("data:")
                        || reference.starts_with("blob:")
                        || reference.starts_with("javascript:")
                    {
                        return Err("unsupported");
                    }
                    let resolved = if reference.starts_with("file://") {
                        Url::parse(reference)
                            .map_err(|_| "unsupported")?
                            .to_file_path()
                            .map_err(|_| "unsupported")?
                    } else if reference.starts_with('/') {
                        workspace_base.join(reference.trim_start_matches('/'))
                    } else {
                        let reference_path = Path::new(reference);
                        if reference_path.is_absolute() {
                            reference_path.to_path_buf()
                        } else {
                            Path::new(document_path)
                                .parent()
                                .unwrap_or(workspace_base.as_path())
                                .join(reference_path)
                        }
                    };
                    let allowed = resolved
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map_or(false, |ext| matches!(ext.to_ascii_lowercase().as_str(), "css" | "js" | "mjs" | "cjs"));
                    if !allowed {
                        return Err("outside-workspace");
                    }
                    let canonical_workspace = workspace_base.canonicalize().map_err(|_| "missing")?;
                    let canonical_target = resolved.canonicalize().map_err(|_| "missing")?;
                    if !canonical_target.starts_with(&canonical_workspace) || !canonical_target.is_file() {
                        return Err("outside-workspace");
                    }
                    let content = std::fs::read_to_string(&canonical_target).map_err(|_| "unreadable")?;
                    Ok((content, canonical_target.to_string_lossy().into_owned()))
                })();
                match result {
                    Ok((content, resolved_path)) => {
                        extra.insert("ok".into(), true.into());
                        extra.insert("content".into(), content.into());
                        extra.insert("resolvedPath".into(), resolved_path.into());
                    }
                    Err(reason) => {
                        extra.insert("ok".into(), false.into());
                        extra.insert("reason".into(), reason.into());
                    }
                }
                host_message::emit(&self.app, "workspaceTextResourceResult", extra);
            }
            "openShellLocation" => {
                if let (Some(path_str), Some(mode)) = (
                    msg.get("path").and_then(Value::as_str),
                    msg.get("mode").and_then(Value::as_str),
                ) {
                    let source = Path::new(path_str);
                    if source.exists() {
                        match mode {
                            "open-directory" => {
                                let _ = self.app.opener().open_path(
                                    source.to_string_lossy().into_owned(),
                                    None::<&str>,
                                );
                            }
                            "open-parent-directory" => {
                                if let Some(parent) = source.parent() {
                                    let _ = self.app.opener().open_path(
                                        parent.to_string_lossy().into_owned(),
                                        None::<&str>,
                                    );
                                }
                            }
                            "reveal-file" => {
                                #[cfg(target_os = "windows")]
                                {
                                    let _ = std::process::Command::new("explorer")
                                        .arg(format!("/select,{}", source.display()))
                                        .spawn();
                                }
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = std::process::Command::new("open")
                                        .arg("-R")
                                        .arg(source)
                                        .spawn();
                                }
                                #[cfg(target_os = "linux")]
                                {
                                    if let Some(parent) = source.parent() {
                                        let _ = self.app.opener().open_path(
                                            parent.to_string_lossy().into_owned(),
                                            None::<&str>,
                                        );
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            "copyCode" => {
                let text = msg.get("text").and_then(Value::as_str).unwrap_or("");
                let _ = self.app.clipboard().write_text(text);
            }
            "openExternal" => {
                if let Some(url) = msg.get("url").and_then(Value::as_str) {
                    let url_lower = url.to_lowercase();
                    if url_lower.starts_with("http://")
                        || url_lower.starts_with("https://")
                        || url_lower.starts_with("file://")
                    {
                        let _ = self.app.opener().open_url(url, None::<&str>);
                    }
                }
            }
            "openHtmlPreview" => {
                if let Some(document_html) = msg.get("documentHtml").and_then(Value::as_str) {
                    crate::runtime::html_preview::open(&self.app, document_html)
                        .await
                        .map_err(|error| error.to_string())?;
                }
            }
            "setDocumentConversion" => {
                self.handle_set_document_conversion(&msg).await;
            }
            // ── C4: Window / Zoom ──
            "window-minimize" => {
                if let Some(window) = self.app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
            "window-maximize" => {
                if let Some(window) = self.app.get_webview_window("main") {
                    if let Ok(true) = window.is_fullscreen() {
                        self.state.inner.write().fullscreen_transition = FullscreenTransition::Idle;
                        if window.set_fullscreen(false).is_ok() {
                            host_message::emit_fullscreen_changed(&self.app, false);
                        }
                    } else if let Ok(true) = window.is_maximized() {
                        let _ = window.unmaximize();
                    } else {
                        let _ = window.maximize();
                    }
                }
            }
            "window-close" => {
                if let Some(window) = self.app.get_webview_window("main") {
                    let _ = window.close();
                }
            }
            "toggle-fullscreen" => {
                let app = self.app.clone();
                let state = self.state.clone();
                let _ = self.app.run_on_main_thread(move || {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Ok(is_fullscreen) = window.is_fullscreen() {
                            if is_fullscreen {
                                if window.set_fullscreen(false).is_ok() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                    host_message::emit_fullscreen_changed(&app, false);
                                }
                            } else if window.is_maximized().unwrap_or(false) {
                                state.inner.write().fullscreen_transition =
                                    FullscreenTransition::AwaitingUnmaximize;
                                if window.unmaximize().is_err() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                }
                            } else {
                                state.inner.write().fullscreen_transition =
                                    FullscreenTransition::AwaitingMaximize;
                                if window.maximize().is_err() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                }
                            }
                        }
                    }
                });
            }
            "zoom-in" => {
                self.handle_zoom(1);
            }
            "zoom-out" => {
                self.handle_zoom(-1);
            }
            // ── C3: Update ──
            "downloadUpdate" => {
                let version = msg
                    .get("version")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let url = msg
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !version.is_empty() && !url.is_empty() {
                    let file_name = url.split('/').last().unwrap_or("update.msi").to_string();
                    let staging_dir = self
                        .app
                        .path()
                        .app_data_dir()
                        .unwrap_or_default()
                        .join("staged");
                    let staged_file_path = staging_dir.join(&file_name);
                    let new_state =
                        crate::update::UpdateState::downloading(&version, &file_name, 0)
                            .with_staged_file_path(staged_file_path.to_string_lossy());
                    {
                        self.state.inner.write().update_state = new_state.clone();
                    }
                    crate::update::manager::UpdateManager::emit_state(&self.app, &new_state);

                    crate::update::manager::UpdateManager::start_download(
                        self.app.clone(),
                        &version,
                        &url,
                        staging_dir,
                    );
                }
            }
            "scheduleDownloadedUpdate" => {
                let state = self.state.inner.read().update_state.clone();
                let staged_file_path = state.staged_file_path.as_deref().map(PathBuf::from);
                if let Some(staged_file_path) = staged_file_path.filter(|path| path.exists()) {
                    let version = state.version.clone().unwrap_or_default();
                    let file_name = state.downloaded_file_name.clone().unwrap_or_default();
                    let config_dir = self.app.path().app_config_dir().unwrap_or_default();
                    let manager = crate::update::manager::UpdateManager::new(config_dir);
                    manager.schedule_update(&self.app, &version, &file_name, &staged_file_path);
                    self.state.inner.write().update_state =
                        crate::update::UpdateState::scheduled(&version, &file_name)
                            .with_staged_file_path(staged_file_path.to_string_lossy());
                }
            }
            "restartAndApplyUpdate" => {
                let state = self.state.inner.read().update_state.clone();
                let version = state.version.clone().unwrap_or_default();
                let config_dir = self.app.path().app_config_dir().unwrap_or_default();
                crate::update::manager::UpdateManager::apply_update(
                    &self.app,
                    &version,
                    &config_dir,
                );
                self.state.inner.write().update_state =
                    crate::update::UpdateState::applying(&version);
            }
            "updateAppearance" => {}
            _ => {
                eprintln!("[dispatcher] unknown command: {cmd}");
            }
        }
        Ok(())
    }
}
