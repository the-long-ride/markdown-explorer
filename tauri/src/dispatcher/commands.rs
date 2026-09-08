use super::*;

#[path = "document_write.rs"]
pub(super) mod document_write;
#[path = "git_history.rs"]
mod git_history;

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
        if cmd == "saveDocument" {
            self.handle_save_document(&msg);
            return Ok(());
        }
        if git_history::handle_command(&self.app, &self.state, cmd, &msg)? {
            return Ok(());
        }
        if self.handle_workspace_command(cmd, &msg).await? {
            return Ok(());
        }
        if crate::insights_external_host::handle_command(&self.app, &self.state, cmd, &msg).await? {
            return Ok(());
        }
        if crate::insights::handle_command(&self.app, &self.state, cmd, &msg).await? {
            return Ok(());
        }
        if crate::runtime::export_resources::handle_command(&self.app, &self.state, cmd, &msg)? {
            return Ok(());
        }
        if self.handle_external_command(cmd, &msg).await? {
            return Ok(());
        }
        if self.handle_window_update_command(cmd, &msg)? {
            return Ok(());
        }
        eprintln!("[dispatcher] unknown command: {cmd}");
        Ok(())
    }
}