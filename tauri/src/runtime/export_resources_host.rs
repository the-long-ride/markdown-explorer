use super::read_workspace_resource;

pub fn handle_command(
    app: &crate::HostApp,
    state: &crate::app_state::AppState,
    cmd: &str,
    msg: &serde_json::Value,
) -> Result<bool, String> {
    let request_id = msg
        .get("requestId")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    let workspace_path = state.inner.read().workspace_path.clone();
    match cmd {
        "readWorkspaceExportResource" => {
            let result = workspace_path
                .as_deref()
                .ok_or("missing")
                .and_then(|workspace| {
                    read_workspace_resource(
                        workspace,
                        msg.get("documentPath").and_then(serde_json::Value::as_str),
                        msg.get("resourcePath")
                            .and_then(serde_json::Value::as_str)
                            .ok_or("unsupported")?,
                    )
                });
            let mut extra = serde_json::Map::new();
            extra.insert("requestId".into(), request_id.into());
            match result {
                Ok(resource) => {
                    extra.insert("ok".into(), true.into());
                    extra.insert("relativePath".into(), resource.relative_path.into());
                    extra.insert("mimeType".into(), resource.mime_type.into());
                    extra.insert("dataBase64".into(), resource.data_base64.into());
                }
                Err(reason) => {
                    extra.insert("ok".into(), false.into());
                    extra.insert("reason".into(), reason.into());
                }
            }
            crate::host_message::emit(app, "workspaceExportResourceResult", extra);
            Ok(true)
        }
        _ => Ok(false),
    }
}
