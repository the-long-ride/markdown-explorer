use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum SaveDocumentOutcome {
    Saved { revision: String },
    Conflict { disk_source: String, disk_revision: String },
    OutsideWorkspace,
    Missing,
}

pub(crate) fn document_revision(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .map_err(|error| error.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    Ok(format!("{modified}:{}", metadata.len()))
}

/// Repository metadata must never be writable through the document editor.
fn has_git_segment(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(component, Component::Normal(part) if part.to_string_lossy().eq_ignore_ascii_case(".git"))
    })
}

/// Resolves `.` and `..` textually. Windows verbatim (`\?\`) paths are not normalized by the OS, so a
/// relative path joined onto a canonical base must be cleaned before it touches the filesystem.
fn normalize_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push("..");
                }
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

/// Writes `source` next to `target` and renames it over the target, so readers (and a crash) never
/// observe a half-written document. `target` must already be canonical, so a symlink is replaced
/// at its destination instead of being swapped for a regular file.
fn write_atomically(target: &Path, source: &str) -> Result<(), String> {
    let directory = target.parent().ok_or_else(|| "Document has no parent directory".to_string())?;
    let permissions = fs::metadata(target).map_err(|error| error.to_string())?.permissions();
    if permissions.readonly() {
        return Err("Document is read-only".into());
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let file_name = target.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    let temp = directory.join(format!(".{file_name}.{}.{nonce}.tmp", std::process::id()));

    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(source.as_bytes())?;
        file.sync_all()?;
        drop(file);
        fs::set_permissions(&temp, permissions)?;
        fs::rename(&temp, target)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temp);
        return Err(error.to_string());
    }
    #[cfg(unix)]
    if let Ok(directory) = fs::File::open(directory) {
        let _ = directory.sync_all();
    }
    Ok(())
}

/// Saves `source` to a Markdown document inside the workspace. Relative `file_path`s resolve against
/// the workspace root (never the process working directory). A missing or stale `expected_revision`
/// is a conflict unless `force` is set.
pub(super) fn save_document_to_path(
    workspace_path: &Path,
    file_path: &Path,
    source: &str,
    expected_revision: Option<&str>,
    force: bool,
) -> Result<SaveDocumentOutcome, String> {
    let workspace_base = if workspace_path.is_file() {
        workspace_path.parent().unwrap_or(workspace_path)
    } else {
        workspace_path
    };
    let workspace_base = match fs::canonicalize(workspace_base) {
        Ok(base) => base,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(SaveDocumentOutcome::Missing),
        Err(error) => return Err(error.to_string()),
    };
    if has_git_segment(file_path) {
        return Ok(SaveDocumentOutcome::OutsideWorkspace);
    }
    let requested: PathBuf = if file_path.is_absolute() {
        file_path.to_path_buf()
    } else {
        let joined = normalize_lexically(&workspace_base.join(file_path));
        if !joined.starts_with(&workspace_base) {
            return Ok(SaveDocumentOutcome::OutsideWorkspace);
        }
        joined
    };

    let target = match fs::canonicalize(&requested) {
        Ok(target) => target,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(SaveDocumentOutcome::Missing),
        Err(error) => return Err(error.to_string()),
    };
    let Ok(relative) = target.strip_prefix(&workspace_base) else {
        return Ok(SaveDocumentOutcome::OutsideWorkspace);
    };
    // A symlink inside the workspace may still resolve into repository metadata.
    if has_git_segment(relative) {
        return Ok(SaveDocumentOutcome::OutsideWorkspace);
    }
    if !target.is_file() {
        return Ok(SaveDocumentOutcome::Missing);
    }

    let disk_revision = document_revision(&target)?;
    if !force && expected_revision != Some(disk_revision.as_str()) {
        let disk_source = String::from_utf8_lossy(&fs::read(&target).map_err(|error| error.to_string())?).into_owned();
        return Ok(SaveDocumentOutcome::Conflict {
            disk_source,
            disk_revision,
        });
    }

    write_atomically(&target, source)?;
    Ok(SaveDocumentOutcome::Saved {
        revision: document_revision(&target)?,
    })
}

#[cfg(not(test))]
impl super::Dispatcher {
    pub(super) fn handle_save_document(&self, msg: &serde_json::Value) {
        use serde_json::{json, Value};

        let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("");
        let file_path = msg.get("filePath").and_then(Value::as_str).unwrap_or("");
        let source = msg.get("source").and_then(Value::as_str).unwrap_or("");
        let expected_revision = msg.get("expectedRevision").and_then(Value::as_str);
        let force = msg.get("force").and_then(Value::as_bool).unwrap_or(false);
        let workspace_path = self.state.inner.read().workspace_path.clone();

        let mut extra = serde_json::Map::new();
        extra.insert("requestId".into(), request_id.into());
        extra.insert("filePath".into(), file_path.into());

        let outcome = workspace_path
            .as_deref()
            .filter(|_| crate::workspace::file_types::is_markdown_file_path(file_path))
            .map(|workspace| save_document_to_path(workspace, Path::new(file_path), source, expected_revision, force));

        match outcome {
            None => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "read-only".into());
            }
            Some(Ok(SaveDocumentOutcome::Saved { revision })) => {
                extra.insert("ok".into(), true.into());
                extra.insert("revision".into(), revision.into());
            }
            Some(Ok(SaveDocumentOutcome::Conflict { disk_source, disk_revision })) => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "conflict".into());
                extra.insert("diskSource".into(), disk_source.into());
                extra.insert("diskRevision".into(), disk_revision.into());
            }
            Some(Ok(SaveDocumentOutcome::OutsideWorkspace)) => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "outside-workspace".into());
            }
            Some(Ok(SaveDocumentOutcome::Missing)) => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "missing".into());
            }
            Some(Err(error)) => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "write-failed".into());
                extra.insert("error".into(), json!(error));
            }
        }

        crate::host_message::emit(&self.app, "saveDocumentResult", extra);
    }
}

#[cfg(test)]
mod tests {
    use super::{document_revision, save_document_to_path, SaveDocumentOutcome};
    use std::fs;
    use std::path::Path;

    fn leftover_temp_files(dir: &Path) -> Vec<String> {
        fs::read_dir(dir).unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect()
    }

    #[test]
    fn stale_revision_returns_conflict_without_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# A").unwrap();
        let old = document_revision(&file).unwrap();
        fs::write(&file, "# External").unwrap();

        let result = save_document_to_path(dir.path(), &file, "# Mine", Some(&old), false).unwrap();

        assert!(matches!(result, SaveDocumentOutcome::Conflict { .. }));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# External");
    }

    #[test]
    fn missing_expected_revision_is_a_conflict_unless_forced() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# Disk").unwrap();

        let result = save_document_to_path(dir.path(), &file, "# Mine", None, false).unwrap();
        match result {
            SaveDocumentOutcome::Conflict { disk_source, disk_revision } => {
                assert_eq!(disk_source, "# Disk");
                assert_eq!(disk_revision, document_revision(&file).unwrap());
            }
            other => panic!("expected a conflict, got {other:?}"),
        }
        assert_eq!(fs::read_to_string(&file).unwrap(), "# Disk");

        let forced = save_document_to_path(dir.path(), &file, "# Mine", None, true).unwrap();
        assert!(matches!(forced, SaveDocumentOutcome::Saved { .. }));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# Mine");
    }

    #[test]
    fn matching_revision_saves_and_returns_the_new_revision() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# A").unwrap();
        let current = document_revision(&file).unwrap();

        let result = save_document_to_path(dir.path(), &file, "# Longer body", Some(&current), false).unwrap();

        let SaveDocumentOutcome::Saved { revision } = result else { panic!("expected a save") };
        assert_eq!(revision, document_revision(&file).unwrap());
        assert_eq!(fs::read_to_string(&file).unwrap(), "# Longer body");
        assert!(leftover_temp_files(dir.path()).is_empty());
    }

    #[test]
    fn force_save_overwrites_a_stale_revision() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# A").unwrap();
        let old = document_revision(&file).unwrap();
        fs::write(&file, "# External").unwrap();

        let result = save_document_to_path(dir.path(), &file, "# Mine", Some(&old), true).unwrap();

        assert!(matches!(result, SaveDocumentOutcome::Saved { .. }));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# Mine");
    }

    #[test]
    fn relative_paths_resolve_against_the_workspace_root() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        let file = dir.path().join("sub").join("a.md");
        fs::write(&file, "# A").unwrap();
        let revision = document_revision(&file).unwrap();

        // The process working directory is unrelated to the workspace.
        let relative = Path::new("sub").join("a.md");
        let result = save_document_to_path(dir.path(), &relative, "# Saved", Some(&revision), false).unwrap();

        assert!(matches!(result, SaveDocumentOutcome::Saved { .. }));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# Saved");
    }

    #[test]
    fn relative_escape_and_outside_absolute_paths_are_rejected() {
        let root = tempfile::tempdir().unwrap();
        let workspace = root.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let outside = root.path().join("outside.md");
        fs::write(&outside, "# A").unwrap();

        let escape = save_document_to_path(&workspace, Path::new("../outside.md"), "# Nope", None, true).unwrap();
        assert!(matches!(escape, SaveDocumentOutcome::OutsideWorkspace));
        let absolute = save_document_to_path(&workspace, &outside, "# Nope", None, true).unwrap();
        assert!(matches!(absolute, SaveDocumentOutcome::OutsideWorkspace));
        assert_eq!(fs::read_to_string(&outside).unwrap(), "# A");
    }

    #[test]
    fn git_metadata_paths_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git").join("nested")).unwrap();
        let file = dir.path().join(".git").join("nested").join("notes.md");
        fs::write(&file, "# A").unwrap();

        let absolute = save_document_to_path(dir.path(), &file, "# Nope", None, true).unwrap();
        assert!(matches!(absolute, SaveDocumentOutcome::OutsideWorkspace));
        let relative = save_document_to_path(dir.path(), Path::new(".git/nested/notes.md"), "# Nope", None, true).unwrap();
        assert!(matches!(relative, SaveDocumentOutcome::OutsideWorkspace));
        let mixed_case = save_document_to_path(dir.path(), Path::new(".GIT/nested/notes.md"), "# Nope", None, true).unwrap();
        assert!(matches!(mixed_case, SaveDocumentOutcome::OutsideWorkspace));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# A");
    }

    #[test]
    fn path_outside_workspace_is_rejected() {
        let workspace = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let file = outside.path().join("escape.md");
        fs::write(&file, "# A").unwrap();

        let result = save_document_to_path(workspace.path(), &file, "# Nope", None, false).unwrap();

        assert!(matches!(result, SaveDocumentOutcome::OutsideWorkspace));
        assert_eq!(fs::read_to_string(&file).unwrap(), "# A");
    }

    #[test]
    fn missing_target_is_reported_without_creation() {
        let workspace = tempfile::tempdir().unwrap();
        let file = workspace.path().join("missing.md");

        let result = save_document_to_path(workspace.path(), &file, "# New", None, false).unwrap();

        assert!(matches!(result, SaveDocumentOutcome::Missing));
        assert!(!file.exists());
        let relative = save_document_to_path(workspace.path(), Path::new("missing.md"), "# New", None, false).unwrap();
        assert!(matches!(relative, SaveDocumentOutcome::Missing));
        assert!(leftover_temp_files(workspace.path()).is_empty());
    }

    #[test]
    fn read_only_target_fails_without_leaving_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# A").unwrap();
        let mut permissions = fs::metadata(&file).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&file, permissions.clone()).unwrap();

        let result = save_document_to_path(dir.path(), &file, "# Nope", None, true);

        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), "# A");
        assert!(leftover_temp_files(dir.path()).is_empty());
        #[allow(clippy::permissions_set_readonly_false)]
        permissions.set_readonly(false);
        fs::set_permissions(&file, permissions).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn saving_preserves_file_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "# A").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o640)).unwrap();

        save_document_to_path(dir.path(), &file, "# B", None, true).unwrap();

        assert_eq!(fs::metadata(&file).unwrap().permissions().mode() & 0o777, 0o640);
    }
}
