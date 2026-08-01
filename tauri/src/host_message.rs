use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::workspace::open::WorkspaceUnavailableReason;
use crate::workspace::recents::RecentWorkspace;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkspaceOperationMetadata {
    pub operation_id: String,
    pub tab_id: String,
}

impl WorkspaceOperationMetadata {
    pub fn from_parts(operation_id: Option<&str>, tab_id: Option<&str>) -> Option<Self> {
        Some(Self {
            operation_id: operation_id?.to_owned(),
            tab_id: tab_id?.to_owned(),
        })
    }
}

pub fn current_workspace_operation(app: &AppHandle) -> Option<WorkspaceOperationMetadata> {
    let state = app.state::<crate::app_state::AppState>();
    let inner = state.inner.read();
    WorkspaceOperationMetadata::from_parts(
        inner.workspace_operation_id.as_deref(),
        inner.workspace_tab_id.as_deref(),
    )
}

fn dispatch_native_host_message(app: &AppHandle, payload: &Value) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(payload_json) = serde_json::to_string(payload) else {
        return;
    };
    let script = format!(
        "window.__markdownExplorerHandleHostMessage?.({payload_json});"
    );
    let _ = window.eval(script);
}

pub fn emit_scoped(
    app: &AppHandle,
    command: &str,
    extra: serde_json::Map<String, Value>,
    operation: Option<&WorkspaceOperationMetadata>,
) {
    let mut payload = serde_json::Map::new();
    payload.insert("command".into(), command.into());
    for (k, v) in extra {
        payload.insert(k, v);
    }
    if let Some(operation) = operation {
        payload.insert(
            "workspaceOperationId".into(),
            operation.operation_id.clone().into(),
        );
        payload.insert("workspaceTabId".into(), operation.tab_id.clone().into());
    }
    dispatch_native_host_message(app, &Value::Object(payload));
}

pub fn emit(app: &AppHandle, command: &str, extra: serde_json::Map<String, Value>) {
    let operation = current_workspace_operation(app);
    emit_scoped(app, command, extra, operation.as_ref());
}

pub fn emit_ready_ack_scoped(
    app: &AppHandle,
    ready_ack: &Value,
    operation: Option<&WorkspaceOperationMetadata>,
) {
    const READY_ACK_FIELDS: &[&str] = &[
        "fileList",
        "tree",
        "theme",
        "themeStyle",
        "defaultExpanded",
        "workspaceName",
        "workspacePath",
        "recentWorkspaces",
        "documentConversionEnabled",
        "appRuntime",
        "appVersion",
        "hostPlatform",
        "hostArch",
        "isMaximized",
    ];

    let mut extra = serde_json::Map::new();
    for field in READY_ACK_FIELDS {
        if let Some(value) = ready_ack.get(*field) {
            extra.insert((*field).into(), value.clone());
        }
    }
    emit_scoped(app, "readyAck", extra, operation);
}

pub fn emit_loading_scoped(
    app: &AppHandle,
    label: &str,
    detail: Option<&str>,
    operation: Option<&WorkspaceOperationMetadata>,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("label".into(), label.into());
    if let Some(detail) = detail {
        extra.insert("detail".into(), detail.into());
    }
    emit_scoped(app, "setLoading", extra, operation);
}

pub fn emit_loading(app: &AppHandle, label: &str, detail: Option<&str>) {
    let operation = current_workspace_operation(app);
    emit_loading_scoped(app, label, detail, operation.as_ref());
}

pub fn emit_workspace_scan_progress_scoped(
    app: &AppHandle,
    scanned_files: usize,
    active: bool,
    operation: Option<&WorkspaceOperationMetadata>,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("scannedFiles".into(), scanned_files.into());
    extra.insert("active".into(), active.into());
    emit_scoped(app, "workspaceScanProgress", extra, operation);
}

pub fn emit_recent_workspaces_changed(app: &AppHandle, recent_workspaces: Vec<RecentWorkspace>) {
    let mut extra = serde_json::Map::new();
    extra.insert("recentWorkspaces".into(), json!(recent_workspaces));
    emit(app, "recentWorkspacesChanged", extra);
}

pub fn emit_workspace_unavailable_scoped(
    app: &AppHandle,
    workspace_path: &str,
    reason: WorkspaceUnavailableReason,
    recent_workspaces: Vec<RecentWorkspace>,
    operation: Option<&WorkspaceOperationMetadata>,
) {
    let mut extra = serde_json::Map::new();
    extra.insert("workspacePath".into(), workspace_path.into());
    extra.insert(
        "workspaceName".into(),
        std::path::Path::new(workspace_path)
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .filter(|name| !name.is_empty())
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
    extra.insert(
        "appVersion".into(),
        app.package_info().version.to_string().into(),
    );
    extra.insert("hostPlatform".into(), std::env::consts::OS.into());
    extra.insert("hostArch".into(), std::env::consts::ARCH.into());
    extra.insert(
        "canInstallUpdates".into(),
        crate::update::manager::can_install_updates().into(),
    );
    extra.insert("isMaximized".into(), false.into());
    emit_scoped(app, "workspaceUnavailable", extra, operation);
}

pub fn emit_render_content_empty_welcome_scoped(
    app: &AppHandle,
    file_list: Value,
    operation: Option<&WorkspaceOperationMetadata>,
) {
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
    emit_scoped(app, "renderContent", extra, operation);
}

#[allow(clippy::too_many_arguments)]
pub fn emit_workspace_files_changed_scoped(
    app: &AppHandle,
    file_list: Value,
    tree: Value,
    workspace_name: &str,
    workspace_path: &str,
    document_conversion_enabled: bool,
    operation: Option<&WorkspaceOperationMetadata>,
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
    emit_scoped(app, "workspaceFilesChanged", extra, operation);
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

pub fn emit_external_open_path(app: &AppHandle, path: &str) {
    let mut extra = serde_json::Map::new();
    extra.insert("path".into(), path.into());
    emit(app, "externalOpenPath", extra);
}
