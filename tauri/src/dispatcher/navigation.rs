use super::*;

impl Dispatcher {
    pub(super) async fn handle_navigate(&self, file_path: &str) {
        if file_path.is_empty() {
            self.state.inner.write().current_file = None;
            self.send_welcome();
            return;
        }

        let current_file = self.state.inner.read().current_file.clone();
        let base_dir = self.get_workspace_base_dir();
        let resolved = if let Some(ref base) = base_dir {
            navigation::resolve_navigation_path(base, current_file.as_deref(), file_path)
        } else {
            PathBuf::from(navigation::decode_navigation_path(
                navigation::strip_navigation_fragment(file_path),
            ))
        };

        let doc_conv = self.state.inner.read().document_conversion_enabled;
        let exists = resolved.exists();
        let supported = exists
            && resolved.is_file()
            && crate::workspace::file_types::is_supported_file_path(
                &resolved.to_string_lossy(),
                doc_conv,
            );
        if supported {
            self.state.inner.write().current_file = Some(resolved);
            self.send_content();
        } else {
            host_message::emit_nav_not_found(&self.app, &resolved.to_string_lossy());
        }
    }
}
