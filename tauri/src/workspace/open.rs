use crate::workspace::file_types::is_supported_file_path;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceUnavailableReason {
    Missing,
    Locked,
}

#[derive(Debug)]
pub struct WorkspacePathStatus {
    pub ok: bool,
    pub is_file: bool,
    pub reason: Option<WorkspaceUnavailableReason>,
}

pub fn get_workspace_path_status(path: &Path) -> WorkspacePathStatus {
    match fs::metadata(path) {
        Ok(metadata) => WorkspacePathStatus { ok: true, is_file: metadata.is_file(), reason: None },
        Err(err) => {
            let locked = matches!(err.kind(), std::io::ErrorKind::PermissionDenied);
            WorkspacePathStatus {
                ok: false,
                is_file: false,
                reason: Some(if locked { WorkspaceUnavailableReason::Locked } else { WorkspaceUnavailableReason::Missing }),
            }
        }
    }
}

pub fn workspace_base_dir(workspace_path: &Path) -> PathBuf {
    if workspace_path.is_file() {
        workspace_path.parent().unwrap_or(workspace_path).to_path_buf()
    } else {
        workspace_path.to_path_buf()
    }
}

pub fn choose_workspace_and_file(path: &Path, document_conversion_enabled: bool) -> Result<(PathBuf, Option<PathBuf>), &'static str> {
    let status = get_workspace_path_status(path);
    if !status.ok {
        return Err("unavailable");
    }
    if status.is_file {
        if !is_supported_file_path(&path.to_string_lossy(), document_conversion_enabled) {
            return Err("unsupported");
        }
        return Ok((path.parent().unwrap_or(path).to_path_buf(), Some(path.to_path_buf())));
    }
    Ok((path.to_path_buf(), None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn choose_workspace_accepts_directory() {
        let dir = temp_dir("tauri-open-dir");
        let (workspace, file) = choose_workspace_and_file(&dir, false).unwrap();
        assert_eq!(workspace, dir);
        assert!(file.is_none());
    }

    #[test]
    fn choose_workspace_accepts_supported_file() {
        let dir = temp_dir("tauri-open-file");
        let file = dir.join("guide.md");
        fs::write(&file, "# Guide").unwrap();
        let (workspace, current_file) = choose_workspace_and_file(&file, false).unwrap();
        assert_eq!(workspace, dir);
        assert_eq!(current_file, Some(file));
    }

    #[test]
    fn choose_workspace_rejects_unsupported_file_without_document_conversion() {
        let dir = temp_dir("tauri-open-unsupported");
        let file = dir.join("report.docx");
        fs::write(&file, "doc").unwrap();
        assert_eq!(choose_workspace_and_file(&file, false), Err("unsupported"));
    }

    #[test]
    fn missing_path_reports_missing() {
        let missing = std::env::temp_dir().join("missing-tauri-workspace-path");
        let status = get_workspace_path_status(&missing);
        assert!(!status.ok);
        assert_eq!(status.reason, Some(WorkspaceUnavailableReason::Missing));
    }

    #[test]
    fn workspace_base_dir_for_directory() {
        let dir = temp_dir("tauri-basedir-dir");
        let result = workspace_base_dir(&dir);
        assert_eq!(result, dir);
    }

    #[test]
    fn workspace_base_dir_for_file_returns_parent() {
        let dir = temp_dir("tauri-basedir-file");
        let file = dir.join("test.md");
        fs::write(&file, "# Test").unwrap();
        let result = workspace_base_dir(&file);
        assert_eq!(result, dir);
    }

    #[test]
    fn choose_workspace_accepts_docx_with_conversion() {
        let dir = temp_dir("tauri-open-docx");
        let file = dir.join("report.docx");
        fs::write(&file, "fake docx").unwrap();
        let (workspace, current_file) = choose_workspace_and_file(&file, true).unwrap();
        assert_eq!(workspace, dir);
        assert_eq!(current_file, Some(file));
    }

    #[test]
    fn choose_workspace_rejects_missing_path() {
        let missing = std::env::temp_dir().join("nonexistent-tauri-ws");
        assert_eq!(choose_workspace_and_file(&missing, false), Err("unavailable"));
    }

    #[test]
    fn workspace_unavailable_reason_serialization() {
        let json = serde_json::to_string(&WorkspaceUnavailableReason::Missing).unwrap();
        assert_eq!(json, "\"missing\"");
        let json = serde_json::to_string(&WorkspaceUnavailableReason::Locked).unwrap();
        assert_eq!(json, "\"locked\"");
    }

    #[test]
    fn get_workspace_path_status_ok_for_directory() {
        let dir = temp_dir("tauri-status-ok");
        let status = get_workspace_path_status(&dir);
        assert!(status.ok);
        assert!(!status.is_file);
        assert_eq!(status.reason, None);
    }

    #[test]
    fn get_workspace_path_status_ok_for_file() {
        let dir = temp_dir("tauri-status-file");
        let file = dir.join("test.md");
        fs::write(&file, "# Test").unwrap();
        let status = get_workspace_path_status(&file);
        assert!(status.ok);
        assert!(status.is_file);
    }
}