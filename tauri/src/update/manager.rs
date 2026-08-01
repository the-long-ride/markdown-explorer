use crate::update::UpdateState;
use serde_json::json;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

const MANIFEST_FILE: &str = "pending-update.json";

pub struct UpdateManager {
    config_dir: PathBuf,
}

fn escape_for_cmd_quotes(value: impl AsRef<str>) -> String {
    value.as_ref().replace('"', "\"\"")
}

fn is_installer_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    path.extension()
        .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("exe"))
        .unwrap_or(false)
        && (name.contains("setup") || name.contains("installer"))
}

pub fn can_install_updates() -> bool {
    cfg!(target_os = "windows") && !cfg!(debug_assertions)
}

pub fn create_windows_installer_update_script(
    staged_file_path: &Path,
    target_exe_path: &Path,
    working_directory: &Path,
) -> String {
    let quoted_installer = escape_for_cmd_quotes(staged_file_path.to_string_lossy());
    let quoted_target = escape_for_cmd_quotes(target_exe_path.to_string_lossy());
    let quoted_work_dir = escape_for_cmd_quotes(working_directory.to_string_lossy());

    let install_command = if is_installer_file(staged_file_path) {
        format!("start /wait \"\" \"{quoted_installer}\" /S")
    } else {
        format!("start /wait \"\" \"{quoted_installer}\"")
    };

    [
        "@echo off".to_string(),
        "setlocal".to_string(),
        "echo Waiting for app to exit...".to_string(),
        "for /L %%i in (1,1,120) do (".to_string(),
        format!("  2>nul (>>\"{quoted_target}\" echo off) && goto install"),
        "  timeout /t 1 /nobreak >nul".to_string(),
        ")".to_string(),
        "goto cleanup".to_string(),
        "".to_string(),
        ":install".to_string(),
        "echo Running installer update...".to_string(),
        install_command,
        format!(
            "if exist \"{quoted_target}\" start \"\" /D \"{quoted_work_dir}\" \"{quoted_target}\""
        ),
        "".to_string(),
        ":cleanup".to_string(),
        format!("del /Q \"{quoted_installer}\" >nul 2>nul"),
        "del /Q %~f0 >nul 2>nul".to_string(),
        "endlocal".to_string(),
    ]
    .join("\r\n")
}

pub fn launch_windows_installer_update_helper(
    staged_file_path: &Path,
    target_exe_path: &Path,
    working_directory: &Path,
) -> Result<PathBuf, String> {
    let script_dir = std::env::temp_dir().join("markdown-explorer-updater");
    fs::create_dir_all(&script_dir).map_err(|err| format!("failed to create helper dir: {err}"))?;
    let script_path = script_dir.join(format!(
        "apply-tauri-update-{}.cmd",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    ));
    fs::write(
        &script_path,
        create_windows_installer_update_script(
            staged_file_path,
            target_exe_path,
            working_directory,
        ),
    )
    .map_err(|err| format!("failed to write helper script: {err}"))?;

    let mut command =
        Command::new(std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()));
    command.args(["/d", "/s", "/c"]).arg(&script_path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW);
    }
    command
        .spawn()
        .map_err(|err| format!("failed to launch helper: {err}"))?;
    Ok(script_path)
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
        let mut extra = serde_json::Map::new();
        extra.insert("state".into(), json!(state));
        #[cfg(not(test))]
        crate::host_message::emit(app, "updateStateChanged", extra);
        #[cfg(test)]
        let _ = (app, extra);
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
        let dest_path_for_emit = dest_path.clone();

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
                        &UpdateState::downloaded(&version_for_progress, &file_name_for_progress)
                            .with_staged_file_path(dest_path_for_emit.to_string_lossy()),
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

    pub fn schedule_update(
        &self,
        app: &AppHandle,
        version: &str,
        file_name: &str,
        staged_file_path: &Path,
    ) {
        let state = UpdateState::scheduled(version, file_name)
            .with_staged_file_path(staged_file_path.to_string_lossy());
        Self::emit_state(app, &state);

        let _ = fs::create_dir_all(&self.config_dir);
        if let Ok(json) = serde_json::to_string_pretty(&state) {
            let _ = fs::write(self.manifest_path(), json);
        }
    }

    pub fn apply_pending_update_on_exit(config_dir: &Path) -> Result<bool, String> {
        if !can_install_updates() {
            return Ok(false);
        }
        let manager = UpdateManager::new(config_dir.to_path_buf());
        let Some(state) = manager.load_persisted_state() else {
            return Ok(false);
        };
        let Some(staged_file_path) = state.staged_file_path.as_deref() else {
            manager.clear_persisted_state();
            return Ok(false);
        };
        let staged_path = PathBuf::from(staged_file_path);
        if !staged_path.exists() {
            manager.clear_persisted_state();
            return Ok(false);
        }
        let target_exe = std::env::current_exe()
            .map_err(|err| format!("failed to resolve current executable: {err}"))?;
        let working_dir = target_exe
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        manager.clear_persisted_state();
        launch_windows_installer_update_helper(&staged_path, &target_exe, &working_dir)?;
        Ok(true)
    }

    pub fn apply_update(app: &AppHandle, version: &str, config_dir: &Path) {
        Self::emit_state(app, &UpdateState::applying(version));

        match Self::apply_pending_update_on_exit(config_dir) {
            Ok(true) => app.exit(0),
            Ok(false) => Self::emit_state(
                app,
                &UpdateState::error_state(version, "missing-staged-update"),
            ),
            Err(err) => Self::emit_state(app, &UpdateState::error_state(version, &err)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::update::UpdateStatus;

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
        let state = UpdateState::scheduled("5.0", "update.msi")
            .with_staged_file_path(tmp.path().join("update.msi").to_string_lossy());
        let json = serde_json::to_string_pretty(&state).unwrap();
        fs::write(mgr.manifest_path(), json).unwrap();

        let loaded = mgr.load_persisted_state().unwrap();
        assert_eq!(loaded.status, UpdateStatus::ScheduledOnExit);
        assert_eq!(loaded.version.as_deref(), Some("5.0"));
    }

    #[test]
    fn windows_installer_script_waits_runs_silent_installer_and_relaunches() {
        let script = create_windows_installer_update_script(
            Path::new("C:/Temp/Markdown Explorer Setup.exe"),
            Path::new("C:/Program Files/Markdown Explorer/Markdown Explorer.exe"),
            Path::new("C:/Program Files/Markdown Explorer"),
        );

        assert!(script.contains("Waiting for app to exit"));
        assert!(script.contains("/S"));
        assert!(script.contains("start \"\" /D"));
        assert!(script.contains("del /Q \"C:/Temp/Markdown Explorer Setup.exe\""));
    }

    #[test]
    fn installer_file_detection_requires_setup_or_installer_exe() {
        assert!(is_installer_file(Path::new("Markdown Explorer Setup.exe")));
        assert!(is_installer_file(Path::new(
            "Markdown Explorer Installer.exe"
        )));
        assert!(!is_installer_file(Path::new(
            "Markdown Explorer Portable.exe"
        )));
        assert!(!is_installer_file(Path::new("Markdown Explorer.zip")));
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
