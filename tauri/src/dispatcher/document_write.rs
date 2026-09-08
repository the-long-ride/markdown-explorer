use std::fs;
use std::path::Path;
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

pub(super) fn save_document_to_path(
    workspace_path: &Path,
    file_path: &Path,
    source: &str,
    expected_revision: Option<&str>,
    force: bool,
) -> Result<SaveDocumentOutcome, String> {
    if !file_path.exists() || !file_path.is_file() {
        return Ok(SaveDocumentOutcome::Missing);
    }

    let workspace_base = if workspace_path.is_file() {
        workspace_path.parent().unwrap_or(workspace_path)
    } else {
        workspace_path
    };
    let workspace_base = fs::canonicalize(workspace_base).map_err(|error| error.to_string())?;
    let target = fs::canonicalize(file_path).map_err(|error| error.to_string())?;
    if !target.starts_with(&workspace_base) {
        return Ok(SaveDocumentOutcome::OutsideWorkspace);
    }

    let disk_revision = document_revision(&target)?;
    if !force && expected_revision.is_some_and(|expected| expected != disk_revision) {
        let disk_source = fs::read_to_string(&target).map_err(|error| error.to_string())?;
        return Ok(SaveDocumentOutcome::Conflict {
            disk_source,
            disk_revision,
        });
    }

    fs::write(&target, source).map_err(|error| error.to_string())?;
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
    }
}
