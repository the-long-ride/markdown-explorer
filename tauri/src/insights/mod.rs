pub mod scan;

use crate::app_state::AppState;
use crate::host_message;
use crate::workspace::watch::WorkspaceWatchController;
use crate::HostApp;
use serde_json::{json, Map, Value};
use std::path::PathBuf;

fn workspace_root(state: &AppState) -> Option<PathBuf> {
    let workspace = state.inner.read().workspace_path.clone()?;
    if !workspace.exists() {
        return None;
    }
    let base = if workspace.is_file() {
        workspace.parent().unwrap_or(&workspace).to_path_buf()
    } else {
        workspace
    };
    std::fs::canonicalize(base).ok()
}

fn emit_value(app: &HostApp, command: &str, value: Value) {
    let extra = value.as_object().cloned().unwrap_or_else(Map::new);
    host_message::emit(app, command, extra);
}

pub async fn handle_command(
    app: &HostApp,
    state: &AppState,
    command: &str,
    message: &Value,
) -> Result<bool, String> {
    match command {
        "scanInsightsWorkspace" => {
            let request_id = message
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let user_patterns = message
                .get("userPatterns")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(ToOwned::to_owned)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            {
                state
                    .inner
                    .write()
                    .insights_cancelled_scans
                    .remove(&request_id);
            }
            let Some(root) = workspace_root(state) else {
                emit_value(
                    app,
                    "insightsScanComplete",
                    json!({
                        "requestId": request_id,
                        "totalEntries": 0,
                        "excludedEntries": 0,
                        "skippedEntries": 0,
                        "truncated": false
                    }),
                );
                return Ok(true);
            };
            let state_for_cancel = state.clone();
            let request_for_cancel = request_id.clone();
            let root_for_scan = root.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                scan::scan_workspace(&root_for_scan, &user_patterns, || {
                    state_for_cancel
                        .inner
                        .read()
                        .insights_cancelled_scans
                        .contains(&request_for_cancel)
                })
            })
            .await
            .map_err(|error| format!("insights scan task failed: {error}"))?;

            for chunk in result.entries.chunks(scan::SCAN_BATCH_SIZE) {
                emit_value(
                    app,
                    "insightsScanBatch",
                    json!({
                        "requestId": request_id,
                        "entries": chunk,
                        "scannedEntries": result.entries.len(),
                        "excludedEntries": result.excluded_entries
                    }),
                );
            }
            state
                .inner
                .write()
                .insights_cancelled_scans
                .remove(&request_id);
            emit_value(
                app,
                "insightsScanComplete",
                json!({
                    "requestId": request_id,
                    "totalEntries": result.entries.len(),
                    "excludedEntries": result.excluded_entries,
                    "skippedEntries": result.skipped_entries,
                    "truncated": false,
                    "cancelled": result.cancelled
                }),
            );
            Ok(true)
        }
        "cancelInsightsScan" => {
            if let Some(request_id) = message.get("requestId").and_then(Value::as_str) {
                state
                    .inner
                    .write()
                    .insights_cancelled_scans
                    .insert(request_id.to_string());
            }
            Ok(true)
        }
        "readInsightsDocumentSource" => {
            let request_id = message
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or("");
            let relative_path = message
                .get("relativePath")
                .and_then(Value::as_str)
                .unwrap_or("");
            let Some(root) = workspace_root(state) else {
                emit_value(
                    app,
                    "insightsDocumentSourceResult",
                    json!({
                        "requestId": request_id,
                        "relativePath": relative_path,
                        "status": "missing"
                    }),
                );
                return Ok(true);
            };
            let soft_limit = message
                .get("softLimitBytes")
                .and_then(Value::as_u64)
                .unwrap_or(scan::DEFAULT_SOFT_LIMIT_BYTES);
            let hard_limit = message
                .get("hardLimitBytes")
                .and_then(Value::as_u64)
                .unwrap_or(scan::DEFAULT_HARD_LIMIT_BYTES);
            let mut result =
                scan::read_document_source(&root, relative_path, soft_limit, hard_limit)
                    .as_object()
                    .cloned()
                    .unwrap_or_default();
            result.insert("requestId".into(), request_id.into());
            result.insert("relativePath".into(), relative_path.into());
            host_message::emit(app, "insightsDocumentSourceResult", result);
            Ok(true)
        }
        "probeWorkspaceResource" => {
            let request_id = message
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or("");
            let document_path = message
                .get("documentPath")
                .and_then(Value::as_str)
                .unwrap_or("");
            let resource_path = message
                .get("resourcePath")
                .and_then(Value::as_str)
                .unwrap_or("");
            let Some(root) = workspace_root(state) else {
                emit_value(
                    app,
                    "workspaceResourceProbeResult",
                    json!({
                        "requestId": request_id,
                        "status": "missing"
                    }),
                );
                return Ok(true);
            };
            let mut result = scan::probe_resource(&root, document_path, resource_path)
                .as_object()
                .cloned()
                .unwrap_or_default();
            result.insert("requestId".into(), request_id.into());
            host_message::emit(app, "workspaceResourceProbeResult", result);
            Ok(true)
        }
        "setInsightsWatchState" => {
            let request_id = message
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let workspace_operation_id = message
                .get("workspaceOperationId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let active = message
                .get("active")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            if let Some(existing) = state.inner.write().insights_watch_controller.take() {
                existing.dispose();
            }

            let Some(root) = workspace_root(state) else {
                emit_value(
                    app,
                    "insightsRuntimeCapabilities",
                    json!({
                        "requestId": request_id,
                        "capabilities": {"fileChanges": "unsupported", "externalLinkChecking": true, "documentPreviewReuse": true}
                    }),
                );
                return Ok(true);
            };

            if active {
                let app_for_watch = app.clone();
                let request_for_watch = request_id.clone();
                let operation_for_watch = workspace_operation_id.clone();
                let root_for_watch = root.clone();
                let controller = WorkspaceWatchController::new(120, move |_workspace, change| {
                    let Some(change) = change else {
                        return;
                    };
                    let path = PathBuf::from(&change.fs_path);
                    let delta = if !change.fs_path.is_empty() && !path.exists() {
                        json!({"kind": "delete", "relativePath": change.relative_path})
                    } else if let Some(entry) = scan::entry_for_path(&root_for_watch, &path) {
                        json!({"kind": "update", "entry": entry})
                    } else {
                        return;
                    };
                    let mut payload = json!({
                        "requestId": request_for_watch,
                        "deltas": [delta]
                    });
                    if let (Some(operation), Some(object)) =
                        (operation_for_watch.as_ref(), payload.as_object_mut())
                    {
                        object.insert("workspaceOperationId".into(), operation.clone().into());
                    }
                    emit_value(&app_for_watch, "insightsFsDelta", payload);
                });
                controller.watch_workspace(Some(&root));
                state.inner.write().insights_watch_controller = Some(controller);
            }

            emit_value(
                app,
                "insightsRuntimeCapabilities",
                json!({
                    "requestId": request_id,
                    "capabilities": {"fileChanges": if active {"native"} else {"native"}, "externalLinkChecking": true, "documentPreviewReuse": true}
                }),
            );
            Ok(true)
        }
        _ => Ok(false),
    }
}
