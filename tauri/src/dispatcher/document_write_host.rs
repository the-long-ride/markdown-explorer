use crate::document_write::{save_document_to_path, SaveDocumentOutcome};
use std::path::Path;

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
            .map(|workspace| {
                save_document_to_path(
                    workspace,
                    Path::new(file_path),
                    source,
                    expected_revision,
                    force,
                )
            });

        match outcome {
            None => {
                extra.insert("ok".into(), false.into());
                extra.insert("reason".into(), "read-only".into());
            }
            Some(Ok(SaveDocumentOutcome::Saved { revision })) => {
                extra.insert("ok".into(), true.into());
                extra.insert("revision".into(), revision.into());
            }
            Some(Ok(SaveDocumentOutcome::Conflict {
                disk_source,
                disk_revision,
            })) => {
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
