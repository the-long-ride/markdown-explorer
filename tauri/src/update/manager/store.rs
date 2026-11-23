use super::{UpdateManager, UpdateState};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Url;

const MANIFEST_FILE: &str = "pending-update.json";

pub fn can_install_updates() -> bool {
    !cfg!(debug_assertions)
}

pub(super) fn file_name_for_update(url: &Url, version: &str) -> String {
    url.path_segments()
        .and_then(|segments| segments.filter(|segment| !segment.is_empty()).next_back())
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("markdown-explorer-{version}.update"))
}

pub(super) fn percent(downloaded: u64, total: Option<u64>) -> u8 {
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
            crate::update::UpdateStatus::Downloaded
            | crate::update::UpdateStatus::ScheduledOnExit
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
}

#[cfg(test)]
mod tests {
    use super::super::UpdateStatus;
    use super::*;

    #[test]
    fn updater_uses_download_filename_or_version_fallback() {
        let installer = Url::parse("https://example.org/app/App.tar.gz/?token=value").unwrap();
        let no_filename = Url::parse("https://example.org/").unwrap();
        assert_eq!(file_name_for_update(&installer, "1.6.4"), "App.tar.gz");
        assert_eq!(
            file_name_for_update(&no_filename, "1.6.4"),
            "markdown-explorer-1.6.4.update"
        );
        #[cfg(debug_assertions)]
        assert!(!can_install_updates());
        #[cfg(not(debug_assertions))]
        assert!(can_install_updates());
    }

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

    #[test]
    fn reports_manifest_failures_and_exposes_staging_directory() {
        let temp = tempfile::tempdir().unwrap();
        let config = temp.path().join("config");
        fs::write(&config, b"not a directory").unwrap();
        let manager = UpdateManager::new(config.clone());
        assert_eq!(manager.staging_dir(), config.join("staged"));
        assert!(manager
            .persist_state(&UpdateState::idle())
            .unwrap_err()
            .contains("failed to create updater directory"));
        fs::remove_file(&config).unwrap();
        fs::create_dir_all(manager.manifest_path()).unwrap();
        assert!(manager
            .persist_state(&UpdateState::idle())
            .unwrap_err()
            .contains("failed to persist updater state"));
        fs::remove_dir(manager.manifest_path()).unwrap();
        fs::write(manager.manifest_path(), b"not json").unwrap();
        assert!(manager.load_persisted_state().is_none());
    }
}
