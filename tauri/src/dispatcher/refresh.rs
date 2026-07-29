use super::*;

impl Dispatcher {
    pub(super) async fn refresh_from_watch(
        &self,
        _workspace_path: PathBuf,
        change: Option<WatchChange>,
    ) {
        let changed_path = change.as_ref().map(|c| c.fs_path.as_str()).unwrap_or("");
        let doc_conv = self.state.inner.read().document_conversion_enabled;

        if !is_watch_change_relevant(changed_path, doc_conv) {
            return;
        }

        self.refresh_active_workspace(true, changed_path).await;
    }

    pub(super) async fn refresh_active_workspace(
        &self,
        preserve_current_content: bool,
        changed_path: &str,
    ) {
        let workspace_path = {
            let state = self.state.inner.read();
            state.workspace_path.clone()
        };
        let Some(workspace_path) = workspace_path else {
            return;
        };

        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(
                &workspace_path,
                status.reason.unwrap_or(WorkspaceUnavailableReason::Missing),
            );
            return;
        }

        if preserve_current_content {
            if !self.send_workspace_files_changed() {
                return;
            }
            let current_file_still_available = self.is_current_file_still_available();
            let current_file = self.state.inner.read().current_file.clone();
            let cf_str = current_file.as_ref().and_then(|p| p.to_str());
            if should_notify_current_file_changed(
                cf_str,
                changed_path,
                current_file_still_available,
            ) {
                if let Some(ref cf) = current_file {
                    host_message::emit_current_file_changed(&self.app, &cf.to_string_lossy());
                }
            }
            return;
        }

        if !self.is_current_file_still_available() {
            self.state.inner.write().current_file = None;
        }
        self.send_workspace_data(false);
    }

    pub(super) async fn handle_refresh(&self) {
        self.refresh_active_workspace(false, "").await;
    }
}
