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
