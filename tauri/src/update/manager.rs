#[cfg(not(test))]
use {crate::app_state::AppState, tauri::Manager, tauri_plugin_updater::{Update, UpdaterExt}};
use crate::update::UpdateState;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const MANIFEST_FILE: &str = "pending-update.json";

#[cfg(not(test))]
pub struct PendingUpdate {
    pub update: Update,
    pub bytes: Vec<u8>,
    pub staged_file_path: PathBuf,
}

pub struct UpdateManager {
    config_dir: PathBuf,
}

pub fn can_install_updates() -> bool {
    !cfg!(debug_assertions)
}

#[cfg(not(test))]
fn file_name_for_update(update: &Update) -> String {
    update
        .download_url
        .path_segments()
        .and_then(|segments| segments.filter(|segment| !segment.is_empty()).next_back())
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("markdown-explorer-{}.update", update.version))
}

#[cfg(not(test))]
fn set_state(app: &AppHandle, app_state: &AppState, state: UpdateState) {
    app_state.inner.write().update_state = state.clone();
    UpdateManager::emit_state(app, &state);
}

fn percent(downloaded: u64, total: Option<u64>) -> u8 {
    let Some(total) = total.filter(|value| *value > 0) else {
        return 0;
    };
    ((downloaded.saturating_mul(100) / total).min(99)) as u8
}

impl UpdateManager {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.config_dir.join(MANIFEST_FILE)
    }

    pub fn staging_dir(&self) -> PathBuf {
        self.config_dir.join("staged")
    }

    pub fn load_persisted_state(&self) -> Option<UpdateState> {
        let content = fs::read_to_string(self.manifest_path()).ok()?;
        let state: UpdateState = serde_json::from_str(&content).ok()?;
        let staged_path = state.staged_file_path.as_deref().map(Path::new);
        match state.status {
            crate::update::UpdateStatus::Downloaded | crate::update::UpdateStatus::ScheduledOnExit
                if staged_path.is_some_and(Path::exists) =>
            {
                Some(state)
            }
            _ => {
                self.clear_persisted_state();
                None
            }
        }
    }

    pub fn persist_state(&self, state: &UpdateState) -> Result<(), String> {
        fs::create_dir_all(&self.config_dir)
            .map_err(|err| format!("failed to create updater directory: {err}"))?;
        let content = serde_json::to_string_pretty(state)
            .map_err(|err| format!("failed to serialize updater state: {err}"))?;
        fs::write(self.manifest_path(), content)
            .map_err(|err| format!("failed to persist updater state: {err}"))
    }

    pub fn clear_persisted_state(&self) {
        let _ = fs::remove_file(self.manifest_path());
    }

    pub fn emit_state(app: &AppHandle, state: &UpdateState) {
        let mut extra = serde_json::Map::new();
        extra.insert("state".into(), json!(state));
        #[cfg(not(test))]
        crate::host_message::emit(app, "updateStateChanged", extra);
        #[cfg(test)]
        let _ = (app, extra);
    }

    pub fn restore_and_emit(app: &AppHandle, config_dir: &Path) -> UpdateState {
        let manager = Self::new(config_dir.to_path_buf());
        let state = manager
            .load_persisted_state()
            .unwrap_or_else(UpdateState::idle);
        if state.status != crate::update::UpdateStatus::Idle {
            Self::emit_state(app, &state);
        }
        state
    }

    #[cfg(not(test))]
    pub fn start_download(app: AppHandle, app_state: AppState, requested_version: String) {
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

                let file_name = file_name_for_update(&update);
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

    #[cfg(not(test))]
    pub fn schedule_downloaded_update(
        app: &AppHandle,
        app_state: &AppState,
    ) -> Result<(), String> {
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

    #[cfg(not(test))]
    async fn restore_pending_update(
        app: &AppHandle,
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
            .map_err(|_| "pending-update-lock-poisoned".to_string())? =
            Some(PendingUpdate {
                update,
                bytes,
                staged_file_path,
            });
        Ok(())
    }

    #[cfg(not(test))]
    async fn install_pending_update(
        app: AppHandle,
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
                set_state(
                    &app,
                    &app_state,
                    UpdateState::error_state(&version, &error),
                );
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

        if let Err(error) = pending.update.install(&pending.bytes) {
            let message = format!("failed to install update: {error}");
            let restored_state = UpdateState::scheduled(
                &version,
                persisted.downloaded_file_name.as_deref().unwrap_or_default(),
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
        app.restart();
    }

    #[cfg(not(test))]
    pub fn restart_and_apply_update(app: AppHandle, app_state: AppState) {
        tauri::async_runtime::spawn(async move {
            let _ = Self::install_pending_update(app, app_state, true).await;
        });
    }

    #[cfg(not(test))]
    pub async fn apply_scheduled_update(app: AppHandle, app_state: AppState) -> Result<bool, String> {
        Self::install_pending_update(app, app_state, false).await
    }

    #[cfg(not(test))]
    pub fn should_apply_on_close(app_state: &AppState) -> bool {
        matches!(
            app_state.inner.read().update_state.status,
            crate::update::UpdateStatus::ScheduledOnExit
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::update::UpdateStatus;

    #[test]
    fn progress_is_bounded_and_unknown_total_stays_zero() {
        assert_eq!(percent(10, None), 0);
        assert_eq!(percent(50, Some(100)), 50);
        assert_eq!(percent(200, Some(100)), 99);
    }

    #[test]
    fn persisted_download_requires_existing_staged_file() {
        let tmp = tempfile::tempdir().unwrap();
        let manager = UpdateManager::new(tmp.path().to_path_buf());
        let missing = tmp.path().join("missing.update");
        let state = UpdateState::downloaded("1.6.4", "missing.update")
            .with_staged_file_path(missing.to_string_lossy());
        manager.persist_state(&state).unwrap();

        assert!(manager.load_persisted_state().is_none());
        assert!(!manager.manifest_path().exists());
    }

    #[test]
    fn scheduled_state_round_trips_when_staged_file_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let manager = UpdateManager::new(tmp.path().to_path_buf());
        let staged = tmp.path().join("update.bin");
        fs::write(&staged, b"verified update bytes").unwrap();
        let state = UpdateState::scheduled("1.6.4", "update.bin")
            .with_staged_file_path(staged.to_string_lossy());
        manager.persist_state(&state).unwrap();

        let restored = manager.load_persisted_state().unwrap();
        assert_eq!(restored.status, UpdateStatus::ScheduledOnExit);
        assert_eq!(restored.version.as_deref(), Some("1.6.4"));
    }
}
