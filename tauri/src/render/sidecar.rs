use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

pub fn convert_file(file_path: &str) -> Result<String, String> {
    let script_path = sidecar_script_path();
    let working_dir = repo_root();

    let mut child = Command::new("node")
        .arg(&script_path)
        .current_dir(&working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to start document converter: {e}"))?;

    let id = uuid::Uuid::new_v4().to_string();
    let request = format!(
        "{}\n",
        serde_json::json!({ "id": id, "command": "convert", "path": file_path })
    );

    {
        let mut stdin = child.stdin.take().ok_or("no stdin")?;
        stdin
            .write_all(request.as_bytes())
            .map_err(|e| format!("sidecar write error: {e}"))?;
    }

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line.map_err(|e| format!("sidecar read error: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(response) = serde_json::from_str::<serde_json::Value>(&line) {
            if response.get("id").and_then(|v| v.as_str()) == Some(id.as_str()) {
                let _ = child.wait();
                if response.get("ok").and_then(|v| v.as_bool()) == Some(true) {
                    return response
                        .get("markdown")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .ok_or_else(|| "sidecar response missing markdown".to_string());
                }
                let error = response
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown sidecar error");
                return Err(error.to_string());
            }
        }
    }

    let _ = child.kill();
    let _ = child.wait();
    Err("document converter process exited without response".to_string())
}

fn sidecar_script_path() -> String {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| String::new());
    std::path::Path::new(&manifest_dir)
        .join("sidecar")
        .join("mdthem-sidecar")
        .join("index.mjs")
        .to_string_lossy()
        .to_string()
}

fn repo_root() -> std::path::PathBuf {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| String::new());
    let tauri_dir = std::path::Path::new(&manifest_dir);
    tauri_dir.parent().unwrap_or(tauri_dir).to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sidecar_script_path_ends_with_index_mjs() {
        let path = sidecar_script_path();
        assert!(
            path.ends_with("sidecar\\mdthem-sidecar\\index.mjs")
                || path.ends_with("sidecar/mdthem-sidecar/index.mjs"),
            "got: {path}"
        );
    }

    #[test]
    fn repo_root_is_parent_of_manifest_dir() {
        let root = repo_root();
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| String::new());
        if !manifest_dir.is_empty() {
            let tauri_dir = std::path::Path::new(&manifest_dir);
            assert_eq!(root, tauri_dir.parent().unwrap_or(tauri_dir));
        }
    }
}
