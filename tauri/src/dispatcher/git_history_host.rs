use super::{empty_list_field, execute_command, result_command};

pub(crate) async fn handle_command(
    app: &tauri::AppHandle,
    state: &crate::app_state::AppState,
    cmd: &str,
    msg: &serde_json::Value,
) -> Result<bool, String> {
    let Some(result_command) = result_command(cmd) else {
        return Ok(false);
    };
    let request_id = msg
        .get("requestId")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let workspace_path = state.inner.read().workspace_path.clone();
    let (command, message) = (cmd.to_owned(), msg.clone());
    // Git can take seconds on large repositories: keep it off the async dispatcher threads.
    let joined = tauri::async_runtime::spawn_blocking(move || {
        execute_command(&command, workspace_path.as_deref(), &message)
    })
    .await;
    let mut extra = match joined {
        Ok(extra) => extra,
        Err(err) => {
            let mut extra = serde_json::Map::new();
            extra.insert("ok".into(), false.into());
            if let Some(field) = empty_list_field(cmd) {
                extra.insert(field.into(), serde_json::json!([]));
            }
            extra.insert("reason".into(), "git-command-failed".into());
            eprintln!("[git-history] {cmd} task failed: {err}");
            extra
        }
    };
    extra.insert("requestId".into(), request_id.into());
    crate::host_message::emit(app, result_command, extra);
    Ok(true)
}
