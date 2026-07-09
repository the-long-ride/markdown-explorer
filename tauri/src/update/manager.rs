use crate::update::{UpdateState, UpdateStatus};
use serde_json::json;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

const MANIFEST_FILE: &str = "pending-update.json";

pub struct UpdateManager {
    config_dir: PathBuf,
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
        let path = self.manifest_path();
        if !path.exists() {
            return None;
        }
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn clear_persisted_state(&self) {
        let _ = fs::remove_file(self.manifest_path());
    }

    pub fn emit_state(app: &AppHandle, state: &UpdateState) {
        let _ = app.emit(
            "host-message",
            json!({
                "command": "updateStateChanged",
                "state": state,
            }),
        );
    }

    pub fn send_current_state(app: &AppHandle, persisted: Option<&UpdateState>) {
        let state = persisted.cloned().unwrap_or_default();
        if state.status != UpdateStatus::Idle {
            Self::emit_state(app, &state);
        }
    }

    pub fn restore_and_emit(app: &AppHandle, config_dir: &Path) -> UpdateState {
        let manager = UpdateManager::new(config_dir.to_path_buf());
        if let Some(state) = manager.load_persisted_state() {
            Self::emit_state(app, &state);
            state
        } else {
            UpdateState::idle()
        }
    }

    pub fn start_download(app: AppHandle, version: &str, url: &str, staging_dir: PathBuf) {
        let version = version.to_string();
        let url = url.to_string();

        let file_name = url.split('/').last().unwrap_or("update.msi").to_string();
        let dest_path = staging_dir.join(&file_name);

        let app_for_progress = app.clone();
        let version_for_progress = version.clone();
        let file_name_for_progress = file_name.clone();

        Self::emit_state(&app, &UpdateState::downloading(&version, &file_name, 0));

        tauri::async_runtime::spawn(async move {
            let result = tokio::task::spawn_blocking(move || {
                #[allow(unused_variables, unused_assignments)]
                match ureq::get(&url).call() {
                    Ok(response) => {
                        let _total = response
                            .header("content-length")
                            .and_then(|v| v.parse::<u64>().ok())
                            .unwrap_or(0);

                        let mut reader = response.into_reader();
                        let _ = fs::create_dir_all(&staging_dir);

                        let mut file = match fs::File::create(&dest_path) {
                            Ok(f) => f,
                            Err(e) => {
                                return Err(format!("failed to create file: {e}"));
                            }
                        };

                        let mut buf = [0u8; 8192];
                        let mut received: u64 = 0;

                        loop {
                            match reader.read(&mut buf) {
                                Ok(0) => break,
                                Ok(n) => {
                                    if file.write_all(&buf[..n]).is_err() {
                                        return Err("write failed".to_string());
                                    }
                                    received += n as u64;
                                }
                                Err(e) => {
                                    return Err(format!("read error: {e}"));
                                }
                            }
                        }

                        let _ = file.flush();
                        Ok(())
                    }
                    Err(e) => Err(format!("download failed: {e}")),
                }
            })
            .await;

            match result {
                Ok(Ok(())) => {
                    Self::emit_state(
                        &app_for_progress,
                        &UpdateState::downloaded(&version_for_progress, &file_name_for_progress),
                    );
                }
                Ok(Err(err)) => {
                    Self::emit_state(
                        &app_for_progress,
                        &UpdateState::error_state(&version_for_progress, &err),
                    );
                }
                Err(_) => {
                    Self::emit_state(
                        &app_for_progress,
                        &UpdateState::error_state(&version_for_progress, "task panicked"),
                    );
                }
            }
        });
    }

    pub fn schedule_update(&self, app: &AppHandle, version: &str, file_name: &str) {
        let state = UpdateState::scheduled(version, file_name);
        Self::emit_state(app, &state);

        let _ = fs::create_dir_all(&self.config_dir);
        if let Ok(json) = serde_json::to_string_pretty(&state) {
            let _ = fs::write(self.manifest_path(), json);
        }
    }

    pub fn apply_update(app: &AppHandle, version: &str, config_dir: &Path) {
        Self::emit_state(app, &UpdateState::applying(version));

        let manifest = config_dir.join(MANIFEST_FILE);
        let _ = fs::remove_file(&manifest);
        app.restart();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_transitions() {
        let idle = UpdateState::default();
        assert_eq!(idle.status, UpdateStatus::Idle);

        let dl = UpdateState::downloading("1.0", "update.msi", 50);
        assert_eq!(dl.status, UpdateStatus::Downloading);
        assert_eq!(dl.progress_percent, Some(50));

        let done = UpdateState::downloaded("1.0", "update.msi");
        assert_eq!(done.status, UpdateStatus::Downloaded);
    }

    #[test]
    fn state_serialization() {
        let state = UpdateState::downloading("1.0", "update.msi", 42);
        let json = serde_json::to_string(&state).unwrap();
        let restored: UpdateState = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.status, UpdateStatus::Downloading);
        assert_eq!(restored.version, Some("1.0".into()));
    }

    #[test]
    fn manifest_path_in_config_dir() {
        let mgr = UpdateManager::new(PathBuf::from("/tmp/config"));
        assert_eq!(
            mgr.manifest_path(),
            PathBuf::from("/tmp/config/pending-update.json")
        );
    }

    #[test]
    fn staging_dir_in_config_dir() {
        let mgr = UpdateManager::new(PathBuf::from("/tmp/config"));
        assert_eq!(mgr.staging_dir(), PathBuf::from("/tmp/config/staged"));
    }

    #[test]
    fn load_persisted_state_returns_none_when_no_file() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = UpdateManager::new(tmp.path().to_path_buf());
        assert!(mgr.load_persisted_state().is_none());
    }

    #[test]
    fn schedule_and_load_persisted_state() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = UpdateManager::new(tmp.path().to_path_buf());

        // We can't call schedule_update without an AppHandle, but we can
        // write the manifest manually and test load_persisted_state.
        let state = UpdateState::scheduled("5.0", "update.msi");
        let json = serde_json::to_string_pretty(&state).unwrap();
        fs::write(mgr.manifest_path(), json).unwrap();

        let loaded = mgr.load_persisted_state().unwrap();
        assert_eq!(loaded.status, UpdateStatus::ScheduledOnExit);
        assert_eq!(loaded.version.as_deref(), Some("5.0"));
    }

    #[test]
    fn clear_persisted_state_removes_file() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = UpdateManager::new(tmp.path().to_path_buf());

        fs::write(mgr.manifest_path(), "{}").unwrap();
        assert!(mgr.manifest_path().exists());

        mgr.clear_persisted_state();
        assert!(!mgr.manifest_path().exists());
    }

    #[test]
    fn clear_persisted_state_no_file_is_ok() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = UpdateManager::new(tmp.path().to_path_buf());
        // Should not panic
        mgr.clear_persisted_state();
    }

    #[test]
    fn load_persisted_state_invalid_json_returns_none() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = UpdateManager::new(tmp.path().to_path_buf());
        fs::write(mgr.manifest_path(), "not json").unwrap();
        assert!(mgr.load_persisted_state().is_none());
    }
}
