use crate::update::UpdateState;
#[cfg(test)]
use crate::update::UpdateStatus;
use crate::HostApp;
use serde_json::json;
use std::path::{Path, PathBuf};
use tauri_plugin_updater::Update;
use {crate::app_state::AppState, std::fs, tauri::Manager, tauri_plugin_updater::UpdaterExt};

mod native;
mod store;
pub use store::can_install_updates;
use store::{file_name_for_update, percent};

pub struct PendingUpdate {
    pub update: Update,
    pub bytes: Vec<u8>,
    pub staged_file_path: PathBuf,
}

pub struct UpdateManager {
    config_dir: PathBuf,
}

fn set_state(app: &HostApp, app_state: &AppState, state: UpdateState) {
    app_state.inner.write().update_state = state.clone();
    UpdateManager::emit_state(app, &state);
}

impl UpdateManager {
    pub fn emit_state(app: &HostApp, state: &UpdateState) {
        let mut extra = serde_json::Map::new();
        extra.insert("state".into(), json!(state));
        crate::host_message::emit(app, "updateStateChanged", extra);
    }

    pub fn restore_and_emit(app: &HostApp, config_dir: &Path) -> UpdateState {
        let manager = Self::new(config_dir.to_path_buf());
        let state = manager
            .load_persisted_state()
            .unwrap_or_else(UpdateState::idle);
        if state.status != crate::update::UpdateStatus::Idle {
            Self::emit_state(app, &state);
        }
        state
    }

    pub fn start_download(app: HostApp, app_state: AppState, requested_version: String) {
        tauri::async_runtime::spawn(async move {
            if requested_version.is_empty() {
                set_state(
                    &app,
                    &app_state,
                    UpdateState::error_state("", "missing-update-version"),
                );
                return;
            }

            let result = async {
                let update = app
                    .updater()
                    .map_err(|err| format!("failed to initialize updater: {err}"))?
                    .check()
                    .await
                    .map_err(|err| format!("failed to check update: {err}"))?
                    .ok_or_else(|| "requested-update-not-available".to_string())?;

                if update.version != requested_version {
                    return Err(format!(
                        "update-version-mismatch:{}:{}",
                        requested_version, update.version
                    ));
                }

                let file_name = file_name_for_update(&update.download_url, &update.version);
                set_state(
                    &app,
                    &app_state,
                    UpdateState::downloading(&requested_version, &file_name, 0),
                );

                let progress_app = app.clone();
                let progress_state = app_state.clone();
                let progress_version = requested_version.clone();
                let progress_file_name = file_name.clone();
                let mut downloaded = 0u64;
                let mut last_progress = 0u8;
                let bytes = update
                    .download(
                        move |chunk_length, content_length| {
                            downloaded = downloaded.saturating_add(chunk_length as u64);
                            let progress_percent = percent(downloaded, content_length);
                            if progress_percent > last_progress {
                                last_progress = progress_percent;
                                set_state(
                                    &progress_app,
                                    &progress_state,
                                    UpdateState::downloading(
                                        &progress_version,
                                        &progress_file_name,
                                        progress_percent,
                                    ),
                                );
                            }
                        },
                        || {},
                    )
                    .await
                    .map_err(|err| format!("failed to download update: {err}"))?;

                let config_dir = app
                    .path()
                    .app_config_dir()
                    .map_err(|err| format!("failed to resolve updater directory: {err}"))?;
                let manager = Self::new(config_dir);
                fs::create_dir_all(manager.staging_dir())
                    .map_err(|err| format!("failed to create updater staging directory: {err}"))?;
                let staged_file_path = manager.staging_dir().join(&file_name);
                fs::write(&staged_file_path, &bytes)
                    .map_err(|err| format!("failed to stage downloaded update: {err}"))?;

                let downloaded_state = UpdateState::downloaded(&requested_version, &file_name)
                    .with_staged_file_path(staged_file_path.to_string_lossy());
                manager.persist_state(&downloaded_state)?;
                *app_state
                    .pending_update
                    .lock()
                    .map_err(|_| "pending-update-lock-poisoned".to_string())? =
                    Some(PendingUpdate {
                        update,
                        bytes,
                        staged_file_path,
                    });
                Ok(downloaded_state)
            }
            .await;

            match result {
                Ok(state) => set_state(&app, &app_state, state),
                Err(error) => {
                    if let Ok(config_dir) = app.path().app_config_dir() {
                        Self::new(config_dir).clear_persisted_state();
                    }
                    if let Ok(mut pending) = app_state.pending_update.lock() {
                        pending.take();
                    }
                    set_state(
                        &app,
                        &app_state,
                        UpdateState::error_state(&requested_version, &error),
                    );
                }
            }
        });
    }

    pub fn schedule_downloaded_update(app: &HostApp, app_state: &AppState) -> Result<(), String> {
        let current = app_state.inner.read().update_state.clone();
        if !matches!(
            current.status,
            crate::update::UpdateStatus::Downloaded | crate::update::UpdateStatus::ScheduledOnExit
        ) {
            return Err("missing-downloaded-update".to_string());
        }
        let version = current.version.as_deref().unwrap_or_default();
        let file_name = current.downloaded_file_name.as_deref().unwrap_or_default();
        let staged_file_path = current
            .staged_file_path
            .as_deref()
            .map(PathBuf::from)
            .filter(|path| path.exists())
            .ok_or_else(|| "missing-staged-update".to_string())?;
        let state = UpdateState::scheduled(version, file_name)
            .with_staged_file_path(staged_file_path.to_string_lossy());
        let config_dir = app
            .path()
            .app_config_dir()
            .map_err(|err| format!("failed to resolve updater directory: {err}"))?;
        Self::new(config_dir).persist_state(&state)?;
        set_state(app, app_state, state);
        Ok(())
    }

    async fn restore_pending_update(
        app: &HostApp,
        app_state: &AppState,
        persisted: &UpdateState,
    ) -> Result<(), String> {
        let expected_version = persisted.version.as_deref().unwrap_or_default();
        let staged_file_path = persisted
            .staged_file_path
            .as_deref()
            .map(PathBuf::from)
            .filter(|path| path.exists())
            .ok_or_else(|| "missing-staged-update".to_string())?;
        let update = app
            .updater()
            .map_err(|err| format!("failed to initialize updater: {err}"))?
            .check()
            .await
            .map_err(|err| format!("failed to check update: {err}"))?
            .ok_or_else(|| "requested-update-not-available".to_string())?;
        if update.version != expected_version {
            return Err(format!(
                "update-version-mismatch:{}:{}",
                expected_version, update.version
            ));
        }
        let bytes = fs::read(&staged_file_path)
            .map_err(|err| format!("failed to read staged update: {err}"))?;
        *app_state
            .pending_update
            .lock()
            .map_err(|_| "pending-update-lock-poisoned".to_string())? = Some(PendingUpdate {
            update,
            bytes,
            staged_file_path,
        });
        Ok(())
    }

    async fn install_pending_update(
        app: HostApp,
        app_state: AppState,
        allow_downloaded: bool,
    ) -> Result<bool, String> {
        let persisted = app_state.inner.read().update_state.clone();
        let allowed = persisted.status == crate::update::UpdateStatus::ScheduledOnExit
            || (allow_downloaded && persisted.status == crate::update::UpdateStatus::Downloaded);
        if !allowed {
            return Ok(false);
        }
        if app_state
            .update_apply_in_progress
            .swap(true, std::sync::atomic::Ordering::SeqCst)
        {
            return Ok(true);
        }

        let version = persisted.version.clone().unwrap_or_default();
        set_state(&app, &app_state, UpdateState::applying(&version));

        let has_pending = app_state
            .pending_update
            .lock()
            .map_err(|_| "pending-update-lock-poisoned".to_string())?
            .is_some();
        if !has_pending {
            if let Err(error) = Self::restore_pending_update(&app, &app_state, &persisted).await {
                app_state
                    .update_apply_in_progress
                    .store(false, std::sync::atomic::Ordering::SeqCst);
                set_state(&app, &app_state, UpdateState::error_state(&version, &error));
                return Err(error);
            }
        }

        let pending = app_state
            .pending_update
            .lock()
            .map_err(|_| "pending-update-lock-poisoned".to_string())?
            .take()
            .ok_or_else(|| "missing-pending-update".to_string())?;
        let config_dir = app
            .path()
            .app_config_dir()
            .map_err(|err| format!("failed to resolve updater directory: {err}"))?;
        let manager = Self::new(config_dir);
        manager.clear_persisted_state();

        if let Err(error) = native::install(&pending.update, &pending.bytes) {
            let message = format!("failed to install update: {error}");
            let restored_state = UpdateState::scheduled(
                &version,
                persisted
                    .downloaded_file_name
                    .as_deref()
                    .unwrap_or_default(),
            )
            .with_staged_file_path(pending.staged_file_path.to_string_lossy());
            let _ = manager.persist_state(&restored_state);
            if let Ok(mut slot) = app_state.pending_update.lock() {
                *slot = Some(pending);
            }
            app_state
                .update_apply_in_progress
                .store(false, std::sync::atomic::Ordering::SeqCst);
            set_state(
                &app,
                &app_state,
                UpdateState::error_state(&version, &message),
            );
            return Err(message);
        }

        let _ = fs::remove_file(pending.staged_file_path);
        native::restart(&app);
    }

    pub fn restart_and_apply_update(app: HostApp, app_state: AppState) {
        tauri::async_runtime::spawn(async move {
            let _ = Self::install_pending_update(app, app_state, true).await;
        });
    }

    pub async fn apply_scheduled_update(app: HostApp, app_state: AppState) -> Result<bool, String> {
        Self::install_pending_update(app, app_state, false).await
    }

    pub fn should_apply_on_close(app_state: &AppState) -> bool {
        matches!(
            app_state.inner.read().update_state.status,
            crate::update::UpdateStatus::ScheduledOnExit
        )
    }
}
