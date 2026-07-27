use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;

const DOCUMENT_SIDECAR_DIRECTORY: &str = "document-sidecar";
const DOCUMENT_SIDECAR_OVERRIDE: &str = "MARKDOWN_EXPLORER_DOCUMENT_SIDECAR_DIR";
const SIDECAR_EXECUTABLE: &str = "markdown-them-node";

static RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, PartialEq, Eq)]
struct SidecarLaunch {
    program: PathBuf,
    script: PathBuf,
    working_dir: PathBuf,
}

pub fn configure_resource_dir(resource_dir: PathBuf) {
    let _ = RESOURCE_DIR.set(resource_dir);
}

pub fn convert_file(file_path: &str) -> Result<String, String> {
    let launch = resolve_launch()?;
    let mut child = Command::new(&launch.program)
        .arg(&launch.script)
        .current_dir(&launch.working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "failed to start document converter '{}': {error}",
                launch.program.display()
            )
        })?;

    let id = uuid::Uuid::new_v4().to_string();
    let request = format!(
        "{}\n",
        serde_json::json!({ "id": id, "command": "convert", "path": file_path })
    );

    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "document converter stdin is unavailable".to_string())?;
        stdin
            .write_all(request.as_bytes())
            .map_err(|error| format!("document converter write error: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("document converter wait error: {error}"))?;

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(response) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if response.get("id").and_then(|value| value.as_str()) != Some(id.as_str()) {
            continue;
        }
        if response.get("ok").and_then(|value| value.as_bool()) == Some(true) {
            return response
                .get("markdown")
                .and_then(|value| value.as_str())
                .map(ToString::to_string)
                .ok_or_else(|| "document converter response is missing markdown".to_string());
        }
        return Err(response
            .get("error")
            .and_then(|value| value.as_str())
            .unwrap_or("unknown document converter error")
            .to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let status = output
        .status
        .code()
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    if stderr.is_empty() {
        Err(format!(
            "document converter exited with status {status} without a response"
        ))
    } else {
        Err(format!(
            "document converter exited with status {status} without a response: {stderr}"
        ))
    }
}

fn resolve_launch() -> Result<SidecarLaunch, String> {
    let executable_dir = std::env::current_exe()
        .map_err(|error| format!("failed to locate application executable: {error}"))?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "application executable has no parent directory".to_string())?;

    if let Some(root) = std::env::var_os(DOCUMENT_SIDECAR_OVERRIDE) {
        return packaged_launch(Path::new(&root), &executable_dir);
    }

    if let Some(resource_dir) = RESOURCE_DIR.get() {
        let packaged_root = resource_dir.join(DOCUMENT_SIDECAR_DIRECTORY);
        if packaged_root.exists() {
            return packaged_launch(&packaged_root, &executable_dir);
        }
    }

    development_launch()
}

fn packaged_launch(root: &Path, executable_dir: &Path) -> Result<SidecarLaunch, String> {
    let program = executable_dir.join(sidecar_executable_name());
    let working_dir = root.join("app");
    let script = working_dir.join("index.mjs");

    if !program.is_file() {
        return Err(format!(
            "document converter sidecar is missing: {}",
            program.display()
        ));
    }
    if !script.is_file() {
        return Err(format!(
            "document converter script is missing: {}",
            script.display()
        ));
    }

    Ok(SidecarLaunch {
        program,
        script,
        working_dir,
    })
}

fn development_launch() -> Result<SidecarLaunch, String> {
    let working_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("sidecar")
        .join("mdthem-sidecar");
    let script = working_dir.join("index.mjs");
    if !script.is_file() {
        return Err(format!(
            "document converter development script is missing: {}",
            script.display()
        ));
    }

    Ok(SidecarLaunch {
        program: PathBuf::from(node_executable_name()),
        script,
        working_dir,
    })
}

fn sidecar_executable_name() -> &'static str {
    if cfg!(windows) {
        "markdown-them-node.exe"
    } else {
        SIDECAR_EXECUTABLE
    }
}

fn node_executable_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packaged_launch_uses_external_binary_and_bundled_app() {
        let temp = tempfile::tempdir().unwrap();
        let executable_dir = temp.path().join("bin");
        let resource_root = temp.path().join("resources/document-sidecar");
        let app = resource_root.join("app");
        std::fs::create_dir_all(&executable_dir).unwrap();
        std::fs::create_dir_all(&app).unwrap();
        std::fs::write(executable_dir.join(sidecar_executable_name()), b"node").unwrap();
        std::fs::write(app.join("index.mjs"), b"sidecar").unwrap();

        let launch = packaged_launch(&resource_root, &executable_dir).unwrap();

        assert_eq!(
            launch.program,
            executable_dir.join(sidecar_executable_name())
        );
        assert_eq!(launch.script, app.join("index.mjs"));
        assert_eq!(launch.working_dir, app);
    }

    #[test]
    fn packaged_launch_reports_missing_external_binary() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("resources/document-sidecar/app");
        std::fs::create_dir_all(&app).unwrap();
        std::fs::write(app.join("index.mjs"), b"sidecar").unwrap();

        let error = packaged_launch(
            &temp.path().join("resources/document-sidecar"),
            &temp.path().join("bin"),
        )
        .unwrap_err();

        assert!(error.contains("sidecar is missing"));
    }

    #[test]
    fn development_launch_uses_markdown_them_sidecar_source() {
        let launch = development_launch().unwrap();

        assert!(launch.script.ends_with("sidecar/mdthem-sidecar/index.mjs"));
        assert_eq!(launch.program, PathBuf::from(node_executable_name()));
    }
}
