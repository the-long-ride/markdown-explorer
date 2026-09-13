use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

pub const MAX_GIT_OUTPUT_BYTES: usize = 16 * 1024 * 1024;
const DEFAULT_HISTORY_LIMIT: usize = 100;
const MAX_HISTORY_LIMIT: usize = 500;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCapability {
    pub supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

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

fn error(reason: &'static str, message: impl Into<String>) -> GitHistoryError {
    GitHistoryError { reason, message: message.into() }
}

fn run_git(cwd: &Path, args: &[String]) -> Result<String, GitHistoryError> {
    let output = Command::new("git").current_dir(cwd).args(args).output().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            error("git-unavailable", "Git executable is unavailable")
        } else {
            error("git-command-failed", err.to_string())
        }
    })?;
    if output.stdout.len() > MAX_GIT_OUTPUT_BYTES {
        return Err(error("output-too-large", "Git output exceeded the allowed size"));
    }
    if !output.status.success() {
        return Err(error("git-command-failed", String::from_utf8_lossy(&output.stderr).trim().to_owned()));
    }
    String::from_utf8(output.stdout).map_err(|err| error("git-command-failed", err.to_string()))
}

fn workspace_directory(workspace_path: &Path) -> PathBuf {
    match fs::metadata(workspace_path) {
        Ok(metadata) if metadata.is_file() => workspace_path.parent().unwrap_or(workspace_path).to_path_buf(),
        _ => workspace_path.to_path_buf(),
    }
}

fn resolve_context(workspace_path: &Path) -> Result<(PathBuf, PathBuf), GitHistoryError> {
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

fn resolve_repository(workspace_path: &Path) -> Result<PathBuf, GitHistoryError> {
    resolve_context(workspace_path).map(|(root, _)| root)
}

pub fn detect_git_capability(workspace_path: Option<&Path>) -> GitCapability {
    let Some(workspace_path) = workspace_path else {
        return GitCapability { supported: false, repository_root: None, reason: Some("not-repository".into()) };
    };
    match resolve_repository(workspace_path) {
        Ok(root) => GitCapability {
            supported: true,
            repository_root: Some(root.to_string_lossy().into_owned()),
            reason: None,
        },
        Err(err) => GitCapability {
            supported: false,
            repository_root: None,
            reason: Some(if err.reason == "git-unavailable" { "git-unavailable" } else { "not-repository" }.into()),
        },
    }
}

fn validate_oid(oid: &str) -> Result<String, GitHistoryError> {
    if !matches!(oid.len(), 40 | 64) || !oid.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(error("invalid-revision", "Invalid revision identifier"));
    }
    Ok(oid.to_ascii_lowercase())
}

fn assert_workspace_path(workspace_root: &Path, absolute: &Path) -> Result<(), GitHistoryError> {
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

fn parse_history(output: &str, initial_path: &str) -> Vec<GitRevisionSummary> {
    let mut tracked_path = initial_path.to_owned();
    let mut revisions = Vec::new();
    for record in output.split('\x1e').skip(1) {
        let mut lines = record.trim_start_matches(['\r', '\n']).lines();
        let mut fields = lines.next().unwrap_or_default().split('\x1f');
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
        for line in lines {
            let parts = line.split('\t').collect::<Vec<_>>();
            if parts.len() >= 3 && parts[0].starts_with('R') && parts[0][1..].bytes().all(|byte| byte.is_ascii_digit()) && parts[2] == tracked_path {
                tracked_path = parts[1].to_owned();
                break;
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
        "--name-status".into(), "-M".into(), "-n".into(), limit.to_string(), "--".into(), git_path.clone(),
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

#[cfg(not(test))]
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
pub(super) fn handle_command(app: &tauri::AppHandle, state: &crate::app_state::AppState, cmd: &str, msg: &serde_json::Value) -> Result<bool, String> {
    if !matches!(cmd, "getGitCapability" | "listDocumentHistory" | "readGitRevision" | "compareGitRevisions") { return Ok(false); }
    let request_id = msg.get("requestId").and_then(serde_json::Value::as_str).unwrap_or_default();
    let workspace_path = state.inner.read().workspace_path.clone();
    let mut extra = serde_json::Map::new();
    extra.insert("requestId".into(), request_id.into());
    match cmd {
        "getGitCapability" => {
            extra.insert("capability".into(), serde_json::to_value(detect_git_capability(workspace_path.as_deref())).unwrap_or_default());
            crate::host_message::emit(app, "gitCapabilityResult", extra);
        }
        "listDocumentHistory" => {
            let result = workspace_path.as_deref().ok_or_else(|| error("not-repository", "No workspace"))
                .and_then(|root| list_document_history(root, Path::new(msg.get("filePath").and_then(serde_json::Value::as_str).unwrap_or_default()), msg.get("limit").and_then(serde_json::Value::as_u64).unwrap_or(DEFAULT_HISTORY_LIMIT as u64) as usize));
            extra.insert("ok".into(), result.is_ok().into());
            match result { Ok(items) => { extra.insert("revisions".into(), serde_json::to_value(items).unwrap_or_default()); }, Err(err) => { extra.insert("revisions".into(), serde_json::json!([])); extra.insert("reason".into(), err.reason.into()); } }
            crate::host_message::emit(app, "documentHistoryResult", extra);
        }
        "readGitRevision" => {
            let result = workspace_path.as_deref().ok_or_else(|| error("not-repository", "No workspace")).and_then(|root| read_git_revision(root, msg.get("oid").and_then(serde_json::Value::as_str).unwrap_or_default(), msg.get("path").and_then(serde_json::Value::as_str).unwrap_or_default()));
            extra.insert("ok".into(), result.is_ok().into());
            match result { Ok(snapshot) => { extra.insert("snapshot".into(), serde_json::to_value(snapshot).unwrap_or_default()); }, Err(err) => { extra.insert("reason".into(), err.reason.into()); } }
            crate::host_message::emit(app, "gitRevisionResult", extra);
        }
        _ => {
            let result = (|| {
                let root = workspace_path.as_deref().ok_or_else(|| error("not-repository", "No workspace"))?;
                let left = compare_side_from_value(msg.get("left").unwrap_or(&serde_json::Value::Null))?;
                let right = compare_side_from_value(msg.get("right").unwrap_or(&serde_json::Value::Null))?;
                compare_git_sources(root, &left, &right)
            })();
            extra.insert("ok".into(), result.is_ok().into());
            match result {
                Ok(result) => { extra.insert("leftSource".into(), result.left_source.into()); extra.insert("rightSource".into(), result.right_source.into()); extra.insert("leftLabel".into(), result.left_label.into()); extra.insert("rightLabel".into(), result.right_label.into()); }
                Err(err) => { extra.insert("reason".into(), err.reason.into()); }
            }
            crate::host_message::emit(app, "gitComparisonResult", extra);
        }
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
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

    #[test]
    fn detects_repository_and_lists_rename_aware_history() {
        let repo = create_repo(); commit_file(&repo.0, "old.md", "# one\n", "first"); git(&repo.0, &["mv", "--", "old.md", "new.md"]); git(&repo.0, &["commit", "-m", "rename"]);
        assert!(detect_git_capability(Some(&repo.0)).supported);
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
}
