pub mod manager;

#[derive(Clone, Debug, Default, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UpdateStatus {
    #[default]
    Idle,
    Downloading,
    Downloaded,
    #[serde(rename = "scheduled-on-exit")]
    ScheduledOnExit,
    Applying,
    Error,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub status: UpdateStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded_file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub staged_file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl UpdateState {
    pub fn idle() -> Self {
        Self::default()
    }

    pub fn downloading(version: &str, file_name: &str, progress: u8) -> Self {
        Self {
            status: UpdateStatus::Downloading,
            version: Some(version.to_string()),
            downloaded_file_name: Some(file_name.to_string()),
            progress_percent: Some(progress),
            ..Default::default()
        }
    }

    pub fn downloaded(version: &str, file_name: &str) -> Self {
        Self {
            status: UpdateStatus::Downloaded,
            version: Some(version.to_string()),
            downloaded_version: Some(version.to_string()),
            downloaded_file_name: Some(file_name.to_string()),
            progress_percent: Some(100),
            ..Default::default()
        }
    }

    pub fn scheduled(version: &str, file_name: &str) -> Self {
        Self {
            status: UpdateStatus::ScheduledOnExit,
            version: Some(version.to_string()),
            downloaded_version: Some(version.to_string()),
            downloaded_file_name: Some(file_name.to_string()),
            progress_percent: Some(100),
            ..Default::default()
        }
    }

    pub fn applying(version: &str) -> Self {
        Self {
            status: UpdateStatus::Applying,
            version: Some(version.to_string()),
            ..Default::default()
        }
    }

    pub fn with_staged_file_path(mut self, staged_file_path: impl Into<String>) -> Self {
        self.staged_file_path = Some(staged_file_path.into());
        self
    }

    pub fn error_state(version: &str, message: &str) -> Self {
        Self {
            status: UpdateStatus::Error,
            version: Some(version.to_string()),
            error: Some(message.to_string()),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_state_is_default() {
        let idle = UpdateState::idle();
        assert_eq!(idle.status, UpdateStatus::Idle);
        assert_eq!(idle.version, None);
        assert_eq!(idle.progress_percent, None);
    }

    #[test]
    fn downloading_state_fields() {
        let s = UpdateState::downloading("2.0", "update.msi", 75);
        assert_eq!(s.status, UpdateStatus::Downloading);
        assert_eq!(s.version.as_deref(), Some("2.0"));
        assert_eq!(s.downloaded_file_name.as_deref(), Some("update.msi"));
        assert_eq!(s.progress_percent, Some(75));
        assert_eq!(s.downloaded_version, None);
    }

    #[test]
    fn downloaded_state_sets_100_percent() {
        let s = UpdateState::downloaded("3.0", "update.msi");
        assert_eq!(s.status, UpdateStatus::Downloaded);
        assert_eq!(s.downloaded_version.as_deref(), Some("3.0"));
        assert_eq!(s.progress_percent, Some(100));
    }

    #[test]
    fn scheduled_state_fields() {
        let s = UpdateState::scheduled("3.0", "update.msi");
        assert_eq!(s.status, UpdateStatus::ScheduledOnExit);
        assert_eq!(s.downloaded_version.as_deref(), Some("3.0"));
        assert_eq!(s.progress_percent, Some(100));
    }

    #[test]
    fn applying_state_fields() {
        let s = UpdateState::applying("4.0");
        assert_eq!(s.status, UpdateStatus::Applying);
        assert_eq!(s.version.as_deref(), Some("4.0"));
        assert_eq!(s.progress_percent, None);
    }

    #[test]
    fn error_state_fields() {
        let s = UpdateState::error_state("4.0", "network error");
        assert_eq!(s.status, UpdateStatus::Error);
        assert_eq!(s.version.as_deref(), Some("4.0"));
        assert_eq!(s.error.as_deref(), Some("network error"));
    }

    #[test]
    fn update_status_default_is_idle() {
        assert_eq!(UpdateStatus::default(), UpdateStatus::Idle);
    }

    #[test]
    fn serde_kebab_case_roundtrip() {
        let s = UpdateState::scheduled("1.0", "f.msi");
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"scheduled-on-exit\""));
        let restored: UpdateState = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.status, UpdateStatus::ScheduledOnExit);
    }

    #[test]
    fn serde_camel_case_keys() {
        let s = UpdateState::downloading("1.0", "f.msi", 50);
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"progressPercent\""));
        assert!(json.contains("\"downloadedFileName\""));
    }

    #[test]
    fn serde_skip_none_fields() {
        let s = UpdateState::idle();
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("version"));
        assert!(!json.contains("error"));
    }
}
