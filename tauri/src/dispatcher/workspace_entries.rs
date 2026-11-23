use crate::workspace_entry_operations::*;
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(not(test))]
fn os_permanent(path: &Path) -> Result<(), &'static str> {
    let meta = fs::symlink_metadata(path).map_err(|e| error_reason(&e))?;
    let outcome = if meta.is_dir() && !meta.file_type().is_symlink() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };
    outcome.map_err(|e| error_reason(&e))
}

#[cfg(not(test))]
fn os_trash(path: &Path) -> Result<(), &'static str> {
    trash::delete(path).map_err(|_| "failed")
}

#[cfg(not(test))]
impl super::Dispatcher {
    /// Returns true when `cmd` was a workspace-entry command. Refreshes before emitting a successful result.
    pub(in crate::dispatcher) async fn handle_workspace_entry_command(
        &self,
        cmd: &str,
        msg: &serde_json::Value,
    ) -> bool {
        use serde_json::{Map, Value};

        if cmd != "createWorkspaceEntry"
            && cmd != "deleteWorkspaceEntries"
            && cmd != "renameWorkspaceEntry"
        {
            return false;
        }
        let request_id = msg
            .get("requestId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        // Clone so the state lock is released before any await.
        let workspace: Option<PathBuf> = self.state.inner.read().workspace_path.clone();
        let mut extra = Map::new();
        extra.insert("requestId".into(), Value::from(request_id));
        if cmd == "createWorkspaceEntry" {
            let parent = parent_path_arg(msg);
            let name = msg.get("name").and_then(Value::as_str).unwrap_or("");
            let kind = msg.get("kind").and_then(Value::as_str).unwrap_or("");
            match create_entry(workspace.as_deref(), parent.as_deref(), name, kind) {
                Ok(path) => {
                    self.refresh_active_workspace(true, "").await;
                    extra.insert("ok".into(), Value::Bool(true));
                    extra.insert("path".into(), Value::from(path));
                    extra.insert("kind".into(), Value::from(kind));
                }
                Err((reason, error)) => {
                    extra.insert("ok".into(), Value::Bool(false));
                    extra.insert("reason".into(), Value::from(reason));
                    if let Some(error) = error {
                        extra.insert("error".into(), Value::from(error));
                    }
                }
            }
            crate::host_message::emit(&self.app, "createWorkspaceEntryResult", extra);
            return true;
        }
        if cmd == "renameWorkspaceEntry" {
            let entry = msg.get("path").and_then(Value::as_str).unwrap_or("");
            let name = msg.get("name").and_then(Value::as_str).unwrap_or("");
            let kind = msg.get("kind").and_then(Value::as_str).unwrap_or("");
            let result = rename_entry(workspace.as_deref(), entry, name, kind);
            match &result {
                Ok(path) => {
                    extra.insert("ok".into(), Value::Bool(true));
                    extra.insert("path".into(), Value::from(path.clone()));
                    extra.insert("oldPath".into(), Value::from(entry));
                    extra.insert("kind".into(), Value::from(kind));
                }
                Err((reason, error)) => {
                    extra.insert("ok".into(), Value::Bool(false));
                    extra.insert("reason".into(), Value::from(*reason));
                    if let Some(error) = error {
                        extra.insert("error".into(), Value::from(error.clone()));
                    }
                }
            }
            if let (Ok(path), Some(base)) = (&result, &workspace) {
                let old = base.join(entry);
                let next = base.join(path);
                let mut state = self.state.inner.write();
                if state.workspace_path.as_ref() == Some(base) {
                    if let Some(current) = state.current_file.as_ref() {
                        if let Ok(suffix) = current.strip_prefix(&old) {
                            state.current_file = Some(next.join(suffix));
                        }
                    }
                }
            }
            crate::host_message::emit(&self.app, "renameWorkspaceEntryResult", extra);
            if result.is_ok() {
                self.refresh_active_workspace(true, "").await;
            }
            return true;
        }
        let permanent = msg.get("mode").and_then(Value::as_str) == Some("permanent");
        let paths = delete_paths_arg(msg);
        let paths_for_trash = paths.clone();
        let outcome = tokio::task::spawn_blocking(move || {
            delete_entries(
                workspace.as_deref(),
                &paths_for_trash,
                if permanent { os_permanent } else { os_trash },
            )
        })
        .await;
        let (deleted, failed) = outcome.unwrap_or_else(|_| {
            (
                Vec::new(),
                paths
                    .into_iter()
                    .map(|path| (path.unwrap_or_default(), "failed"))
                    .collect(),
            )
        });
        if !deleted.is_empty() {
            self.refresh_active_workspace(true, "").await;
        }
        let failed: Vec<Value> = failed
            .into_iter()
            .map(|(path, reason)| serde_json::json!({ "path": path, "reason": reason }))
            .collect();
        extra.insert(
            "mode".into(),
            Value::from(if permanent { "permanent" } else { "trash" }),
        );
        extra.insert("deleted".into(), Value::from(deleted));
        extra.insert("failed".into(), Value::Array(failed));
        crate::host_message::emit(&self.app, "deleteWorkspaceEntriesResult", extra);
        true
    }
}
