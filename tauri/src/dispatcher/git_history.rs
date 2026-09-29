use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
#[cfg(test)]
use std::process::Command;

pub const MAX_GIT_OUTPUT_BYTES: usize = 16 * 1024 * 1024;

#[path = "git_runner.rs"]
mod git_runner;
use git_runner::run_git;
pub(super) const DEFAULT_HISTORY_LIMIT: usize = 100;
pub(super) const MAX_HISTORY_LIMIT: usize = 500;

#[path = "git_repository.rs"]
mod git_repository;
#[allow(unused_imports)]
pub use git_repository::{
    list_repository_history_page, list_revision_files, read_revision_file,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionSummary {
    pub oid: String,
    pub short_oid: String,
    pub author: String,
    pub authored_at: String,
    pub subject: String,
    pub path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionSnapshot {
    pub oid: String,
    pub path: String,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GitCompareSide {
    Revision { oid: String, path: String },
    Current { path: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitComparisonSources {
    pub left_source: String,
    pub right_source: String,
    pub left_label: String,
    pub right_label: String,
}

#[derive(Debug, PartialEq, Eq)]
pub struct GitHistoryError {
    pub reason: &'static str,
    pub message: String,
}

pub(super) fn error(reason: &'static str, message: impl Into<String>) -> GitHistoryError {
    GitHistoryError { reason, message: message.into() }
}

fn workspace_directory(workspace_path: &Path) -> PathBuf {
    match fs::metadata(workspace_path) {
        Ok(metadata) if metadata.is_file() => workspace_path.parent().unwrap_or(workspace_path).to_path_buf(),
        _ => workspace_path.to_path_buf(),
    }
}

pub(super) fn resolve_context(workspace_path: &Path) -> Result<(PathBuf, PathBuf), GitHistoryError> {
    let workspace = workspace_directory(workspace_path);
    let root = run_git(&workspace, &["rev-parse".into(), "--show-toplevel".into()])?;
    let trimmed = root.trim();
    if trimmed.is_empty() { return Err(error("not-repository", "The workspace is not a Git repository")); }
    let repository_root = PathBuf::from(trimmed);
    let repository_root = fs::canonicalize(&repository_root).unwrap_or(repository_root);
    let workspace_root = fs::canonicalize(&workspace).unwrap_or(workspace);
    if !workspace_root.starts_with(&repository_root) {
        return Err(error("not-repository", "The workspace is outside the Git repository"));
    }
    Ok((repository_root, workspace_root))
}

pub(super) fn validate_oid(oid: &str) -> Result<String, GitHistoryError> {
    if !matches!(oid.len(), 40 | 64) || !oid.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(error("invalid-revision", "Invalid revision identifier"));
    }
    Ok(oid.to_ascii_lowercase())
}

pub(super) fn assert_workspace_path(workspace_root: &Path, absolute: &Path) -> Result<(), GitHistoryError> {
    if !absolute.starts_with(workspace_root) {
        return Err(error("outside-workspace", "Document path is outside workspace"));
    }
    Ok(())
}

fn validate_git_path(repository_root: &Path, workspace_root: &Path, value: &str) -> Result<String, GitHistoryError> {
    if value.is_empty() { return Err(error("outside-repository", "Document path is outside repository")); }
    let path = Path::new(value);
    if path.is_absolute() { return Err(error("outside-repository", "Document path is outside repository")); }
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(error("outside-repository", "Document path is outside repository"));
            }
        }
    }
    if parts.is_empty() { return Err(error("outside-repository", "Document path is outside repository")); }
    let absolute = parts.iter().fold(repository_root.to_path_buf(), |current, part| current.join(part));
    assert_workspace_path(workspace_root, &absolute)?;
    Ok(parts.join("/"))
}

fn repository_relative_path(repository_root: &Path, workspace_root: &Path, file_path: &Path) -> Result<String, GitHistoryError> {
    let absolute = if file_path.is_absolute() { file_path.to_path_buf() } else { repository_root.join(file_path) };
    let root = fs::canonicalize(repository_root).unwrap_or_else(|_| repository_root.to_path_buf());
    let target = fs::canonicalize(&absolute).unwrap_or(absolute);
    let relative = target.strip_prefix(&root).map_err(|_| error("outside-repository", "Document path is outside repository"))?;
    assert_workspace_path(workspace_root, &target)?;
    validate_git_path(&root, workspace_root, &relative.to_string_lossy())
}

pub(super) fn path_to_git(path: &Path) -> String {
    path.components().filter_map(|component| match component {
        Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
        _ => None,
    }).collect::<Vec<_>>().join("/")
}

/// Parses `git log --format=%x1e<fields> --name-status -M -z`. Each record is
/// `\x1e H \x1f author \x1f date \x1f subject \0 \n STATUS \0 path \0 [path \0]...`, so paths are
/// taken verbatim (never trimmed or unquoted).
fn parse_history(output: &str, initial_path: &str) -> Vec<GitRevisionSummary> {
    let mut tracked_path = initial_path.to_owned();
    let mut revisions = Vec::new();
    for record in output.split('\x1e').skip(1) {
        let (header, changes) = record.split_once('\0').unwrap_or((record, ""));
        let mut fields = header.trim_start_matches(['\r', '\n']).split('\x1f');
        let oid = fields.next().unwrap_or_default();
        if validate_oid(oid).is_err() { continue; }
        revisions.push(GitRevisionSummary {
            oid: oid.to_owned(),
            short_oid: oid.chars().take(7).collect(),
            author: fields.next().unwrap_or_default().to_owned(),
            authored_at: fields.next().unwrap_or_default().to_owned(),
            subject: fields.next().unwrap_or_default().to_owned(),
            path: tracked_path.clone(),
        });
        let mut tokens = changes.strip_prefix('\n').unwrap_or(changes).split('\0');
        while let Some(status) = tokens.next() {
            if status.is_empty() { continue; }
            if status.starts_with('R') || status.starts_with('C') {
                let old_path = tokens.next().unwrap_or_default();
                let new_path = tokens.next().unwrap_or_default();
                if status.starts_with('R') && status[1..].bytes().all(|byte| byte.is_ascii_digit()) && new_path == tracked_path {
                    tracked_path = old_path.to_owned();
                    break;
                }
            } else {
                tokens.next();
            }
        }
    }
    revisions
}

pub fn list_document_history(workspace_path: &Path, file_path: &Path, limit: usize) -> Result<Vec<GitRevisionSummary>, GitHistoryError> {
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let git_path = repository_relative_path(&repository_root, &workspace_root, file_path)?;
    let limit = if limit == 0 { DEFAULT_HISTORY_LIMIT } else { limit.min(MAX_HISTORY_LIMIT) };
    let output = run_git(&repository_root, &[
        "log".into(), "--follow".into(), "--format=%x1e%H%x1f%an%x1f%aI%x1f%s".into(),
        "--name-status".into(), "-M".into(), "-z".into(), "-n".into(), limit.to_string(), "--".into(), git_path.clone(),
    ])?;
    Ok(parse_history(&output, &git_path))
}

pub fn read_git_revision(workspace_path: &Path, oid: &str, revision_path: &str) -> Result<GitRevisionSnapshot, GitHistoryError> {
    let oid = validate_oid(oid)?;
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let git_path = validate_git_path(&repository_root, &workspace_root, revision_path)?;
    let source = run_git(&repository_root, &["show".into(), format!("{oid}:{git_path}")])?;
    Ok(GitRevisionSnapshot { oid, path: git_path, source })
}

fn read_compare_side(repository_root: &Path, workspace_root: &Path, side: &GitCompareSide) -> Result<(String, String), GitHistoryError> {
    match side {
        GitCompareSide::Revision { oid, path } => {
            let oid = validate_oid(oid)?;
            let git_path = validate_git_path(repository_root, workspace_root, path)?;
            let source = run_git(repository_root, &["show".into(), format!("{oid}:{git_path}")])?;
            Ok((source, format!("{}:{git_path}", &oid[..7])))
        }
        GitCompareSide::Current { path } => {
            let git_path = repository_relative_path(repository_root, workspace_root, Path::new(path))?;
            let source = fs::read_to_string(repository_root.join(&git_path)).map_err(|err| error("unreadable", err.to_string()))?;
            Ok((source, format!("Current:{git_path}")))
        }
    }
}

pub fn compare_git_sources(workspace_path: &Path, left: &GitCompareSide, right: &GitCompareSide) -> Result<GitComparisonSources, GitHistoryError> {
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let (left_source, left_label) = read_compare_side(&repository_root, &workspace_root, left)?;
    let (right_source, right_label) = read_compare_side(&repository_root, &workspace_root, right)?;
    Ok(GitComparisonSources { left_source, right_source, left_label, right_label })
}

fn compare_side_from_value(value: &serde_json::Value) -> Result<GitCompareSide, GitHistoryError> {
    let kind = value.get("kind").and_then(serde_json::Value::as_str).unwrap_or_default();
    let path = value.get("path").and_then(serde_json::Value::as_str).unwrap_or_default().to_owned();
    match kind {
        "revision" => Ok(GitCompareSide::Revision {
            oid: value.get("oid").and_then(serde_json::Value::as_str).unwrap_or_default().to_owned(), path,
        }),
        "current" => Ok(GitCompareSide::Current { path }),
        _ => Err(error("invalid-comparison", "Invalid comparison side")),
    }
}

#[cfg(not(test))]
const GIT_COMMANDS: &[&str] = &[
    "listDocumentHistory", "readGitRevision", "compareGitRevisions",
    "listRepositoryHistory", "listRevisionFiles", "readRevisionFile",
];

#[cfg(not(test))]
fn result_command(cmd: &str) -> &'static str {
    match cmd {
        "listDocumentHistory" => "documentHistoryResult",
        "listRepositoryHistory" => "repositoryHistoryResult",
        "listRevisionFiles" => "revisionFilesResult",
        "readRevisionFile" => "revisionFileResult",
        "readGitRevision" => "gitRevisionResult",
        _ => "gitComparisonResult",
    }
}

/// Field that carries the list payload of a failed result; the UI expects an empty array there.
fn empty_list_field(cmd: &str) -> Option<&'static str> {
    match cmd {
        "listDocumentHistory" => Some("revisions"),
        "listRepositoryHistory" => Some("commits"),
        "listRevisionFiles" => Some("files"),
        _ => None,
    }
}

fn to_json<T: Serialize>(value: T) -> serde_json::Value {
    serde_json::to_value(value).unwrap_or_default()
}

/// Runs one Git history command to completion and builds the response fields. Blocking (spawns
/// Git); call from `spawn_blocking`.
fn execute_command(
    cmd: &str,
    workspace_path: Option<&Path>,
    msg: &serde_json::Value,
) -> serde_json::Map<String, serde_json::Value> {
    use serde_json::Value;
    let text = |key: &str| msg.get(key).and_then(Value::as_str).unwrap_or_default();
    let mut extra = serde_json::Map::new();
    let result: Result<(&'static str, Value), GitHistoryError> = (|| {
        let root = workspace_path.ok_or_else(|| error("not-repository", "No workspace"))?;
        match cmd {
            "listDocumentHistory" => {
                let limit = msg.get("limit").and_then(Value::as_u64).unwrap_or(DEFAULT_HISTORY_LIMIT as u64) as usize;
                list_document_history(root, Path::new(text("filePath")), limit).map(|items| ("revisions", to_json(items)))
            }
            "listRepositoryHistory" => list_repository_history_page(
                root,
                msg.get("limit").and_then(Value::as_u64).unwrap_or(DEFAULT_HISTORY_LIMIT as u64) as usize,
                msg.get("offset").and_then(Value::as_u64).map(|offset| offset as usize),
                msg.get("before").and_then(Value::as_str),
                msg.get("allRefs").and_then(Value::as_bool).unwrap_or(false),
            ).map(|items| ("commits", to_json(items))),
            "listRevisionFiles" => list_revision_files(root, text("oid")).map(|items| ("files", to_json(items))),
            "readRevisionFile" => read_revision_file(root, text("oid"), text("path")).map(|snapshot| ("snapshot", to_json(snapshot))),
            "readGitRevision" => read_git_revision(root, text("oid"), text("path")).map(|snapshot| ("snapshot", to_json(snapshot))),
            _ => {
                let left = compare_side_from_value(msg.get("left").unwrap_or(&Value::Null))?;
                let right = compare_side_from_value(msg.get("right").unwrap_or(&Value::Null))?;
                compare_git_sources(root, &left, &right).map(|sources| ("comparison", to_json(sources)))
            }
        }
    })();
    extra.insert("ok".into(), result.is_ok().into());
    match result {
        Ok(("comparison", Value::Object(fields))) => extra.extend(fields),
        Ok((key, value)) => { extra.insert(key.into(), value); }
        Err(err) => {
            if let Some(field) = empty_list_field(cmd) { extra.insert(field.into(), serde_json::json!([])); }
            extra.insert("reason".into(), err.reason.into());
        }
    }
    extra
}

#[cfg(not(test))]
pub(super) async fn handle_command(app: &tauri::AppHandle, state: &crate::app_state::AppState, cmd: &str, msg: &serde_json::Value) -> Result<bool, String> {
    if !GIT_COMMANDS.contains(&cmd) { return Ok(false); }
    let request_id = msg.get("requestId").and_then(serde_json::Value::as_str).unwrap_or_default().to_owned();
    let workspace_path = state.inner.read().workspace_path.clone();
    let (command, message) = (cmd.to_owned(), msg.clone());
    // Git can take seconds on large repositories: keep it off the async dispatcher threads.
    let joined = tauri::async_runtime::spawn_blocking(move || execute_command(&command, workspace_path.as_deref(), &message)).await;
    let mut extra = match joined {
        Ok(extra) => extra,
        Err(err) => {
            let mut extra = serde_json::Map::new();
            extra.insert("ok".into(), false.into());
            if let Some(field) = empty_list_field(cmd) { extra.insert(field.into(), serde_json::json!([])); }
            extra.insert("reason".into(), "git-command-failed".into());
            eprintln!("[git-history] {cmd} task failed: {err}");
            extra
        }
    };
    extra.insert("requestId".into(), request_id.into());
    crate::host_message::emit(app, result_command(cmd), extra);
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::git_repository::{
        list_repository_history, GitRevisionFile, GitRevisionFileSnapshot,
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRepo(PathBuf);
    impl Drop for TempRepo { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

    fn git(repo: &Path, args: &[&str]) -> String {
        let output = Command::new("git").current_dir(repo).args(args).output().expect("git should run");
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        String::from_utf8(output.stdout).unwrap()
    }

    fn create_repo() -> TempRepo {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let root = std::env::temp_dir().join(format!("md-explorer-tauri-history-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init"]); git(&root, &["config", "user.name", "Markdown Explorer Tests"]); git(&root, &["config", "user.email", "tests@example.invalid"]);
        TempRepo(root)
    }

    fn commit_file(repo: &Path, rel: &str, source: &str, subject: &str) -> String {
        let file = repo.join(rel); if let Some(parent) = file.parent() { fs::create_dir_all(parent).unwrap(); }
        fs::write(&file, source).unwrap(); git(repo, &["add", "--", rel]); git(repo, &["commit", "-m", subject]); git(repo, &["rev-parse", "HEAD"]).trim().to_owned()
    }

    fn create_snapshot_fixture() -> (TempRepo, PathBuf, String) {
        let repo = create_repo();
        commit_file(&repo.0, "workspace/a.md", "# root\n", "root document");
        commit_file(&repo.0, "outside.md", "# outside\n", "outside workspace");
        let base_branch = git(&repo.0, &["rev-parse", "--abbrev-ref", "HEAD"]).trim().to_owned();
        git(&repo.0, &["checkout", "-b", "snapshot-side"]);
        commit_file(&repo.0, "workspace/side.md", "# side\n", "side document");
        git(&repo.0, &["checkout", &base_branch]);
        commit_file(&repo.0, "workspace/main.md", "# main\n", "main document");
        git(&repo.0, &["merge", "--no-ff", "snapshot-side", "-m", "merge side branch"]);
        let merge_oid = git(&repo.0, &["rev-parse", "HEAD"]).trim().to_owned();
        let workspace = repo.0.join("workspace");
        (repo, workspace, merge_oid)
    }

    #[test]
    fn detects_repository_and_lists_rename_aware_history() {
        let repo = create_repo(); commit_file(&repo.0, "old.md", "# one\n", "first"); git(&repo.0, &["mv", "--", "old.md", "new.md"]); git(&repo.0, &["commit", "-m", "rename"]);
        let revisions = list_document_history(&repo.0, &repo.0.join("new.md"), 20).unwrap();
        assert_eq!(revisions.iter().map(|item| item.subject.as_str()).collect::<Vec<_>>(), vec!["rename", "first"]);
        assert_eq!(revisions.iter().map(|item| item.path.as_str()).collect::<Vec<_>>(), vec!["new.md", "old.md"]);
    }

    #[test]
    fn reads_snapshots_and_compares_to_current_working_tree() {
        let repo = create_repo(); let oid = commit_file(&repo.0, "a.md", "# committed\n", "first"); fs::write(repo.0.join("a.md"), "# working\n").unwrap();
        assert_eq!(read_git_revision(&repo.0, &oid, "a.md").unwrap().source, "# committed\n");
        let comparison = compare_git_sources(&repo.0, &GitCompareSide::Revision { oid: oid.clone(), path: "a.md".into() }, &GitCompareSide::Current { path: repo.0.join("a.md").to_string_lossy().into_owned() }).unwrap();
        assert_eq!(comparison.left_source, "# committed\n"); assert_eq!(comparison.right_source, "# working\n");
    }

    #[test]
    fn rejects_invalid_full_revision_identifiers() {
        let repo = create_repo(); let error = read_git_revision(&repo.0, "HEAD;rm -rf .", "a.md").unwrap_err(); assert_eq!(error.reason, "invalid-revision");
    }

    #[test]
    fn rejects_repository_files_outside_subfolder_workspace() {
        let repo = create_repo();
        let inside_oid = commit_file(&repo.0, "docs/inside.md", "# inside\n", "inside");
        let secret_oid = commit_file(&repo.0, "secret.md", "# secret\n", "secret");
        let workspace = repo.0.join("docs");

        let history_error = list_document_history(&workspace, &repo.0.join("secret.md"), 20).unwrap_err();
        assert_eq!(history_error.reason, "outside-workspace");
        let secret_error = read_git_revision(&workspace, &secret_oid, "secret.md").unwrap_err();
        assert_eq!(secret_error.reason, "outside-workspace");
        assert_eq!(read_git_revision(&workspace, &inside_oid, "docs/inside.md").unwrap().source, "# inside\n");
    }

    #[test]
    fn repository_history_includes_merge_parents_refs_and_head() {
        let (_repo, workspace, merge_oid) = create_snapshot_fixture();
        let commits = list_repository_history(&workspace, 50).unwrap();
        let head = commits.iter().find(|commit| commit.is_head).expect("HEAD commit");
        assert_eq!(head.oid, merge_oid);
        assert_eq!(head.parent_oids.len(), 2);
        assert_eq!(head.short_oid, merge_oid.chars().take(7).collect::<String>());
        assert!(commits.iter().any(|commit| commit.refs.iter().any(|reference| reference.contains("snapshot-side"))));
    }

    #[test]
    fn repository_history_pages_with_before_cursor() {
        let repo = create_repo();
        for index in 0..7 { commit_file(&repo.0, &format!("file-{index}.md"), "# page\n", &format!("commit {index}")); }
        let expected = git(&repo.0, &["log", "--format=%H"]).lines().map(str::to_owned).collect::<Vec<_>>();
        let mut oids = Vec::new();
        let mut before: Option<String> = None;
        for _ in 0..10 {
            let page = list_repository_history_page(&repo.0, 3, None, before.as_deref(), false).unwrap();
            oids.extend(page.iter().map(|commit| commit.oid.clone()));
            if page.len() < 3 { break; }
            before = page.last().map(|commit| commit.oid.clone());
        }
        assert_eq!(oids, expected);
    }

    #[test]
    fn repository_history_falls_back_to_offset_for_same_second_runs() {
        let repo = create_repo();
        for index in 0..30 {
            let rel = format!("file-{index}.md");
            fs::write(repo.0.join(&rel), "# page\n").unwrap();
            git(&repo.0, &["add", "--", &rel]);
            let output = Command::new("git").current_dir(&repo.0)
                .args(["commit", "-m", &format!("commit {index}")])
                .env("GIT_COMMITTER_DATE", "2026-01-01T00:00:00Z").env("GIT_AUTHOR_DATE", "2026-01-01T00:00:00Z")
                .output().expect("git should run");
            assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        }
        let expected = git(&repo.0, &["log", "--format=%H"]).lines().map(str::to_owned).collect::<Vec<_>>();
        let mut oids: Vec<String> = Vec::new();
        let mut before: Option<String> = None;
        for _ in 0..20 {
            let page = list_repository_history_page(&repo.0, 3, Some(oids.len()), before.as_deref(), false).unwrap();
            oids.extend(page.iter().map(|commit| commit.oid.clone()));
            if page.len() < 3 { break; }
            before = page.last().map(|commit| commit.oid.clone());
        }
        assert_eq!(oids, expected);
    }

    #[test]
    fn repository_history_head_only_by_default() {
        let repo = create_repo();
        commit_file(&repo.0, "a.md", "# a\n", "base");
        let base_branch = git(&repo.0, &["rev-parse", "--abbrev-ref", "HEAD"]).trim().to_owned();
        git(&repo.0, &["checkout", "-b", "side"]);
        let side_oid = commit_file(&repo.0, "side.md", "# side\n", "side only");
        git(&repo.0, &["checkout", &base_branch]);
        let head_only = list_repository_history_page(&repo.0, 50, None, None, false).unwrap();
        let all = list_repository_history_page(&repo.0, 50, None, None, true).unwrap();
        assert!(!head_only.iter().any(|commit| commit.oid == side_oid));
        assert!(all.iter().any(|commit| commit.oid == side_oid));
    }

    #[test]
    fn repository_snapshot_files_are_workspace_scoped_and_read_only() {
        let (repo, workspace, merge_oid) = create_snapshot_fixture();
        let status_before = git(&repo.0, &["status", "--porcelain"]);
        let source_before = fs::read_to_string(workspace.join("a.md")).unwrap();
        let files = list_revision_files(&workspace, &merge_oid).unwrap();
        assert_eq!(files, vec![
            GitRevisionFile { path: "a.md".into() },
            GitRevisionFile { path: "main.md".into() },
            GitRevisionFile { path: "side.md".into() },
        ]);
        assert_eq!(read_revision_file(&workspace, &merge_oid, "a.md").unwrap(), GitRevisionFileSnapshot {
            oid: merge_oid.clone(), path: "a.md".into(), source: "# root\n".into(),
        });
        assert_eq!(read_revision_file(&workspace, &merge_oid, "../outside.md").unwrap_err().reason, "outside-workspace");
        assert_eq!(read_revision_file(&workspace, "HEAD;rm -rf .", "a.md").unwrap_err().reason, "invalid-revision");
        assert_eq!(git(&repo.0, &["status", "--porcelain"]), status_before);
        assert_eq!(fs::read_to_string(workspace.join("a.md")).unwrap(), source_before);
    }

    #[test]
    fn non_ascii_paths_survive_history_snapshots_and_file_listing() {
        let repo = create_repo();
        commit_file(&repo.0, "docs/naïve æøå notes.md", "# one\n", "first");
        git(&repo.0, &["mv", "--", "docs/naïve æøå notes.md", "docs/ny ø.md"]);
        git(&repo.0, &["commit", "-m", "rename"]);
        let revisions = list_document_history(&repo.0, &repo.0.join("docs").join("ny ø.md"), 20).unwrap();
        assert_eq!(revisions.iter().map(|item| item.path.as_str()).collect::<Vec<_>>(), vec!["docs/ny ø.md", "docs/naïve æøå notes.md"]);
        let head = git(&repo.0, &["rev-parse", "HEAD"]).trim().to_owned();
        let files = list_revision_files(&repo.0, &head).unwrap();
        assert_eq!(files, vec![GitRevisionFile { path: "docs/ny ø.md".into() }]);
        assert_eq!(read_revision_file(&repo.0, &head, "docs/ny ø.md").unwrap().source, "# one\n");
    }

    #[test]
    fn history_parser_keeps_paths_verbatim_and_follows_renames() {
        let output = format!(
            "\x1e{a}\x1fAda\x1f2026-01-02T00:00:00+00:00\x1fsecond\0\nR100\0 old name.md \0 new name.md \0\
             \x1e{b}\x1fAda\x1f2026-01-01T00:00:00+00:00\x1ffirst\0\nA\0 old name.md \0",
            a = "a".repeat(40), b = "b".repeat(40),
        );
        let revisions = parse_history(&output, " new name.md ");
        assert_eq!(revisions.len(), 2);
        assert_eq!(revisions[0].path, " new name.md ");
        assert_eq!(revisions[0].subject, "second");
        assert_eq!(revisions[1].path, " old name.md ");
    }

    #[test]
    fn revision_files_only_list_openable_documents_case_insensitively() {
        let repo = create_repo();
        for rel in ["a.md", "B.MD", "c.mdx", "d.txt", "e.png", "sub/F.Mdx", "sub/g.markdown"] {
            commit_file(&repo.0, rel, "x\n", rel);
        }
        let head = git(&repo.0, &["rev-parse", "HEAD"]).trim().to_owned();
        let mut paths = list_revision_files(&repo.0, &head).unwrap().into_iter().map(|file| file.path).collect::<Vec<_>>();
        paths.sort();
        assert_eq!(paths, vec!["B.MD", "a.md", "c.mdx", "d.txt", "sub/F.Mdx"]);
    }

    #[test]
    fn unknown_before_cursor_yields_an_empty_page_unless_offset_is_explicit() {
        let repo = create_repo();
        commit_file(&repo.0, "a.md", "# a\n", "base");
        let base_branch = git(&repo.0, &["rev-parse", "--abbrev-ref", "HEAD"]).trim().to_owned();
        git(&repo.0, &["checkout", "-b", "side"]);
        let side_oid = commit_file(&repo.0, "side.md", "# side\n", "side only");
        git(&repo.0, &["checkout", &base_branch]);
        for index in 0..4 { commit_file(&repo.0, &format!("m{index}.md"), "# m\n", &format!("main {index}")); }
        // The cursor exists but is not reachable from HEAD, so it cannot be located in the page window.
        assert!(list_repository_history_page(&repo.0, 2, None, Some(&side_oid), false).unwrap().is_empty());
        let explicit = list_repository_history_page(&repo.0, 2, Some(2), Some(&side_oid), false).unwrap();
        let expected = git(&repo.0, &["log", "--format=%H", "--skip=2", "-n", "2"]).lines().map(str::to_owned).collect::<Vec<_>>();
        assert_eq!(explicit.iter().map(|commit| commit.oid.clone()).collect::<Vec<_>>(), expected);
    }

    #[test]
    fn snapshots_with_invalid_utf8_are_decoded_lossily() {
        let repo = create_repo();
        fs::write(repo.0.join("bad.md"), [b'#', b' ', 0xff, 0xfe, b'\n']).unwrap();
        git(&repo.0, &["add", "--", "bad.md"]);
        git(&repo.0, &["commit", "-m", "binary-ish"]);
        let head = git(&repo.0, &["rev-parse", "HEAD"]).trim().to_owned();
        let snapshot = read_git_revision(&repo.0, &head, "bad.md").unwrap();
        assert!(snapshot.source.starts_with("# ") && snapshot.source.contains('\u{fffd}'));
    }

    #[test]
    fn execute_command_builds_ui_payloads() {
        let repo = create_repo();
        let oid = commit_file(&repo.0, "a.md", "# committed\n", "first");
        let no_workspace = execute_command("listRepositoryHistory", None, &serde_json::json!({}));
        assert_eq!(no_workspace["ok"], false);
        assert_eq!(no_workspace["reason"], "not-repository");
        assert_eq!(no_workspace["commits"], serde_json::json!([]));

        let comparison = execute_command("compareGitRevisions", Some(&repo.0), &serde_json::json!({
            "left": { "kind": "revision", "oid": oid, "path": "a.md" },
            "right": { "kind": "current", "path": repo.0.join("a.md").to_string_lossy() },
        }));
        assert_eq!(comparison["ok"], true);
        assert_eq!(comparison["leftSource"], "# committed\n");
        assert!(comparison["rightLabel"].as_str().unwrap().starts_with("Current:"));

        let page = execute_command("listRepositoryHistory", Some(&repo.0), &serde_json::json!({ "limit": 5 }));
        assert_eq!(page["commits"].as_array().unwrap().len(), 1);
    }
}
