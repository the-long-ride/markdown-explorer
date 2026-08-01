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
                if let Some(window) = self.app.get_webview_window("main") {
                    let _ = window.close();
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
            // ── C3: Update ──
            "downloadUpdate" => {
                let version = msg
                    .get("version")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let url = msg
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !version.is_empty() && !url.is_empty() {
                    let file_name = url.split('/').last().unwrap_or("update.msi").to_string();
                    let staging_dir = self
                        .app
                        .path()
                        .app_data_dir()
                        .unwrap_or_default()
                        .join("staged");
                    let staged_file_path = staging_dir.join(&file_name);
                    let new_state =
                        crate::update::UpdateState::downloading(&version, &file_name, 0)
                            .with_staged_file_path(staged_file_path.to_string_lossy());
                    {
                        self.state.inner.write().update_state = new_state.clone();
                    }
                    crate::update::manager::UpdateManager::emit_state(&self.app, &new_state);

                    crate::update::manager::UpdateManager::start_download(
                        self.app.clone(),
                        &version,
                        &url,
                        staging_dir,
                    );
                }
            }
            "scheduleDownloadedUpdate" => {
                let state = self.state.inner.read().update_state.clone();
                let staged_file_path = state.staged_file_path.as_deref().map(PathBuf::from);
                if let Some(staged_file_path) = staged_file_path.filter(|path| path.exists()) {
                    let version = state.version.clone().unwrap_or_default();
                    let file_name = state.downloaded_file_name.clone().unwrap_or_default();
                    let config_dir = self.app.path().app_config_dir().unwrap_or_default();
                    let manager = crate::update::manager::UpdateManager::new(config_dir);
                    manager.schedule_update(&self.app, &version, &file_name, &staged_file_path);
                    self.state.inner.write().update_state =
                        crate::update::UpdateState::scheduled(&version, &file_name)
                            .with_staged_file_path(staged_file_path.to_string_lossy());
                }
            }
            "restartAndApplyUpdate" => {
                let state = self.state.inner.read().update_state.clone();
                let version = state.version.clone().unwrap_or_default();
                let config_dir = self.app.path().app_config_dir().unwrap_or_default();
                crate::update::manager::UpdateManager::apply_update(
                    &self.app,
                    &version,
                    &config_dir,
                );
                self.state.inner.write().update_state =
                    crate::update::UpdateState::applying(&version);
            }
            "updateAppearance" => {}
            _ => return Ok(false),
        }
        Ok(true)
    }
}
