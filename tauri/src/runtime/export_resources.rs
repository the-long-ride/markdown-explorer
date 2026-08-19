use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_EXPORT_RESOURCE_BYTES: u64 = 128 * 1024 * 1024;
const BASE64_TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExportResourceInfo {
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportResourceRead {
    pub relative_path: String,
    pub mime_type: String,
    pub data_base64: String,
}

fn workspace_base(workspace_path: &Path) -> Result<PathBuf, &'static str> {
    let base = if workspace_path.is_file() {
        workspace_path.parent().unwrap_or(workspace_path)
    } else {
        workspace_path
    };
    base.canonicalize().map_err(|_| "missing")
}

fn portable_relative(root: &Path, target: &Path) -> Result<String, &'static str> {
    target
        .strip_prefix(root)
        .map_err(|_| "outside-workspace")
        .map(|path| path.to_string_lossy().replace('\\', "/"))
}

fn mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "css" => "text/css",
        "gif" => "image/gif",
        "htm" | "html" => "text/html",
        "ico" => "image/x-icon",
        "jpeg" | "jpg" => "image/jpeg",
        "js" | "mjs" => "text/javascript",
        "json" => "application/json",
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        "ogg" => "audio/ogg",
        "otf" => "font/otf",
        "pdf" => "application/pdf",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "ttf" => "font/ttf",
        "txt" => "text/plain",
        "wasm" => "application/wasm",
        "wav" => "audio/wav",
        "webm" => "video/webm",
        "webp" => "image/webp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn encode_base64(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0];
        let b = *chunk.get(1).unwrap_or(&0);
        let c = *chunk.get(2).unwrap_or(&0);
        output.push(BASE64_TABLE[(a >> 2) as usize] as char);
        output.push(BASE64_TABLE[(((a & 0x03) << 4) | (b >> 4)) as usize] as char);
        if chunk.len() > 1 {
            output.push(BASE64_TABLE[(((b & 0x0f) << 2) | (c >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if chunk.len() > 2 {
            output.push(BASE64_TABLE[(c & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
    }
    output
}

fn visit_resources(root: &Path, dir: &Path, output: &mut Vec<ExportResourceInfo>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.file_name() == ".git" {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let target = entry.path();
        if file_type.is_dir() {
            let canonical = target.canonicalize().map_err(|error| error.to_string())?;
            if canonical.starts_with(root) {
                visit_resources(root, &canonical, output)?;
            }
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let canonical = target.canonicalize().map_err(|error| error.to_string())?;
        if !canonical.starts_with(root) {
            continue;
        }
        output.push(ExportResourceInfo {
            relative_path: portable_relative(root, &canonical).map_err(str::to_string)?,
            size: fs::metadata(&canonical).map_err(|error| error.to_string())?.len(),
        });
    }
    Ok(())
}

pub fn list_workspace_resources(workspace_path: &Path) -> Result<Vec<ExportResourceInfo>, String> {
    let root = workspace_base(workspace_path).map_err(str::to_string)?;
    let mut resources = Vec::new();
    visit_resources(&root, &root, &mut resources)?;
    resources.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(resources)
}

fn reference_path(root: &Path, document_path: Option<&str>, resource_path: &str) -> Result<PathBuf, &'static str> {
    let reference = resource_path
        .split(['?', '#'])
        .next()
        .unwrap_or("")
        .trim();
    let lower = reference.to_ascii_lowercase();
    if reference.is_empty()
        || lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("//")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
        || lower.starts_with("javascript:")
    {
        return Err("unsupported");
    }
    if lower.starts_with("file:") {
        return tauri::Url::parse(reference)
            .map_err(|_| "unsupported")?
            .to_file_path()
            .map_err(|_| "unsupported");
    }
    if reference.starts_with('/') {
        return Ok(root.join(reference.trim_start_matches('/')));
    }
    let reference = Path::new(reference);
    if reference.is_absolute() {
        return Ok(reference.to_path_buf());
    }
    let base = document_path
        .and_then(|value| Path::new(value).parent())
        .unwrap_or(root);
    Ok(base.join(reference))
}

pub fn read_workspace_resource(
    workspace_path: &Path,
    document_path: Option<&str>,
    resource_path: &str,
) -> Result<ExportResourceRead, &'static str> {
    let root = workspace_base(workspace_path)?;
    let requested = reference_path(&root, document_path, resource_path)?;
    if !requested.exists() {
        return Err("missing");
    }
    let canonical = requested.canonicalize().map_err(|_| "unreadable")?;
    if !canonical.starts_with(&root) {
        return Err("outside-workspace");
    }
    let metadata = fs::metadata(&canonical).map_err(|_| "unreadable")?;
    if !metadata.is_file() {
        return Err("unsupported");
    }
    if metadata.len() > MAX_EXPORT_RESOURCE_BYTES {
        return Err("too-large");
    }
    let bytes = fs::read(&canonical).map_err(|_| "unreadable")?;
    Ok(ExportResourceRead {
        relative_path: portable_relative(&root, &canonical)?,
        mime_type: mime_type(&canonical).to_string(),
        data_base64: encode_base64(&bytes),
    })
}

#[cfg(not(test))]
pub fn handle_command(
    app: &tauri::AppHandle,
    state: &crate::app_state::AppState,
    cmd: &str,
    msg: &serde_json::Value,
) -> Result<bool, String> {
    let request_id = msg.get("requestId").and_then(serde_json::Value::as_str).unwrap_or("");
    let workspace_path = state.inner.read().workspace_path.clone();
    match cmd {
        "listWorkspaceExportResources" => {
            let result = workspace_path
                .as_deref()
                .ok_or_else(|| "Workspace is not available".to_string())
                .and_then(list_workspace_resources);
            let mut extra = serde_json::Map::new();
            extra.insert("requestId".into(), request_id.into());
            match result {
                Ok(resources) => {
                    extra.insert("ok".into(), true.into());
                    extra.insert("resources".into(), serde_json::to_value(resources).unwrap_or_default());
                }
                Err(error) => {
                    extra.insert("ok".into(), false.into());
                    extra.insert("error".into(), error.into());
                }
            }
            crate::host_message::emit(app, "workspaceExportResourcesResult", extra);
            Ok(true)
        }
        "readWorkspaceExportResource" => {
            let result = workspace_path
                .as_deref()
                .ok_or("missing")
                .and_then(|workspace| {
                    read_workspace_resource(
                        workspace,
                        msg.get("documentPath").and_then(serde_json::Value::as_str),
                        msg.get("resourcePath")
                            .and_then(serde_json::Value::as_str)
                            .ok_or("unsupported")?,
                    )
                });
            let mut extra = serde_json::Map::new();
            extra.insert("requestId".into(), request_id.into());
            match result {
                Ok(resource) => {
                    extra.insert("ok".into(), true.into());
                    extra.insert("relativePath".into(), resource.relative_path.into());
                    extra.insert("mimeType".into(), resource.mime_type.into());
                    extra.insert("dataBase64".into(), resource.data_base64.into());
                }
                Err(reason) => {
                    extra.insert("ok".into(), false.into());
                    extra.insert("reason".into(), reason.into());
                }
            }
            crate::host_message::emit(app, "workspaceExportResourceResult", extra);
            Ok(true)
        }
        _ => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write(root: &Path, relative: &str, bytes: &[u8]) -> PathBuf {
        let target = root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&target, bytes).unwrap();
        target
    }

    #[test]
    fn lists_regular_files_recursively_and_omits_git() {
        let dir = tempdir().unwrap();
        write(dir.path(), "README.md", b"# Docs");
        write(dir.path(), "assets/logo.png", &[1, 2, 3]);
        write(dir.path(), "examples/demo.json", br#"{"ok":true}"#);
        write(dir.path(), ".git/config", b"[core]");
        let resources = list_workspace_resources(dir.path()).unwrap();
        assert_eq!(resources.iter().map(|item| item.relative_path.as_str()).collect::<Vec<_>>(), vec!["README.md", "assets/logo.png", "examples/demo.json"]);
        assert_eq!(resources.iter().find(|item| item.relative_path == "assets/logo.png").unwrap().size, 3);
    }

    #[test]
    fn reads_document_relative_binary_resource() {
        let dir = tempdir().unwrap();
        let document = write(dir.path(), "docs/readme.md", b"# Readme");
        write(dir.path(), "assets/logo.png", &[1, 2, 3, 255]);
        let result = read_workspace_resource(dir.path(), document.to_str(), "../assets/logo.png").unwrap();
        assert_eq!(result.relative_path, "assets/logo.png");
        assert_eq!(result.mime_type, "image/png");
        assert_eq!(result.data_base64, "AQID/w==");
    }

    #[test]
    fn rejects_paths_outside_workspace() {
        let workspace = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let outside_file = write(outside.path(), "secret.txt", b"secret");
        let document = write(workspace.path(), "docs/readme.md", b"# Readme");
        assert_eq!(read_workspace_resource(workspace.path(), document.to_str(), outside_file.to_str().unwrap()).unwrap_err(), "outside-workspace");
    }

    #[test]
    fn returns_missing_for_contained_missing_resource() {
        let dir = tempdir().unwrap();
        assert_eq!(read_workspace_resource(dir.path(), None, "assets/missing.svg").unwrap_err(), "missing");
    }
}
