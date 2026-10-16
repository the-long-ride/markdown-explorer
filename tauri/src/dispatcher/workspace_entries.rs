use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[path = "workspace_entry_paths.rs"]
mod entry_paths;
pub(crate) use entry_paths::*;

type Failure = (&'static str, Option<String>);

pub(crate) fn create_entry(
    workspace: Option<&Path>,
    parent_path: Option<&str>,
    name: &str,
    kind: &str,
) -> Result<String, Failure> {
    if kind != "file" && kind != "folder" {
        return Err(("invalid-name", None));
    }
    if let Some(problem) = name_error(name) {
        return Err((
            if problem == "protected" {
                "protected"
            } else {
                "invalid-name"
            },
            None,
        ));
    }
    let mut parts = parent_path
        .and_then(split_relative)
        .ok_or(("outside-workspace", None))?;
    if has_protected_segment(&parts) {
        return Err(("protected", None));
    }
    if has_stream_segment(&parts, cfg!(windows)) {
        return Err(("invalid-name", None));
    }
    let base = resolve_base(workspace).map_err(|reason| (reason, None))?;
    let parent = fs::canonicalize(join_parts(&base, &parts))
        .map_err(|e| (error_reason(&e), Some(e.to_string())))?;
    let resolved = relative_segments(&base, &parent).ok_or(("outside-workspace", None))?;
    // The raw segments can hide .git (8.3 alias GIT~1, symlink/junction): re-check the resolved location.
    if has_protected_segment(&resolved) {
        return Err(("protected", None));
    }
    let target = parent.join(name);
    let created = if kind == "folder" {
        fs::create_dir(&target)
    } else {
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map(|_| ())
    };
    created.map_err(|e| (error_reason(&e), Some(e.to_string())))?;
    parts.push(name.to_string());
    Ok(parts.join("/"))
}

fn delete_one(
    base: &Path,
    entry: &str,
    trash_item: &impl Fn(&Path) -> Result<(), &'static str>,
) -> Result<(), &'static str> {
    let parts = split_relative(entry).ok_or("outside-workspace")?;
    if parts.is_empty() || has_protected_segment(&parts) {
        return Err("protected");
    }
    if has_stream_segment(&parts, cfg!(windows)) {
        return Err("invalid-name");
    }
    let parent = fs::canonicalize(join_parts(base, &parts[..parts.len() - 1]))
        .map_err(|e| error_reason(&e))?;
    let resolved = relative_segments(base, &parent).ok_or("outside-workspace")?;
    if has_protected_segment(&resolved) {
        return Err("protected");
    }
    // Only the parent is resolved, so a symlink entry is removed as a link.
    let target = parent.join(&parts[parts.len() - 1]);
    let meta = fs::symlink_metadata(&target).map_err(|e| error_reason(&e))?;
    if !meta.file_type().is_symlink() {
        // A real entry may still be .git under an alias (8.3 name): check where it truly lives.
        let real = fs::canonicalize(&target).map_err(|e| error_reason(&e))?;
        let resolved = relative_segments(base, &real).ok_or("outside-workspace")?;
        if has_protected_segment(&resolved) {
            return Err("protected");
        }
    }
    trash_item(&target)
}

pub(crate) fn delete_entries(
    workspace: Option<&Path>,
    paths: &[Option<String>],
    trash_item: impl Fn(&Path) -> Result<(), &'static str>,
) -> (Vec<String>, Vec<(String, &'static str)>) {
    let base = resolve_base(workspace);
    let mut deleted = Vec::new();
    let mut failed = Vec::new();
    for entry in paths {
        let Some(entry) = entry else {
            failed.push((String::new(), "outside-workspace"));
            continue;
        };
        let outcome = match &base {
            Ok(base) => delete_one(base, entry, &trash_item),
            Err(reason) => Err(*reason),
        };
        match outcome {
            Ok(()) => deleted.push(entry.clone()),
            Err(reason) => failed.push((entry.clone(), reason)),
        }
    }
    (deleted, failed)
}

pub(crate) fn rename_entry(
    workspace: Option<&Path>,
    entry: &str,
    name: &str,
    kind: &str,
) -> Result<String, Failure> {
    if kind != "file" && kind != "folder" {
        return Err(("invalid-name", None));
    }
    if let Some(problem) = name_error(name) {
        return Err((
            if problem == "protected" {
                "protected"
            } else {
                "invalid-name"
            },
            None,
        ));
    }
    let parts = split_relative(entry).ok_or(("outside-workspace", None))?;
    if parts.is_empty() || has_protected_segment(&parts) {
        return Err(("protected", None));
    }
    if has_stream_segment(&parts, cfg!(windows)) {
        return Err(("invalid-name", None));
    }
    let base = resolve_base(workspace).map_err(|reason| (reason, None))?;
    let parent = fs::canonicalize(join_parts(&base, &parts[..parts.len() - 1]))
        .map_err(|e| (error_reason(&e), Some(e.to_string())))?;
    let resolved = relative_segments(&base, &parent).ok_or(("outside-workspace", None))?;
    if has_protected_segment(&resolved) {
        return Err(("protected", None));
    }
    let source = parent.join(parts.last().unwrap());
    let meta =
        fs::symlink_metadata(&source).map_err(|e| (error_reason(&e), Some(e.to_string())))?;
    if !meta.file_type().is_symlink() {
        let real =
            fs::canonicalize(&source).map_err(|e| (error_reason(&e), Some(e.to_string())))?;
        let resolved = relative_segments(&base, &real).ok_or(("outside-workspace", None))?;
        if has_protected_segment(&resolved) {
            return Err(("protected", None));
        }
    }
    if (kind == "folder") != meta.is_dir() {
        return Err(("missing", None));
    }
    let target = parent.join(name);
    let mut next = parts[..parts.len() - 1].to_vec();
    next.push(name.to_string());
    if parts.last().unwrap() == name {
        return Ok(next.join("/"));
    }
    let same = if fs::symlink_metadata(&target).is_ok() {
        if !parts.last().unwrap().eq_ignore_ascii_case(name)
            || fs::canonicalize(&source).ok() != fs::canonicalize(&target).ok()
        {
            return Err(("exists", None));
        }
        true
    } else {
        false
    };
    let outcome = if same {
        let staging = parent.join(format!(".mdx-rename-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&staging).map_err(|e| (error_reason(&e), Some(e.to_string())))?;
        let staged = staging.join("entry");
        fs::rename(&source, &staged).map_err(|e| (error_reason(&e), Some(e.to_string())))?;
        let moved = fs::rename(&staged, &target);
        if moved.is_err() {
            fs::rename(&staged, &source).map_err(|e| (error_reason(&e), Some(e.to_string())))?;
        }
        let _ = fs::remove_dir(staging);
        moved
    } else if meta.is_file() {
        fs::hard_link(&source, &target)
            .or_else(|error| {
                if matches!(
                    error.kind(),
                    ErrorKind::Unsupported
                        | ErrorKind::PermissionDenied
                        | ErrorKind::CrossesDevices
                ) {
                    copy_file_exclusive(&source, &target)
                } else {
                    Err(error)
                }
            })
            .and_then(|_| {
                fs::remove_file(&source).inspect_err(|_| {
                    let _ = fs::remove_file(&target);
                })
            })
    } else {
        fs::rename(&source, &target)
    };
    outcome.map_err(|e| (error_reason(&e), Some(e.to_string())))?;
    Ok(next.join("/"))
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn rename_preserves_descendants_and_rejects_collisions() {
        let root = temp_dir("mdx-rename-rust");
        fs::create_dir(root.join("docs")).unwrap();
        fs::write(root.join("docs/a.md"), "keep").unwrap();
        assert_eq!(
            rename_entry(Some(&root), "docs/a.md", "b.md", "file").unwrap(),
            "docs/b.md"
        );
        assert_eq!(
            rename_entry(Some(&root), "docs", "notes", "folder").unwrap(),
            "notes"
        );
        assert_eq!(fs::read_to_string(root.join("notes/b.md")).unwrap(), "keep");
        fs::write(root.join("notes/c.md"), "other").unwrap();
        assert_eq!(
            rename_entry(Some(&root), "notes/b.md", "c.md", "file")
                .unwrap_err()
                .0,
            "exists"
        );
        assert_eq!(
            rename_entry(Some(&root), "../notes", "x", "folder")
                .unwrap_err()
                .0,
            "outside-workspace"
        );
        fs::remove_dir_all(root).unwrap();
    }

    fn remove(path: &Path) -> Result<(), &'static str> {
        let meta = fs::symlink_metadata(path).map_err(|e| error_reason(&e))?;
        let result = if meta.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        };
        result.map_err(|e| error_reason(&e))
    }

    #[cfg(unix)]
    fn link_dir(target: &Path, link: &Path) -> bool {
        std::os::unix::fs::symlink(target, link).is_ok()
    }

    #[cfg(windows)]
    fn link_dir(target: &Path, link: &Path) -> bool {
        if std::os::windows::fs::symlink_dir(target, link).is_ok() {
            return true;
        }
        // Directory symlinks need a privilege; junctions do not.
        std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(any(unix, windows)))]
    fn link_dir(_target: &Path, _link: &Path) -> bool {
        false
    }

    fn some_paths(paths: &[&str]) -> Vec<Option<String>> {
        paths.iter().map(|path| Some(path.to_string())).collect()
    }

    fn segs(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|part| part.to_string()).collect()
    }

    #[test]
    fn protected_and_stream_segment_helpers() {
        assert!(has_protected_segment(&segs(&[".git"])));
        assert!(has_protected_segment(&segs(&["docs", ".GIT"])));
        assert!(has_protected_segment(&segs(&["a", ".git "])));
        assert!(!has_protected_segment(&segs(&["ok"])));
        assert!(!has_protected_segment(&[]));
        assert!(has_stream_segment(&segs(&["a.md:stream"]), true));
        assert!(has_stream_segment(
            &segs(&[".git::$INDEX_ALLOCATION"]),
            true
        ));
        assert!(!has_stream_segment(&segs(&["a.md:stream"]), false));
        assert!(!has_stream_segment(&segs(&["ok"]), true));
    }

    #[test]
    fn relative_segments_only_below_base() {
        let base = Path::new("base");
        assert_eq!(
            relative_segments(base, &base.join(".git").join("x")),
            Some(segs(&[".git", "x"]))
        );
        assert_eq!(relative_segments(base, base), Some(Vec::new()));
        assert_eq!(relative_segments(base, Path::new("other")), None);
    }

    #[test]
    fn create_and_delete_refuse_links_into_dot_git() {
        let root = temp_dir("tauri-entries-gitlink");
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join(".git/config"), "keep").unwrap();
        if !link_dir(&root.join(".git"), &root.join("alias")) {
            let _ = fs::remove_dir_all(&root);
            assert!(
                std::env::var_os("CI").is_none(),
                "cannot create directory links on this CI runner; the .git link coverage must not be skipped"
            );
            eprintln!("skipped: cannot create directory links on this runner");
            return;
        }
        assert_eq!(
            create_entry(Some(&root), Some("alias"), "index.lock", "file")
                .unwrap_err()
                .0,
            "protected"
        );
        assert!(!root.join(".git/index.lock").exists());
        let trashed = std::cell::RefCell::new(Vec::<PathBuf>::new());
        let record = |path: &Path| -> Result<(), &'static str> {
            trashed.borrow_mut().push(path.to_path_buf());
            Ok(())
        };
        let paths = some_paths(&["alias/config", "alias"]);
        let (deleted, failed) = delete_entries(Some(&root), &paths, record);
        assert_eq!(failed, vec![("alias/config".to_string(), "protected")]);
        assert_eq!(deleted, vec!["alias".to_string()]);
        // The link itself is trashed, never what it points at.
        assert_eq!(trashed.borrow().len(), 1);
        assert!(trashed.borrow()[0].ends_with("alias"));
        assert!(root.join(".git/config").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(windows)]
    #[test]
    fn windows_rejects_alternate_stream_segments() {
        let root = temp_dir("tauri-entries-ads");
        assert_eq!(
            create_entry(Some(&root), Some("a:b"), "x.md", "file")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        let paths = some_paths(&[".git::$INDEX_ALLOCATION", "a.md:stream"]);
        let (deleted, failed) = delete_entries(Some(&root), &paths, remove);
        assert!(deleted.is_empty());
        assert_eq!(
            failed,
            vec![
                (".git::$INDEX_ALLOCATION".to_string(), "invalid-name"),
                ("a.md:stream".to_string(), "invalid-name"),
            ]
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn name_rules_match_shared_fixture() {
        let raw = fs::read_to_string(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../tests/fixtures/workspace-entry-names.json"),
        )
        .unwrap();
        let fixture: Value = serde_json::from_str(&raw).unwrap();
        for name in fixture["valid"].as_array().unwrap() {
            assert_eq!(name_error(name.as_str().unwrap()), None, "{name}");
        }
        for pair in fixture["invalid"].as_array().unwrap() {
            let name = pair[0].as_str().unwrap();
            assert_eq!(
                name_error(name),
                Some(pair[1].as_str().unwrap()),
                "{name:?}"
            );
        }
    }

    #[test]
    fn creates_files_and_folders_without_overwriting() {
        let root = temp_dir("tauri-entries-create");
        assert_eq!(
            create_entry(Some(&root), Some(""), "docs", "folder").unwrap(),
            "docs"
        );
        assert_eq!(
            create_entry(Some(&root), Some("docs"), "a.md", "file").unwrap(),
            "docs/a.md"
        );
        fs::write(root.join("docs/a.md"), "keep").unwrap();
        assert_eq!(
            create_entry(Some(&root), Some("docs"), "a.md", "file")
                .unwrap_err()
                .0,
            "exists"
        );
        assert_eq!(fs::read_to_string(root.join("docs/a.md")).unwrap(), "keep");
    }

    #[test]
    fn create_rejects_bad_targets() {
        let root = temp_dir("tauri-entries-bad");
        assert_eq!(
            create_entry(Some(&root), Some(""), "bad:name", "file")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        assert_eq!(
            create_entry(Some(&root), Some(""), ".git", "folder")
                .unwrap_err()
                .0,
            "protected"
        );
        assert_eq!(
            create_entry(Some(&root), Some(".git"), "x.md", "file")
                .unwrap_err()
                .0,
            "protected"
        );
        assert_eq!(
            create_entry(Some(&root), Some("../x"), "x.md", "file")
                .unwrap_err()
                .0,
            "outside-workspace"
        );
        assert_eq!(
            create_entry(Some(&root), Some("missing"), "x.md", "file")
                .unwrap_err()
                .0,
            "missing"
        );
        assert_eq!(
            create_entry(None, Some(""), "x.md", "file").unwrap_err().0,
            "unsupported"
        );
        let single = root.join("only.md");
        fs::write(&single, "# only").unwrap();
        assert_eq!(
            create_entry(Some(&single), Some(""), "x.md", "file")
                .unwrap_err()
                .0,
            "unsupported"
        );
    }

    #[test]
    fn delete_reports_each_path() {
        let root = temp_dir("tauri-entries-delete");
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::write(root.join("docs/a.md"), "a").unwrap();
        fs::write(root.join("b.md"), "b").unwrap();
        let paths = some_paths(&["docs", "b.md", "nope.md", "", ".git/config", "../x"]);
        let (deleted, failed) = delete_entries(Some(&root), &paths, remove);
        assert_eq!(deleted, vec!["docs".to_string(), "b.md".to_string()]);
        assert_eq!(
            failed,
            vec![
                ("nope.md".to_string(), "missing"),
                ("".to_string(), "protected"),
                (".git/config".to_string(), "protected"),
                ("../x".to_string(), "outside-workspace"),
            ]
        );
        assert!(!root.join("docs").exists());
    }

    #[test]
    fn rejects_non_string_style_inputs_and_cleans_up() {
        let root = temp_dir("tauri-entries-extra");
        assert_eq!(
            create_entry(Some(&root), Some(""), "", "file")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        assert_eq!(
            create_entry(Some(&root), Some(""), "x.md", "other")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        assert_eq!(
            create_entry(Some(&root), Some("a//b"), "x.md", "file")
                .unwrap_err()
                .0,
            "outside-workspace"
        );
        let (deleted, failed) = delete_entries(None, &some_paths(&["x.md"]), remove);
        assert!(deleted.is_empty());
        assert_eq!(failed, vec![("x.md".to_string(), "unsupported")]);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn parent_path_arg_mirrors_electron() {
        use serde_json::json;
        assert_eq!(parent_path_arg(&json!({})), Some(String::new()));
        assert_eq!(
            parent_path_arg(&json!({ "parentPath": null })),
            Some(String::new())
        );
        assert_eq!(
            parent_path_arg(&json!({ "parentPath": "" })),
            Some(String::new())
        );
        assert_eq!(
            parent_path_arg(&json!({ "parentPath": "docs/sub" })),
            Some("docs/sub".to_string())
        );
        assert_eq!(parent_path_arg(&json!({ "parentPath": 5 })), None);
        assert_eq!(parent_path_arg(&json!({ "parentPath": true })), None);
        assert_eq!(parent_path_arg(&json!({ "parentPath": ["docs"] })), None);
        assert_eq!(parent_path_arg(&json!({ "parentPath": { "a": 1 } })), None);
    }

    #[test]
    fn non_string_parent_is_outside_workspace_but_name_and_kind_are_checked_first() {
        let root = temp_dir("tauri-entries-parent-arg");
        assert_eq!(
            create_entry(Some(&root), None, "x.md", "file")
                .unwrap_err()
                .0,
            "outside-workspace"
        );
        assert!(!root.join("x.md").exists());
        assert_eq!(
            create_entry(Some(&root), None, "bad:name", "file")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        assert_eq!(
            create_entry(Some(&root), None, "x.md", "other")
                .unwrap_err()
                .0,
            "invalid-name"
        );
        assert_eq!(
            create_entry(Some(&root), Some(""), "x.md", "file").unwrap(),
            "x.md"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_paths_arg_keeps_positions_of_non_string_elements() {
        use serde_json::json;
        assert_eq!(
            delete_paths_arg(&json!({ "paths": ["a.md", 5, null, "", { "p": 1 }, "b.md"] })),
            vec![
                Some("a.md".to_string()),
                None,
                None,
                Some(String::new()),
                None,
                Some("b.md".to_string())
            ],
        );
        assert!(delete_paths_arg(&json!({})).is_empty());
        assert!(delete_paths_arg(&json!({ "paths": "a.md" })).is_empty());
    }

    #[test]
    fn non_string_delete_element_fails_as_outside_workspace_not_protected() {
        let root = temp_dir("tauri-entries-delete-arg");
        fs::write(root.join("a.md"), "a").unwrap();
        let paths = vec![None, Some("a.md".to_string()), Some(String::new()), None];
        let (deleted, failed) = delete_entries(Some(&root), &paths, remove);
        assert_eq!(deleted, vec!["a.md".to_string()]);
        assert_eq!(
            failed,
            vec![
                (String::new(), "outside-workspace"),
                (String::new(), "protected"),
                (String::new(), "outside-workspace"),
            ]
        );
        // Without a usable workspace a non-string element still reports outside-workspace, like Electron.
        let (deleted, failed) = delete_entries(None, &[None], remove);
        assert!(deleted.is_empty());
        assert_eq!(failed, vec![(String::new(), "outside-workspace")]);
        let _ = fs::remove_dir_all(&root);
    }
}
