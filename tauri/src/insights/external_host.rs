use crate::app_state::AppState;
use crate::host_message;
use crate::insights_external::{
    check_url, origin_for_url, DEFAULT_TIMEOUT_MS, GLOBAL_CONCURRENCY, ORIGIN_CONCURRENCY,
};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

fn emit_value(app: &AppHandle, command: &str, value: Value) {
    let extra = value.as_object().cloned().unwrap_or_else(Map::new);
    host_message::emit(app, command, extra);
}

pub async fn handle_command(
    app: &AppHandle,
    state: &AppState,
    command: &str,
    message: &Value,
) -> Result<bool, String> {
    match command {
        "checkExternalLinks" => {
            let request_id = message
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let timeout_ms = message
                .get("timeoutMs")
                .and_then(Value::as_u64)
                .unwrap_or(DEFAULT_TIMEOUT_MS);
            let approved = message
                .get("approvedPrivateOrigins")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(ToOwned::to_owned)
                        .collect::<HashSet<_>>()
                })
                .unwrap_or_default();
            let mut urls = message
                .get("urls")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(ToOwned::to_owned)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let mut seen = HashSet::new();
            urls.retain(|url| seen.insert(url.clone()));
            state
                .inner
                .write()
                .insights_cancelled_external_checks
                .remove(&request_id);

            let global = Arc::new(Semaphore::new(GLOBAL_CONCURRENCY));
            let mut by_origin: HashMap<String, Arc<Semaphore>> = HashMap::new();
            let mut tasks = JoinSet::new();

            for url in urls {
                let origin = origin_for_url(&url);
                let origin_limit = by_origin
                    .entry(origin)
                    .or_insert_with(|| Arc::new(Semaphore::new(ORIGIN_CONCURRENCY)))
                    .clone();
                let global_limit = global.clone();
                let approved = approved.clone();
                let state_for_task = state.clone();
                let request_for_task = request_id.clone();
                tasks.spawn(async move {
                    let _global_permit = global_limit.acquire_owned().await.ok()?;
                    let _origin_permit = origin_limit.acquire_owned().await.ok()?;
                    if state_for_task
                        .inner
                        .read()
                        .insights_cancelled_external_checks
                        .contains(&request_for_task)
                    {
                        return None;
                    }
                    let result = tauri::async_runtime::spawn_blocking(move || {
                        check_url(&url, timeout_ms, &approved)
                    })
                    .await
                    .ok()?;
                    Some(result)
                });
            }

            while let Some(joined) = tasks.join_next().await {
                let cancelled = state
                    .inner
                    .read()
                    .insights_cancelled_external_checks
                    .contains(&request_id);
                if cancelled {
                    continue;
                }
                if let Ok(Some(mut result)) = joined {
                    if let Some(object) = result.as_object_mut() {
                        object.insert("requestId".into(), request_id.clone().into());
                    }
                    emit_value(app, "externalLinkCheckResult", result);
                }
            }

            let cancelled = state
                .inner
                .write()
                .insights_cancelled_external_checks
                .remove(&request_id);
            emit_value(
                app,
                "externalLinkCheckComplete",
                json!({"requestId": request_id, "cancelled": cancelled}),
            );
            Ok(true)
        }
        "cancelExternalLinkChecks" => {
            if let Some(request_id) = message.get("requestId").and_then(Value::as_str) {
                state
                    .inner
                    .write()
                    .insights_cancelled_external_checks
                    .insert(request_id.to_string());
            }
            Ok(true)
        }
        _ => Ok(false),
    }
}
