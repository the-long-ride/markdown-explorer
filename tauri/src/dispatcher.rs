#![allow(dead_code)]

use crate::host_message;
use crate::runtime::navigation;
use crate::runtime::refresh::{is_watch_change_relevant, should_notify_current_file_changed};
use crate::search::index::SearchIndex;
use crate::search::worker::{create_search_worker, SearchWorkerMessage};
use crate::workspace::open::{get_workspace_path_status, choose_workspace_and_file, WorkspaceUnavailableReason};
use crate::workspace::recents::{RecentWorkspaceInput, RecentWorkspacesStore};
use crate::workspace::scanner::{scan, MdFile, ScanOptions};
use crate::workspace::watch::{WatchChange, WorkspaceWatchController};
use crate::app_state::RuntimeState;
use crate::app_state::AppState;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_opener::OpenerExt;

pub struct Dispatcher {
    pub app: AppHandle,
    pub state: AppState,
}

impl Dispatcher {
    pub fn mount(app: &AppHandle, state: AppState) {
        let app_clone = app.clone();
        let state_clone = state.clone();
        app.listen("webview-message", move |event| {
            let payload: Value = serde_json::from_str(event.payload()).unwrap_or(Value::Null);
            let app = app_clone.clone();
            let state = state_clone.clone();
            tauri::async_runtime::spawn(async move {
                let dispatcher = Dispatcher { app, state };
                if let Err(e) = dispatcher.handle(payload).await {
                    eprintln!("[dispatcher] handle error: {e}");
                }
            });
        });
    }

    fn recents_store(&self) -> RecentWorkspacesStore {
        let app_config = self
            .app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        RecentWorkspacesStore::new(app_config)
    }

    fn send_workspace_unavailable(&self, path: &Path, reason: WorkspaceUnavailableReason) {
        {
            let mut state = self.state.inner.write();
            state.workspace_path = None;
            state.current_file = None;
            state.flat_list.clear();
        }
        let store = self.recents_store();
        host_message::emit_workspace_unavailable(&self.app, &path.to_string_lossy(), reason, store.load());
    }

    fn set_workspace(&self, workspace_path: PathBuf, current_file: Option<PathBuf>) {
        let mut state = self.state.inner.write();
        state.workspace_path = Some(workspace_path);
        state.current_file = current_file;
    }

    fn handle_open_path(&self, path: &Path, open_first_file: bool) {
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
                let reason = get_workspace_path_status(path).reason.unwrap_or(WorkspaceUnavailableReason::Missing);
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

    fn pick_folder(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_folder()
            .and_then(|p| p.into_path().ok())
    }

    fn pick_file(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_file()
            .and_then(|p| p.into_path().ok())
    }

    // ── B2 helpers ──

    fn ensure_search_index(&self) -> SearchIndex {
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

    fn ensure_search_worker(&self) {
        let mut state = self.state.inner.write();
        if state.search_worker.is_some() {
            return;
        }
        let app = self.app.clone();
        let handle = create_search_worker(move |msg| match msg {
            SearchWorkerMessage::Batch { request_id, results } => {
                host_message::emit_cross_tab_search_results_batch(&app, &request_id, json!(results));
            }
            SearchWorkerMessage::Done { request_id, total, truncated, cancelled } => {
                host_message::emit_cross_tab_search_results_done(&app, &request_id, total, truncated, cancelled);
            }
        });
        state.search_worker = Some(handle);
    }

    fn ensure_workspace_watch(&self) {
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

    fn bind_watch(&self) {
        let base_dir = self.get_workspace_base_dir();
        let state = self.state.inner.read();
        if let Some(ref wc) = state.watch_controller {
            wc.watch_workspace(base_dir.as_deref());
        }
    }

    fn get_workspace_base_dir(&self) -> Option<PathBuf> {
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

    fn is_current_file_still_available(&self) -> bool {
        let state = self.state.inner.read();
        let Some(ref current_file) = state.current_file else { return false; };
        let status = get_workspace_path_status(current_file);
        if !status.ok || !status.is_file {
            return false;
        }
        let doc_conv = state.document_conversion_enabled;
        if !crate::workspace::file_types::is_supported_file_path(&current_file.to_string_lossy(), doc_conv) {
            return false;
        }
        state.flat_list.iter().any(|f| f.fs_path == current_file.to_string_lossy())
    }

    fn send_workspace_data(&self) {
        let workspace_path = {
            let state = self.state.inner.read();
            state.workspace_path.clone()
        };
        let Some(workspace_path) = workspace_path else { return; };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(&workspace_path, status.reason.unwrap_or(WorkspaceUnavailableReason::Missing));
            return;
        }

        let document_conversion_enabled = self.state.inner.read().document_conversion_enabled;
        let result = match scan(&workspace_path, ScanOptions { document_conversion_enabled }) {
            Ok(r) => r,
            Err(err) => {
                eprintln!("Failed to scan workspace: {err}");
                return;
            }
        };

        let flat = result.flat.clone();
        {
            let mut state = self.state.inner.write();
            state.flat_list = flat.clone();
            state.runtime_state = RuntimeState::Ready;
        }

        let idx = self.ensure_search_index();
        idx.prime(&flat);

        let store = self.recents_store();
        let workspace_name = workspace_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| workspace_path.to_string_lossy().to_string());

        host_message::emit_ready_ack_full(
            &self.app,
            json!(flat),
            json!(result.tree),
            &workspace_name,
            Some(&workspace_path.to_string_lossy()),
            store.load(),
            document_conversion_enabled,
        );
    }

    fn send_workspace_files_changed(&self) {
        let workspace_path = {
            let state = self.state.inner.read();
            state.workspace_path.clone()
        };
        let Some(workspace_path) = workspace_path else { return; };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(&workspace_path, status.reason.unwrap_or(WorkspaceUnavailableReason::Missing));
            return;
        }

        let document_conversion_enabled = self.state.inner.read().document_conversion_enabled;
        let result = match scan(&workspace_path, ScanOptions { document_conversion_enabled }) {
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

    fn send_initial_content(&self, open_first_file: bool) {
        let should_open_first = open_first_file && {
            let state = self.state.inner.read();
            state.current_file.is_none() && !state.flat_list.is_empty()
        };
        if should_open_first {
            let first = self.state.inner.read().flat_list.first().map(|f| f.fs_path.clone());
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

    fn send_content(&self) {
        let current_file = self.state.inner.read().current_file.clone();
        let Some(ref current_file) = current_file else { return; };
        let file_path_str = current_file.to_string_lossy().to_string();

        let doc_conv = self.state.inner.read().document_conversion_enabled;
        let converter = self.state.inner.read().converter.clone();
        let sidecar_available = doc_conv;

        let result = converter.read_markdown(&file_path_str, sidecar_available);
        let raw = result.markdown;
        let preview_info = result.preview_info;

        let flat_list = self.state.inner.read().flat_list.clone();
        let file_info = flat_list
            .iter()
            .find(|f| f.fs_path == file_path_str);

        let relative_path = file_info
            .map(|f| f.relative_path.clone())
            .unwrap_or_else(|| file_path_str.clone());
        let title = file_info
            .map(|f| f.title.clone())
            .unwrap_or_else(|| {
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
        extra.insert("previewInfo".into(), serde_json::to_value(preview_info).unwrap_or(Value::Null));
        host_message::emit(&self.app, "renderContent", extra);
    }

    fn send_welcome(&self) {
        let flat_list = self.state.inner.read().flat_list.clone();
        host_message::emit_render_content_empty_welcome(&self.app, json!(flat_list));
    }

    async fn refresh_from_watch(&self, _workspace_path: PathBuf, change: Option<WatchChange>) {
        let changed_path = change.as_ref().map(|c| c.fs_path.as_str()).unwrap_or("");
        let doc_conv = self.state.inner.read().document_conversion_enabled;

        if !is_watch_change_relevant(changed_path, doc_conv) {
            return;
        }

        self.refresh_active_workspace(true, changed_path).await;
    }

    async fn refresh_active_workspace(&self, preserve_current_content: bool, changed_path: &str) {
        let workspace_path = {
            let state = self.state.inner.read();
            state.workspace_path.clone()
        };
        let Some(workspace_path) = workspace_path else { return; };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(&workspace_path, status.reason.unwrap_or(WorkspaceUnavailableReason::Missing));
            return;
        }

        if preserve_current_content {
            self.send_workspace_files_changed();
            let current_file_still_available = self.is_current_file_still_available();
            let current_file = self.state.inner.read().current_file.clone();
            let cf_str = current_file.as_ref().and_then(|p| p.to_str());
            if should_notify_current_file_changed(cf_str, changed_path, current_file_still_available) {
                if let Some(ref cf) = current_file {
                    host_message::emit_current_file_changed(&self.app, &cf.to_string_lossy());
                }
            }
            return;
        }

        self.send_workspace_data();

        if !self.is_current_file_still_available() {
            self.state.inner.write().current_file = None;
        }

        let has_current = self.state.inner.read().current_file.is_some();
        if has_current {
            self.send_content();
        } else {
            self.send_welcome();
        }
    }

    // ── B2 command handlers ──

    async fn handle_ready(&self, msg: &Value) {
        if let Some(enabled) = msg.get("documentConversionEnabled").and_then(Value::as_bool) {
            self.state.inner.write().document_conversion_enabled = enabled;
        }

        {
            let state = self.state.inner.read();
            if state.ready_handled {
                return;
            }
        }
        self.state.inner.write().ready_handled = true;

        let config_dir = self.app.path().app_config_dir().unwrap_or_default();
        let persisted_state = crate::update::manager::UpdateManager::restore_and_emit(&self.app, &config_dir);
        self.state.inner.write().update_state = persisted_state;

        self.state.inner.read().perf.mark("host:ready");

        let workspace_path = self.state.inner.read().workspace_path.clone();
        let doc_conv = self.state.inner.read().document_conversion_enabled;
        let recents = self.recents_store().load();

        let ack = crate::runtime::startup::create_startup_ready_ack(
            workspace_path.as_deref(),
            recents,
            doc_conv,
            std::env::consts::OS,
            std::env::consts::ARCH,
            false,
        );
        let _ = self.app.emit("host-message", ack);

        self.state.inner.read().perf.mark("host:ready-ack");
        self.state.inner.read().perf.measure("host ready to readyAck", "host:ready");
        self.state.inner.read().perf.print_summary();

        if workspace_path.is_some() {
            let app = self.app.clone();
            let state = self.state.clone();
            tauri::async_runtime::spawn(async move {
                let dispatcher = Dispatcher { app, state };
                host_message::emit_loading(&dispatcher.app, "Loading workspace...", None);
                dispatcher.ensure_workspace_watch();
                dispatcher.bind_watch();
                dispatcher.send_workspace_data();
                dispatcher.send_initial_content(false);
            });
        }
    }

    async fn handle_refresh(&self) {
        self.refresh_active_workspace(false, "").await;
    }

    async fn handle_navigate(&self, file_path: &str) {
        if file_path.is_empty() {
            self.state.inner.write().current_file = None;
            self.send_welcome();
            return;
        }

        let current_file = self.state.inner.read().current_file.clone();
        let base_dir = self.get_workspace_base_dir();

        let resolved = if let Some(ref base) = base_dir {
            navigation::resolve_navigation_path(base, current_file.as_deref(), file_path)
        } else {
            PathBuf::from(navigation::decode_navigation_path(
                navigation::strip_navigation_fragment(file_path),
            ))
        };

        let doc_conv = self.state.inner.read().document_conversion_enabled;
        let exists = resolved.exists();
        let is_file = exists && resolved.is_file();
        let supported = crate::workspace::file_types::is_supported_file_path(&resolved.to_string_lossy(), doc_conv);

        if is_file && supported {
            self.state.inner.write().current_file = Some(resolved);
            self.send_content();
        } else {
            host_message::emit_nav_not_found(&self.app, &resolved.to_string_lossy());
        }
    }

    fn handle_search_workspace(&self, request_id: &str, query: &str, items: Option<Value>) {
        let idx = self.ensure_search_index();
        let flat_list = self.state.inner.read().flat_list.clone();
        let items: Vec<MdFile> = match items {
            Some(ref v) if v.is_array() => {
                // The UI sends partial item objects (fsPath/title/fileName/relativePath only).
                // Try full deserialization first; if it fails (missing required fields like
                // parts/extension/document_kind), fall back to filtering the server-side
                // flat_list by the fsPath set from the UI payload.
                serde_json::from_value::<Vec<MdFile>>(v.clone()).unwrap_or_else(|_| {
                    let paths: std::collections::HashSet<String> = v
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|item| item.get("fsPath").and_then(Value::as_str))
                                .map(ToOwned::to_owned)
                                .collect()
                        })
                        .unwrap_or_default();
                    if paths.is_empty() {
                        flat_list.clone()
                    } else {
                        flat_list.iter().filter(|f| paths.contains(&f.fs_path)).cloned().collect()
                    }
                })
            }
            _ => flat_list,
        };
        let query = query.trim().to_lowercase();
        let results = idx.search(&query, &items, 10000);
        host_message::emit_workspace_search_results(&self.app, request_id, json!(results));
    }

    fn handle_search_across_workspaces(&self, request_id: &str, query: &str) {
        self.ensure_search_worker();
        let query = query.trim().to_lowercase();
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.search(request_id.to_string(), query);
        }
    }

    fn handle_index_workspace_search_items(&self, items: Vec<MdFile>) {
        self.ensure_search_worker();
        let state = self.state.inner.read();
        if let Some(ref worker) = state.search_worker {
            worker.set_items(items);
        }
    }

    async fn handle_load_workspace_search_indexes(&self, tabs: Value) {
        let tab_requests: Vec<Value> = tabs.as_array().cloned().unwrap_or_default();
        if tab_requests.is_empty() {
            return;
        }

        tokio::time::sleep(Duration::from_millis(50)).await;

        for tab in &tab_requests {
            let tab_id = tab.get("tabId").and_then(Value::as_str).unwrap_or("").to_string();
            let ws_path = tab.get("workspacePath").and_then(Value::as_str).unwrap_or("").to_string();

            if !tab_id.is_empty() && !ws_path.is_empty() {
                if Path::new(&ws_path).exists() {
                    let doc_conv = self.state.inner.read().document_conversion_enabled;
                    match scan(Path::new(&ws_path), ScanOptions { document_conversion_enabled: doc_conv }) {
                        Ok(result) => {
                            let idx = self.ensure_search_index();
                            idx.prime(&result.flat);
                            host_message::emit_workspace_search_index_loaded(
                                &self.app,
                                &tab_id,
                                &ws_path,
                                json!(result.flat),
                                json!(result.tree),
                            );
                        }
                        Err(_) => {
                            host_message::emit_workspace_search_index_loaded(
                                &self.app,
                                &tab_id,
                                &ws_path,
                                json!([]),
                                Value::Null,
                            );
                        }
                    }
                } else {
                    host_message::emit_workspace_search_index_loaded(
                        &self.app,
                        &tab_id,
                        &ws_path,
                        json!([]),
                        Value::Null,
                    );
                }
            }

            tokio::time::sleep(Duration::from_millis(150)).await;
        }
    }

    fn handle_zoom(&self, direction: i8) {
        const ZOOM_STEP: f64 = 0.2;
        const ZOOM_MIN: f64 = -2.5;
        const ZOOM_MAX: f64 = 2.0;

        let current = self.state.inner.read().zoom_level;
        let next = current + direction as f64 * ZOOM_STEP;
        let next = next.clamp(ZOOM_MIN, ZOOM_MAX);
        let next = (next / ZOOM_STEP).round() * ZOOM_STEP;

        self.state.inner.write().zoom_level = next;

        if let Some(window) = self.app.get_webview_window("main") {
            let scale = 1.2_f64.powf(next);
            let _ = window.set_zoom(scale);
        }
    }

    async fn handle_set_document_conversion(&self, msg: &Value) {
        let enabled = msg.get("enabled").and_then(Value::as_bool).unwrap_or(false);
        let current = self.state.inner.read().document_conversion_enabled;
        if current == enabled {
            return;
        }

        self.state.inner.write().document_conversion_enabled = enabled;

        let workspace_path = self.state.inner.read().workspace_path.clone();
        if workspace_path.is_none() {
            return;
        }

        let label = if enabled {
            "Finding supported documents..."
        } else {
            "Refreshing Markdown files..."
        };
        host_message::emit_loading(&self.app, label, None);

        self.send_workspace_data();

        if !self.is_current_file_still_available() {
            self.state.inner.write().current_file = None;
        }

        let has_current = self.state.inner.read().current_file.is_some();
        if has_current {
            self.send_content();
        } else {
            self.send_welcome();
        }
    }

    pub async fn handle(self, msg: Value) -> Result<(), String> {
        let cmd = msg.get("command").and_then(|v| v.as_str()).unwrap_or("");
        match cmd {
            // ── B1 handlers ──
            "openFolder" => {
                let open_first_file = msg.get("openFirstFile").and_then(Value::as_bool).unwrap_or(false);
                if let Some(path) = self.pick_folder() {
                    self.handle_open_path(&path, open_first_file);
                }
            }
            "openFile" => {
                if let Some(path) = self.pick_file() {
                    self.handle_open_path(&path, false);
                }
            }
            "openPath" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    let open_first_file = msg.get("openFirstFile").and_then(Value::as_bool).unwrap_or(false);
                    self.handle_open_path(Path::new(path_str), open_first_file);
                }
            }
            "activateWorkspace" => {
                if let Some(workspace_path_str) = msg.get("workspacePath").and_then(Value::as_str) {
                    let file_path = msg.get("filePath").and_then(Value::as_str).map(PathBuf::from);
                    let open_first_file = msg.get("openFirstFile").and_then(Value::as_bool).unwrap_or(false);
                    let path = PathBuf::from(workspace_path_str);
                    let status = get_workspace_path_status(&path);
                    if !status.ok {
                        self.send_workspace_unavailable(&path, status.reason.unwrap_or(WorkspaceUnavailableReason::Missing));
                    } else {
                        let current_file = file_path.filter(|p| p.exists());
                        self.recents_store().save(&path);
                        self.set_workspace(path, current_file);
                        self.ensure_workspace_watch();
                        self.bind_watch();
                        host_message::emit_loading(&self.app, "Loading workspace...", None);
                        self.send_workspace_data();
                        self.send_initial_content(open_first_file);
                    }
                }
            }
            "openRecentWorkspace" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    let open_first_file = msg.get("openFirstFile").and_then(Value::as_bool).unwrap_or(false);
                    self.handle_open_path(Path::new(path_str), open_first_file);
                }
            }
            "closeWorkspace" => {
                {
                    let mut state = self.state.inner.write();
                    state.workspace_path = None;
                    state.current_file = None;
                    state.flat_list.clear();
                    state.ready_handled = false;
                    if let Some(ref wc) = state.watch_controller {
                        wc.dispose();
                    }
                }
                self.handle_ready(&json!({})).await;
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
                    .and_then(|value| serde_json::from_value::<Vec<RecentWorkspaceInput>>(value).ok())
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
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("").to_string();
                let query = msg.get("query").and_then(Value::as_str).unwrap_or("").to_string();
                let items = msg.get("items").cloned();
                self.handle_search_workspace(&request_id, &query, items);
            }
            "searchAcrossWorkspaces" => {
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("").to_string();
                let query = msg.get("query").and_then(Value::as_str).unwrap_or("").to_string();
                self.handle_search_across_workspaces(&request_id, &query);
            }
            "indexWorkspaceSearchItems" => {
                let items = msg
                    .get("items")
                    .cloned()
                    .and_then(|v| serde_json::from_value::<Vec<MdFile>>(v).ok())
                    .unwrap_or_default();
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
            "copyCode" => {
                let text = msg.get("text").and_then(Value::as_str).unwrap_or("");
                let _ = self.app.clipboard().write_text(text);
            }
            "openExternal" => {
                if let Some(url) = msg.get("url").and_then(Value::as_str) {
                    let url_lower = url.to_lowercase();
                    if url_lower.starts_with("http://") || url_lower.starts_with("https://") {
                        let _ = self.app.opener().open_url(url, None::<&str>);
                    }
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
                    if let Ok(true) = window.is_maximized() {
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
            "zoom-in" => {
                self.handle_zoom(1);
            }
            "zoom-out" => {
                self.handle_zoom(-1);
            }
            // ── C3: Update ──
            "downloadUpdate" => {
                let version = msg.get("version").and_then(Value::as_str).unwrap_or("").to_string();
                let url = msg.get("url").and_then(Value::as_str).unwrap_or("").to_string();
                if !version.is_empty() && !url.is_empty() {
                    let file_name = url.split('/').last().unwrap_or("update.msi").to_string();
                    let new_state = crate::update::UpdateState::downloading(&version, &file_name, 0);
                    {
                        self.state.inner.write().update_state = new_state.clone();
                    }
                    crate::update::manager::UpdateManager::emit_state(&self.app, &new_state);

                    let staging_dir = self.app.path().app_data_dir().unwrap_or_default().join("staged");
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
                if state.status == crate::update::UpdateStatus::Downloaded {
                    let version = state.version.clone().unwrap_or_default();
                    let file_name = state.downloaded_file_name.clone().unwrap_or_default();
                    let config_dir = self.app.path().app_config_dir().unwrap_or_default();
                    let manager = crate::update::manager::UpdateManager::new(config_dir);
                    manager.schedule_update(&self.app, &version, &file_name);
                    self.state.inner.write().update_state =
                        crate::update::UpdateState::scheduled(&version, &file_name);
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_mdfile_full_deserialization() {
        let val = json!([{
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "parts": ["file.md"],
            "fileName": "file.md",
            "title": "My Title",
            "extension": ".md",
            "documentKind": "markdown"
        }]);
        let items: Result<Vec<MdFile>, _> = serde_json::from_value(val);
        assert!(items.is_ok());
        assert_eq!(items.unwrap()[0].title, "My Title");
    }

    #[test]
    fn test_mdfile_partial_deserialization_fallback_extraction() {
        // Simulates the lightweight search payload sent by the UI
        let val = json!([{
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "fileName": "file.md",
            "title": "My Title"
        }]);

        // Attempting to deserialize as full MdFile fails because of missing required fields
        let full_deser: Result<Vec<MdFile>, _> = serde_json::from_value(val.clone());
        assert!(full_deser.is_err());

        // The fallback extraction retrieves the paths
        let paths: std::collections::HashSet<String> = val
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.get("fsPath").and_then(Value::as_str))
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default();

        assert_eq!(paths.len(), 1);
        assert!(paths.contains("/path/to/file.md"));
    }
}
