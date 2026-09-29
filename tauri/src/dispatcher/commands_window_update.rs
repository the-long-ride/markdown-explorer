use super::*;

impl Dispatcher {
    pub(super) fn handle_window_update_command(&self, cmd: &str, msg: &Value) -> Result<bool, String> {
        match cmd {
            // ── C4: Window / Zoom ──
            "window-minimize" => {
                if let Some(window) = self.app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
            "window-maximize" => {
                if let Some(window) = self.app.get_webview_window("main") {
                    if let Ok(true) = window.is_fullscreen() {
                        self.state.inner.write().fullscreen_transition = FullscreenTransition::Idle;
                        if window.set_fullscreen(false).is_ok() {
                            host_message::emit_fullscreen_changed(&self.app, false);
                        }
                    } else if let Ok(true) = window.is_maximized() {
                        let _ = window.unmaximize();
                    } else {
                        let _ = window.maximize();
                    }
                }
            }
            "window-close" => {
                // `WebviewWindow::close` emits CloseRequested first, so this goes through the same
                // native close guard as the title bar and Alt+F4.
                if let Some(window) = self.app.get_webview_window("main") {
                    let _ = window.close();
                }
            }
            "confirmNativeClose" => {
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or_default();
                let intent = msg.get("intent").and_then(Value::as_str).unwrap_or_default();
                let cancelled = msg.get("cancelled").and_then(Value::as_bool) == Some(true);
                let outcome = self
                    .state
                    .close_guard
                    .lock()
                    .confirm(request_id, intent, cancelled);
                if outcome == crate::runtime::close_guard::ConfirmOutcome::Approved {
                    // The guard now lets exactly one close through (update-on-close still applies).
                    if let Some(window) = self.app.get_webview_window("main") {
                        let _ = window.close();
                    }
                }
            }
            "toggle-fullscreen" => {
                let app = self.app.clone();
                let state = self.state.clone();
                let _ = self.app.run_on_main_thread(move || {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Ok(is_fullscreen) = window.is_fullscreen() {
                            if is_fullscreen {
                                if window.set_fullscreen(false).is_ok() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                    host_message::emit_fullscreen_changed(&app, false);
                                }
                            } else if window.is_maximized().unwrap_or(false) {
                                state.inner.write().fullscreen_transition =
                                    FullscreenTransition::AwaitingUnmaximize;
                                if window.unmaximize().is_err() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                }
                            } else {
                                state.inner.write().fullscreen_transition =
                                    FullscreenTransition::AwaitingMaximize;
                                if window.maximize().is_err() {
                                    state.inner.write().fullscreen_transition =
                                        FullscreenTransition::Idle;
                                }
                            }
                        }
                    }
                });
            }
            "zoom-in" => {
                self.handle_zoom(1);
            }
            "zoom-out" => {
                self.handle_zoom(-1);
            }
            "zoom-reset" => {
                self.handle_reset_zoom();
            }
            // ── C3: Update ──
            "downloadUpdate" => {
                let version = msg
                    .get("version")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                crate::update::manager::UpdateManager::start_download(
                    self.app.clone(),
                    self.state.clone(),
                    version,
                );
            }
            "scheduleDownloadedUpdate" => {
                if let Err(error) =
                    crate::update::manager::UpdateManager::schedule_downloaded_update(
                        &self.app,
                        &self.state,
                    )
                {
                    let version = self
                        .state
                        .inner
                        .read()
                        .update_state
                        .version
                        .clone()
                        .unwrap_or_default();
                    let error_state = crate::update::UpdateState::error_state(&version, &error);
                    self.state.inner.write().update_state = error_state.clone();
                    crate::update::manager::UpdateManager::emit_state(&self.app, &error_state);
                }
            }
            "restartAndApplyUpdate" => {
                crate::update::manager::UpdateManager::restart_and_apply_update(
                    self.app.clone(),
                    self.state.clone(),
                );
            }
            "updateAppearance" => {}
            _ => return Ok(false),
        }
        Ok(true)
    }
}
