use super::*;
use crate::host_message::WorkspaceOperationMetadata;

impl Dispatcher {
    pub(super) async fn handle_ready(&self, msg: &Value) {
        let requested_operation = WorkspaceOperationMetadata::from_parts(
            msg.get("workspaceOperationId").and_then(Value::as_str),
            msg.get("workspaceTabId").and_then(Value::as_str),
        );
        let operation = requested_operation.or_else(|| host_message::current_workspace_operation(&self.app));
        if let Some(enabled) = msg
            .get("documentConversionEnabled")
            .and_then(Value::as_bool)
        {
            self.state.inner.write().document_conversion_enabled = enabled;
        }
        if self.state.inner.read().ready_handled {
            return;
        }
        self.state.inner.write().ready_handled = true;

        let config_dir = self.app.path().app_config_dir().unwrap_or_default();
        let update_state =
            crate::update::manager::UpdateManager::restore_and_emit(&self.app, &config_dir);
        self.state.inner.write().update_state = update_state;

        let (workspace_path, document_conversion_enabled) = {
            let state = self.state.inner.read();
            (
                state.workspace_path.clone(),
                state.document_conversion_enabled,
            )
        };
        let recent_workspaces = self.recents_store().load();
        let is_maximized = self
            .app
            .get_webview_window("main")
            .and_then(|window| window.is_maximized().ok())
            .unwrap_or(false);
        let package_info = self.app.package_info();
        let ack = crate::runtime::startup::create_startup_ready_ack(
            workspace_path.as_deref(),
            recent_workspaces,
            document_conversion_enabled,
            std::env::consts::OS,
            std::env::consts::ARCH,
            is_maximized,
            &package_info.version.to_string(),
        );
        host_message::emit_ready_ack_scoped(&self.app, &ack, operation.as_ref());
        let external_open_request = self.state.inner.write().external_open_request.take();
        if let Some(request) = external_open_request {
            crate::runtime::external_open::emit_external_open_request(&self.app, &request);
        }
        self.state.inner.read().perf.mark("tauri:readyAck");

        if workspace_path.is_some() {
            host_message::emit_loading_scoped(
                &self.app,
                "Loading workspace...",
                None,
                operation.as_ref(),
            );
            self.ensure_workspace_watch();
            self.bind_watch();
            self.send_workspace_data(false);
        } else {
            host_message::emit_render_content_empty_welcome_scoped(
                &self.app,
                json!([]),
                operation.as_ref(),
            );
        }
    }
}
