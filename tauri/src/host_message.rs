use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::workspace::open::WorkspaceUnavailableReason;
use crate::workspace::recents::RecentWorkspace;

pub fn emit(app: &AppHandle, command: &str, extra: serde_json::Map<String, Value>) {
    let mut payload = serde_json::Map::new();
    payload.insert("command".into(), command.into());
    for (k, v) in extra {
        payload.insert(k, v);
    }
    let _ = app.emit("host-message", json!(payload));
}

pub fn emit_ready_ack(
    app: &AppHandle,
    file_list: Value,
    tree: Value,
    theme: &str,
    default_expanded: Value,
    workspace_name: &str,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("fileList".into(), file_list);
    extra.insert("tree".into(), tree);
    extra.insert("theme".into(), theme.into());
    extra.insert("defaultExpanded".into(), default_expanded);
    extra.insert("workspaceName".into(), workspace_name.into());
    emit(app, "readyAck", extra);
}

#[allow(clippy::too_many_arguments)]
pub fn emit_ready_ack_full(
    app: &AppHandle,
    file_list: Value,
    tree: Value,
    workspace_name: &str,
    workspace_path: Option<&str>,
    recent_workspaces: Vec<RecentWorkspace>,
    document_conversion_enabled: bool,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("fileList".into(), file_list);
    extra.insert("tree".into(), tree);
    extra.insert("theme".into(), "dark".into());
    extra.insert("themeStyle".into(), "default".into());
    extra.insert("defaultExpanded".into(), true.into());
    extra.insert("workspaceName".into(), workspace_name.into());
    if let Some(wp) = workspace_path {
        extra.insert("workspacePath".into(), wp.into());
    }
    extra.insert("recentWorkspaces".into(), json!(recent_workspaces));
    extra.insert(
        "documentConversionEnabled".into(),
        document_conversion_enabled.into(),
    );
    extra.insert("appRuntime".into(), "tauri".into());
    extra.insert("appVersion".into(), app.package_info().version.to_string().into());
    extra.insert("hostPlatform".into(), std::env::consts::OS.into());
    extra.insert("hostArch".into(), std::env::consts::ARCH.into());
    extra.insert(
        "canInstallUpdates".into(),
        crate::update::manager::can_install_updates().into(),
    );
    extra.insert("isMaximized".into(), false.into());
    emit(app, "readyAck", extra);
}

pub fn emit_loading(app: &AppHandle, label: &str, detail: Option<&str>) {
    let mut extra = serde_json::Map::new();
    extra.insert("label".into(), label.into());
    if let Some(detail) = detail {
        extra.insert("detail".into(), detail.into());
    }
    emit(app, "setLoading", extra);
}

pub fn emit_recent_workspaces_changed(app: &AppHandle, recent_workspaces: Vec<RecentWorkspace>) {
    let mut extra = serde_json::Map::new();
    extra.insert("recentWorkspaces".into(), json!(recent_workspaces));
    emit(app, "recentWorkspacesChanged", extra);
}

pub fn emit_workspace_unavailable(
    app: &AppHandle,
    workspace_path: &str,
    reason: WorkspaceUnavailableReason,
    recent_workspaces: Vec<RecentWorkspace>,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("workspacePath".into(), workspace_path.into());
    extra.insert(
        "workspaceName".into(),
        std::path::Path::new(workspace_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                if workspace_path.is_empty() {
                    "Workspace".into()
                } else {
                    workspace_path.into()
                }
            })
            .into(),
    );
    extra.insert("reason".into(), json!(reason));
    extra.insert("recentWorkspaces".into(), json!(recent_workspaces));
    extra.insert("appRuntime".into(), "tauri".into());
    extra.insert("appVersion".into(), app.package_info().version.to_string().into());
    extra.insert("hostPlatform".into(), std::env::consts::OS.into());
    extra.insert("hostArch".into(), std::env::consts::ARCH.into());
    extra.insert(
        "canInstallUpdates".into(),
        crate::update::manager::can_install_updates().into(),
    );
    extra.insert("isMaximized".into(), false.into());
    emit(app, "workspaceUnavailable", extra);
}

pub fn emit_render_content_empty_welcome(app: &AppHandle, file_list: Value) {
    let mut extra = serde_json::Map::new();
    extra.insert("html".into(), "".into());
    extra.insert("markdownSource".into(), "".into());
    extra.insert("frontmatter".into(), json!({}));
    extra.insert("toc".into(), json!([]));
    extra.insert("filePath".into(), "".into());
    extra.insert("relativePath".into(), "Welcome Page".into());
    extra.insert("title".into(), "Welcome".into());
    extra.insert("fileList".into(), file_list);
    extra.insert("previewInfo".into(), Value::Null);
    emit(app, "renderContent", extra);
}

pub fn emit_workspace_files_changed(
    app: &AppHandle,
    file_list: Value,
    tree: Value,
    workspace_name: &str,
    workspace_path: &str,
    document_conversion_enabled: bool,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("fileList".into(), file_list);
    extra.insert("tree".into(), tree);
    extra.insert("workspaceName".into(), workspace_name.into());
    extra.insert("workspacePath".into(), workspace_path.into());
    extra.insert(
        "documentConversionEnabled".into(),
        document_conversion_enabled.into(),
    );
    emit(app, "workspaceFilesChanged", extra);
}

pub fn emit_current_file_changed(app: &AppHandle, file_path: &str) {
    let mut extra = serde_json::Map::new();
    extra.insert("filePath".into(), file_path.into());
    emit(app, "currentFileChanged", extra);
}

pub fn emit_nav_not_found(app: &AppHandle, href: &str) {
    let mut extra = serde_json::Map::new();
    extra.insert("href".into(), href.into());
    emit(app, "navNotFound", extra);
}

pub fn emit_workspace_search_results(app: &AppHandle, request_id: &str, results: Value) {
    let mut extra = serde_json::Map::new();
    extra.insert("requestId".into(), request_id.into());
    extra.insert("results".into(), results);
    emit(app, "workspaceSearchResults", extra);
}

pub fn emit_cross_tab_search_results_batch(app: &AppHandle, request_id: &str, results: Value) {
    let mut extra = serde_json::Map::new();
    extra.insert("requestId".into(), request_id.into());
    extra.insert("results".into(), results);
    extra.insert("done".into(), false.into());
    emit(app, "crossTabSearchResults", extra);
}

pub fn emit_cross_tab_search_results_done(
    app: &AppHandle,
    request_id: &str,
    total: usize,
    truncated: bool,
    cancelled: bool,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("requestId".into(), request_id.into());
    extra.insert("results".into(), json!([]));
    extra.insert("done".into(), true.into());
    extra.insert("total".into(), total.into());
    extra.insert("truncated".into(), truncated.into());
    extra.insert("cancelled".into(), cancelled.into());
    emit(app, "crossTabSearchResults", extra);
}

pub fn emit_workspace_search_index_loaded(
    app: &AppHandle,
    tab_id: &str,
    workspace_path: &str,
    file_list: Value,
    tree: Value,
) {
    let mut extra = serde_json::Map::new();
    extra.insert(
        "tabs".into(),
        json!([{
            "tabId": tab_id,
            "workspacePath": workspace_path,
            "fileList": file_list,
            "tree": tree,
        }]),
    );
    emit(app, "workspaceSearchIndexLoaded", extra);
}

pub fn emit_window_state_changed(app: &AppHandle, is_maximized: bool) {
    let mut extra = serde_json::Map::new();
    extra.insert("isMaximized".into(), is_maximized.into());
    emit(app, "window-state-changed", extra);
}

pub fn emit_fullscreen_changed(app: &AppHandle, is_fullscreen: bool) {
    let mut extra = serde_json::Map::new();
    extra.insert("isFullscreen".into(), is_fullscreen.into());
    emit(app, "fullscreenChanged", extra);
}
