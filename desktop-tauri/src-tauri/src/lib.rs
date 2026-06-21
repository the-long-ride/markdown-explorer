// ============================================================
// lib.rs — Markdown Explorer Tauri backend
// Mirrors the Electron IPC surface: ~25 commands routed through
// one generic dispatch(command, payload) Tauri command.
// ============================================================

mod scanner;
mod watcher;
mod recents;
mod search;

use scanner::{MdFile, ScanResult, scan};
use search::SearchIndex;
use recents::{RecentWorkspace, RecentWorkspacesStore};
use watcher::WorkspaceWatcher;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

// ── Application state ───────────────────────────────────────

struct AppData {
    workspace_path: Option<PathBuf>,
    scanner_result: Option<ScanResult>,
    current_file: Option<PathBuf>,
    search_index: SearchIndex,
    recents_store: RecentWorkspacesStore,
    watcher: Option<WorkspaceWatcher>,
    doc_conversion: bool, // stored toggle; actual conversion deferred
    zoom_level: f64,
}

// ── Outgoing message helpers ────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadyAckPayload {
    command: String,
    file_list: Vec<MdFile>,
    tree: Option<scanner::FolderNode>,
    theme: String,
    default_expanded: bool,
    workspace_name: String,
    workspace_path: Option<String>,
    recent_workspaces: Vec<RecentWorkspace>,
    app_version: String,
    app_runtime: String,
    host_platform: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderContentPayload {
    command: String,
    html: String,
    markdown_source: String,
    frontmatter: Value,
    toc: Vec<Value>,
    file_path: String,
    relative_path: String,
    title: String,
    file_list: Vec<MdFile>,
    preview_info: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct IncomingMessage {
    command: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    theme: Option<String>,
    #[serde(default)]
    theme_style: Option<String>,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    open_first_file: Option<bool>,
}

fn host_platform() -> &'static str {
    if cfg!(target_os = "windows") { "windows" }
    else if cfg!(target_os = "macos") { "macos" }
    else if cfg!(target_os = "linux") { "linux" }
    else { "unknown" }
}

fn workspace_name(path: &PathBuf) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn emit_to_webview(app: &AppHandle, payload: &impl Serialize) {
    if let Ok(json) = serde_json::to_value(payload) {
        let _ = app.emit("host-message", json);
    }
}

// ── Command handlers ────────────────────────────────────────

fn emit_welcome(app: &AppHandle, file_list: Vec<MdFile>) {
    emit_to_webview(app, &RenderContentPayload {
        command: "renderContent".into(),
        html: String::new(),
        markdown_source: String::new(),
        frontmatter: Value::Object(Default::default()),
        toc: vec![],
        file_path: String::new(),
        relative_path: "Welcome Page".into(),
        title: "Welcome".into(),
        file_list,
        preview_info: None,
    });
}

fn handle_ready(app: &AppHandle, data: &mut AppData) -> Result<(), String> {
    let recent = data.recents_store.get_all().to_vec();
    if let Some(ref ws) = data.workspace_path {
        let result = scan(ws, data.doc_conversion);
        let file_list = result.flat.clone();
        data.scanner_result = Some(result);

        // Build search index
        data.search_index.build(ws, &file_list);

        // Start watcher
        let ws_clone = ws.clone();
        data.watcher = Some(WorkspaceWatcher::new(ws_clone, || {
            // On file change, re-scan is triggered by client sending "refresh"
        }));

        emit_to_webview(app, &ReadyAckPayload {
            command: "readyAck".into(),
            file_list: file_list.clone(),
            tree: data.scanner_result.as_ref().map(|r| r.tree.clone()),
            theme: "auto".into(),
            default_expanded: true,
            workspace_name: workspace_name(ws),
            workspace_path: Some(ws.to_string_lossy().to_string()),
            recent_workspaces: recent,
            app_version: "1.5.3".into(),
            app_runtime: "desktop".into(),
            host_platform: host_platform().into(),
        });

        // Add to recents
        data.recents_store.add(RecentWorkspace {
            name: workspace_name(ws),
            path: ws.to_string_lossy().to_string(),
            last_opened: None,
        });

        // Send initial content
        if let Some(ref cur_file) = data.current_file {
            let cur_file_str = cur_file.to_string_lossy().to_string();
            handle_navigate(app, data, &cur_file_str)?;
        } else {
            emit_welcome(app, file_list);
        }
    } else {
        emit_to_webview(app, &ReadyAckPayload {
            command: "readyAck".into(),
            file_list: vec![],
            tree: None,
            theme: "auto".into(),
            default_expanded: true,
            workspace_name: "".into(),
            workspace_path: None,
            recent_workspaces: recent,
            app_version: "1.5.3".into(),
            app_runtime: "desktop".into(),
            host_platform: host_platform().into(),
        });
    }
    Ok(())
}

fn handle_navigate(app: &AppHandle, data: &mut AppData, path: &str) -> Result<(), String> {
    let file_path = PathBuf::from(path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let raw = fs::read_to_string(&file_path).map_err(|e| format!("Read error: {}", e))?;
    data.current_file = Some(file_path.clone());

    let ws = data.workspace_path.as_ref().ok_or("No workspace")?;
    let rel = file_path.strip_prefix(ws).unwrap_or(&file_path);
    let rel_str = rel.to_string_lossy().replace('\\', "/");

    let file_name = file_path.file_name()
        .and_then(|n| n.to_str()).unwrap_or("");
    let title = file_path.file_stem()
        .and_then(|n| n.to_str()).unwrap_or(file_name);

    let file_list = data.scanner_result.as_ref()
        .map(|r| r.flat.clone())
        .unwrap_or_default();

    // Markdown rendering happens client-side in Phase 2+
    // We just send the raw source
    emit_to_webview(app, &RenderContentPayload {
        command: "renderContent".into(),
        html: String::new(), // client-side renders from markdownSource
        markdown_source: raw,
        frontmatter: Value::Object(Default::default()),
        toc: vec![],
        file_path: path.to_string(),
        relative_path: rel_str,
        title: title.to_string(),
        file_list,
        preview_info: None,
    });

    Ok(())
}

fn handle_open_folder(app: &AppHandle, data: &mut AppData, open_first_file: bool) -> Result<(), String> {
    let folder = rfd::FileDialog::new()
        .pick_folder();
    if let Some(path) = folder {
        data.workspace_path = Some(path.clone());
        data.current_file = None;
        if open_first_file {
            let result = scan(&path, data.doc_conversion);
            if let Some(first_file) = result.flat.first() {
                data.current_file = Some(std::path::PathBuf::from(&first_file.fs_path));
            }
        }
        handle_ready(app, data)?;
    }
    Ok(())
}

fn handle_open_file(app: &AppHandle, data: &mut AppData) -> Result<(), String> {
    let mut builder = rfd::FileDialog::new();
    if data.doc_conversion {
        builder = builder.add_filter("Supported Files", &["md", "markdown", "mdx", "txt", "docx", "pdf", "html", "xlsx", "pptx", "odt", "odp", "ods", "rtf"]);
    } else {
        builder = builder.add_filter("Markdown & Text", &["md", "markdown", "mdx", "txt"]);
    }
    let file = builder.pick_file();
    if let Some(path) = file {
        let parent = path.parent().ok_or("No parent folder")?.to_path_buf();
        data.workspace_path = Some(parent);
        data.current_file = Some(path);
        handle_ready(app, data)?;
    }
    Ok(())
}

fn handle_refresh(app: &AppHandle, data: &mut AppData) -> Result<(), String> {
    let ws = data.workspace_path.clone().ok_or("No workspace")?;
    let result = scan(&ws, data.doc_conversion);
    data.scanner_result = Some(result.clone());
    data.search_index.build(&ws, &result.flat);

    // Re-emit readyAck with updated file list
    let recent = data.recents_store.get_all().to_vec();
    emit_to_webview(app, &ReadyAckPayload {
        command: "readyAck".into(),
        file_list: result.flat,
        tree: Some(result.tree),
        theme: "auto".into(),
        default_expanded: true,
        workspace_name: workspace_name(&ws),
        workspace_path: Some(ws.to_string_lossy().to_string()),
        recent_workspaces: recent,
        app_version: "1.5.3".into(),
        app_runtime: "desktop".into(),
        host_platform: host_platform().into(),
    });

    Ok(())
}

fn handle_search(app: &AppHandle, data: &mut AppData, query: &str, request_id: &str) -> Result<(), String> {
    let results = data.search_index.search(query, 50);

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct SearchResultsPayload {
        command: String,
        request_id: String,
        results: Vec<search::SearchResult>,
    }

    emit_to_webview(app, &SearchResultsPayload {
        command: "workspaceSearchResults".into(),
        request_id: request_id.to_string(),
        results,
    });

    Ok(())
}

fn handle_open_recent(app: &AppHandle, data: &mut AppData, path: &str, open_first_file: bool) -> Result<(), String> {
    let ws_path = PathBuf::from(path);
    if !ws_path.exists() {
        return Err(format!("Workspace not found: {}", path));
    }

    data.workspace_path = Some(ws_path.clone());
    data.recents_store.update_last_opened(path);
    if open_first_file {
        data.current_file = None;
        let result = scan(&ws_path, data.doc_conversion);
        if let Some(first_file) = result.flat.first() {
            data.current_file = Some(std::path::PathBuf::from(&first_file.fs_path));
        }
    }
    handle_ready(app, data)
}

fn handle_close_workspace(data: &mut AppData) -> Result<(), String> {
    data.watcher = None;
    data.workspace_path = None;
    data.scanner_result = None;
    data.current_file = None;
    data.search_index = SearchIndex::new();
    Ok(())
}

fn handle_delete_recent(data: &mut AppData, path: &str) -> Result<(), String> {
    data.recents_store.remove(path);
    Ok(())
}

// ── Dispatch ────────────────────────────────────────────────

#[tauri::command]
fn dispatch(state: State<'_, Mutex<AppData>>, app: AppHandle, command: String, payload: String) -> Result<String, String> {
    let mut data = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let msg: IncomingMessage = serde_json::from_str(&payload).unwrap_or(IncomingMessage {
        command: command.clone(),
        path: None, request_id: None, query: None,
        text: None, url: None, theme: None, theme_style: None, enabled: None,
        open_first_file: None,
    });

    let result = match command.as_str() {
        "ready" => handle_ready(&app, &mut data),
        "navigate" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            handle_navigate(&app, &mut data, p)
        }
        "openFolder" => {
            let off = msg.open_first_file.unwrap_or(false);
            handle_open_folder(&app, &mut data, off)
        }
        "openFile" => handle_open_file(&app, &mut data),
        "openPath" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            let ws = PathBuf::from(p);
            data.workspace_path = Some(ws.clone());
            let off = msg.open_first_file.unwrap_or(false);
            if off {
                data.current_file = None;
                let result = scan(&ws, data.doc_conversion);
                if let Some(first_file) = result.flat.first() {
                    data.current_file = Some(std::path::PathBuf::from(&first_file.fs_path));
                }
            }
            handle_ready(&app, &mut data)
        }
        "confirmOpenPath" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            let ws = PathBuf::from(p);
            data.workspace_path = Some(ws.clone());
            let off = msg.open_first_file.unwrap_or(false);
            if off {
                data.current_file = None;
                let result = scan(&ws, data.doc_conversion);
                if let Some(first_file) = result.flat.first() {
                    data.current_file = Some(std::path::PathBuf::from(&first_file.fs_path));
                }
            }
            handle_ready(&app, &mut data)
        }
        "openRecentWorkspace" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            let off = msg.open_first_file.unwrap_or(false);
            handle_open_recent(&app, &mut data, p, off)
        }
        "closeWorkspace" => handle_close_workspace(&mut data),
        "deleteRecentWorkspace" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            handle_delete_recent(&mut data, p)
        }
        "refresh" => handle_refresh(&app, &mut data),
        "searchWorkspace" => {
            let q = msg.query.as_deref().ok_or("Missing query")?;
            let rid = msg.request_id.as_deref().unwrap_or("0");
            handle_search(&app, &mut data, q, rid)
        }
        "setDocumentConversion" => {
            data.doc_conversion = msg.enabled.unwrap_or(false);
            // Re-scan with updated conversion setting
            handle_refresh(&app, &mut data)
        }
        "openExternal" => {
            if let Some(url) = &msg.url {
                let _ = tauri_plugin_opener::open_url(url, None::<&str>);
            }
            Ok(())
        }
        "zoom-in" => handle_zoom_in(&app, &mut data),
        "zoom-out" => handle_zoom_out(&app, &mut data),
        "window-minimize" => handle_window_minimize(&app),
        "window-maximize" => handle_window_maximize(&app),
        "window-close" => handle_window_close(&app),
        "openInEditor" => {
            let p = msg.path.as_deref().ok_or("Missing path")?;
            handle_open_in_editor(&app, p)
        }
        "replaceRecentWorkspaces" => {
            let v: Value = serde_json::from_str(&payload).unwrap_or_default();
            let recents: Vec<RecentWorkspace> = v.get("recentWorkspaces")
                .and_then(|rw| serde_json::from_value(rw.clone()).ok())
                .unwrap_or_default();
            handle_replace_recents(&mut data, &recents)
        }
        "activateWorkspace" => {
            let v: Value = serde_json::from_str(&payload).unwrap_or_default();
            let wp = v.get("workspacePath").and_then(|v| v.as_str()).ok_or("Missing workspacePath")?;
            let fp = v.get("filePath").and_then(|v| v.as_str());
            handle_activate_workspace(&app, &mut data, wp, fp)
        }
        "loadWorkspaceSearchIndexes" => {
            // Extract only what we need, then release the lock before doing I/O
            let doc_conversion = data.doc_conversion;
            drop(data);
            return handle_load_workspace_search_indexes(&app, doc_conversion, &payload)
                .map(|_| "ok".to_string());
        }
        // copyCode is no-op (handled client-side)
        // updateAppearance is no-op (handled client-side)
        // searchAcrossWorkspaces / indexWorkspaceSearchItems deferred
        _ => Err(format!("Unknown command: {}", command)),
    };

    result.map(|_| "ok".to_string())
}

// ── Entry point ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recents_dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    let last_maximized = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppData {
            workspace_path: None,
            scanner_result: None,
            current_file: None,
            search_index: SearchIndex::new(),
            recents_store: RecentWorkspacesStore::new(recents_dir),
            watcher: None,
            doc_conversion: false,
            zoom_level: 1.0,
        }))
        .invoke_handler(tauri::generate_handler![dispatch])
        .on_window_event(move |window, event| {
            if let WindowEvent::Resized(_) = event {
                if let Ok(maximized) = window.is_maximized() {
                    let last = last_maximized.load(std::sync::atomic::Ordering::Relaxed);
                    if maximized != last {
                        last_maximized.store(maximized, std::sync::atomic::Ordering::Relaxed);

                        #[derive(Serialize)]
                        #[serde(rename_all = "camelCase")]
                        struct WindowStatePayload {
                            command: String,
                            is_maximized: bool,
                        }

                        emit_to_webview(window.app_handle(), &WindowStatePayload {
                            command: "window-state-changed".into(),
                            is_maximized: maximized,
                        });
                    }
                }
            }
        })
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Markdown Explorer (Tauri)");
}

fn dirs_next() -> Option<PathBuf> {
    dirs::data_dir()
}
fn handle_zoom_in(app: &AppHandle, data: &mut AppData) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        data.zoom_level = (data.zoom_level + 0.1).min(3.0);
        window.set_zoom(data.zoom_level).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn handle_zoom_out(app: &AppHandle, data: &mut AppData) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        data.zoom_level = (data.zoom_level - 0.1).max(0.3);
        window.set_zoom(data.zoom_level).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn handle_window_minimize(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn handle_window_maximize(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn handle_window_close(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn handle_open_in_editor(_app: &AppHandle, path: &str) -> Result<(), String> {
    let _ = tauri_plugin_opener::open_path(path, None::<&str>);
    Ok(())
}

fn handle_replace_recents(data: &mut AppData, workspaces: &[RecentWorkspace]) -> Result<(), String> {
    data.recents_store.replace_all(workspaces);
    Ok(())
}

fn handle_activate_workspace(app: &AppHandle, data: &mut AppData, workspace_path: &str, file_path: Option<&str>) -> Result<(), String> {
    let ws = PathBuf::from(workspace_path);
    if !ws.exists() {
        return Err(format!("Workspace not found: {}", workspace_path));
    }
    data.workspace_path = Some(ws);
    data.recents_store.update_last_opened(workspace_path);
    handle_ready(app, data)?;
    // Navigate to specific file if provided
    if let Some(fp) = file_path {
        handle_navigate(app, data, fp)?;
    }
    Ok(())
}

// NOTE: This function must NOT hold the AppData mutex — it does directory scanning (I/O).
// The caller must drop the mutex guard before calling this.
fn handle_load_workspace_search_indexes(app: &AppHandle, doc_conversion: bool, payload: &str) -> Result<(), String> {
    let v: Value = serde_json::from_str(payload).unwrap_or_default();
    let tabs_array = match v.get("tabs").and_then(|t| t.as_array()) {
        Some(arr) => arr.clone(),
        None => return Ok(()), // no tabs to load — silently succeed
    };

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct LoadedTab {
        tab_id: String,
        workspace_path: String,
        file_list: Vec<MdFile>,
        tree: Option<scanner::FolderNode>,
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct WorkspaceSearchIndexLoadedPayload {
        command: String,
        tabs: Vec<LoadedTab>,
    }

    let mut loaded_tabs = Vec::new();

    for tab_val in &tabs_array {
        let tab_id = tab_val.get("tabId").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let ws_path_str = tab_val.get("workspacePath").and_then(|v| v.as_str()).unwrap_or("").to_string();

        if !tab_id.is_empty() && !ws_path_str.is_empty() {
            let ws_path = PathBuf::from(&ws_path_str);
            if ws_path.exists() {
                let result = scan(&ws_path, doc_conversion);
                loaded_tabs.push(LoadedTab {
                    tab_id,
                    workspace_path: ws_path_str,
                    file_list: result.flat,
                    tree: Some(result.tree),
                });
            } else {
                loaded_tabs.push(LoadedTab {
                    tab_id,
                    workspace_path: ws_path_str,
                    file_list: vec![],
                    tree: None,
                });
            }
        }
    }

    emit_to_webview(app, &WorkspaceSearchIndexLoadedPayload {
        command: "workspaceSearchIndexLoaded".into(),
        tabs: loaded_tabs,
    });

    Ok(())
}
