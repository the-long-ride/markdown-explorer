use super::*;

impl Dispatcher {
    pub(super) fn handle_zoom(&self, direction: i8) {
        const ZOOM_STEP: f64 = 0.2;
        const ZOOM_MIN: f64 = -2.5;
        const ZOOM_MAX: f64 = 2.0;
        let current = self.state.inner.read().zoom_level;
        let next = ((current + direction as f64 * ZOOM_STEP).clamp(ZOOM_MIN, ZOOM_MAX) / ZOOM_STEP)
            .round()
            * ZOOM_STEP;
        self.state.inner.write().zoom_level = next;
        if let Some(window) = self.app.get_webview_window("main") {
            let _ = window.set_zoom(1.2_f64.powf(next));
        }
    }

    pub(super) fn handle_reset_zoom(&self) {
        self.state.inner.write().zoom_level = 0.0;
        if let Some(window) = self.app.get_webview_window("main") {
            let _ = window.set_zoom(1.0);
        }
    }

    pub(super) async fn handle_set_document_conversion(&self, msg: &Value) {
        let enabled = msg.get("enabled").and_then(Value::as_bool).unwrap_or(false);
        if self.state.inner.read().document_conversion_enabled == enabled {
            return;
        }
        self.state.inner.write().document_conversion_enabled = enabled;
        if self.state.inner.read().workspace_path.is_none() {
            return;
        }
        host_message::emit_loading(
            &self.app,
            if enabled {
                "Finding supported documents..."
            } else {
                "Refreshing Markdown files..."
            },
            None,
        );
        if !self.is_current_file_still_available() {
            self.state.inner.write().current_file = None;
        }
        self.send_workspace_data(false);
    }
}
