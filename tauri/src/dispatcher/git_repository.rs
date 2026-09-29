use super::{
    assert_workspace_path, error, path_to_git, resolve_context, run_git, validate_oid,
    DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT, GitHistoryError,
};
use serde::Serialize;
use std::path::{Component, Path};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositoryCommit {
    pub oid: String,
    pub short_oid: String,
    pub parent_oids: Vec<String>,
    pub author: String,
    pub authored_at: String,
    pub subject: String,
    pub refs: Vec<String>,
    pub is_head: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFile {
    pub path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFileSnapshot {
    pub oid: String,
    pub path: String,
    pub source: String,
}

fn workspace_repository_prefix(repository_root: &Path, workspace_root: &Path) -> Result<String, GitHistoryError> {
    let relative = workspace_root.strip_prefix(repository_root)
        .map_err(|_| error("outside-workspace", "Workspace is outside repository"))?;
    Ok(path_to_git(relative))
}

fn validate_workspace_relative_path(
    repository_root: &Path,
    workspace_root: &Path,
    value: &str,
) -> Result<(String, String), GitHistoryError> {
    if value.is_empty() { return Err(error("outside-workspace", "Revision path is outside workspace")); }
    let path = Path::new(value);
    if path.is_absolute() { return Err(error("outside-workspace", "Revision path is outside workspace")); }
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(error("outside-workspace", "Revision path is outside workspace"));
            }
        }
    }
    if parts.is_empty() { return Err(error("outside-workspace", "Revision path is outside workspace")); }
    let absolute = parts.iter().fold(workspace_root.to_path_buf(), |current, part| current.join(part));
    assert_workspace_path(workspace_root, &absolute)?;
    if !absolute.starts_with(repository_root) {
        return Err(error("outside-repository", "Revision path is outside repository"));
    }
    let repository_relative = absolute.strip_prefix(repository_root)
        .map_err(|_| error("outside-repository", "Revision path is outside repository"))?;
    Ok((parts.join("/"), path_to_git(repository_relative)))
}

fn parse_repository_history(output: &str, head_oid: &str) -> Vec<GitRepositoryCommit> {
    let mut commits = Vec::new();
    for record in output.split('\x1e').skip(1) {
        let header = record.trim_start_matches(['\r', '\n']).lines().next().unwrap_or_default();
        let fields = header.split('\x1f').collect::<Vec<_>>();
        let oid = fields.first().copied().unwrap_or_default();
        if validate_oid(oid).is_err() { continue; }
        commits.push(GitRepositoryCommit {
            oid: oid.to_owned(),
            short_oid: oid.chars().take(7).collect(),
            parent_oids: fields.get(1).copied().unwrap_or_default().split_whitespace()
                .filter(|parent| validate_oid(parent).is_ok()).map(ToOwned::to_owned).collect(),
            author: fields.get(2).copied().unwrap_or_default().to_owned(),
            authored_at: fields.get(3).copied().unwrap_or_default().to_owned(),
            subject: fields.get(4).copied().unwrap_or_default().to_owned(),
            refs: fields.get(5).copied().unwrap_or_default().split(',').map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned).collect(),
            is_head: oid.eq_ignore_ascii_case(head_oid),
        });
    }
    commits
}

pub fn list_repository_history(workspace_path: &Path, limit: usize) -> Result<Vec<GitRepositoryCommit>, GitHistoryError> {
    list_repository_history_page(workspace_path, limit, None, None, false)
}

const REPOSITORY_PAGE_OVERLAP: usize = 20;

/// Pages the repository history. `before` is the cursor (the last commit already shown) and `offset`
/// an optional explicit skip count. When the cursor cannot be located and no explicit `offset` was
/// given, the page is empty: falling back to offset 0 would silently repeat page one.
pub fn list_repository_history_page(
    workspace_path: &Path,
    limit: usize,
    offset: Option<usize>,
    before: Option<&str>,
    all_refs: bool,
) -> Result<Vec<GitRepositoryCommit>, GitHistoryError> {
    let (repository_root, _) = resolve_context(workspace_path)?;
    let head_oid = run_git(&repository_root, &["rev-parse".into(), "HEAD".into()])?;
    let limit = if limit == 0 { DEFAULT_HISTORY_LIMIT } else { limit.min(MAX_HISTORY_LIMIT) };
    let refs: String = if all_refs { "--all".into() } else { "HEAD".into() };
    let format: String = "--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D".into();
    let cursor = before.map(validate_oid).transpose()?;
    let Some(cursor) = cursor else {
        let output = run_git(&repository_root, &[
            "log".into(), refs, format, format!("--skip={}", offset.unwrap_or(0)), "-n".into(), limit.to_string(),
        ])?;
        return Ok(parse_repository_history(&output, head_oid.trim()));
    };
    let committed_at = run_git(&repository_root, &["show".into(), "-s".into(), "--format=%ct".into(), cursor.clone()])?;
    let output = run_git(&repository_root, &[
        "log".into(), refs, format, format!("--until={}", committed_at.trim()),
        "-n".into(), (limit + REPOSITORY_PAGE_OVERLAP).to_string(),
    ])?;
    let commits = parse_repository_history(&output, head_oid.trim());
    let window_full = commits.len() == limit + REPOSITORY_PAGE_OVERLAP;
    if let Some(index) = commits.iter().position(|commit| commit.oid == cursor) {
        let page: Vec<_> = commits.into_iter().skip(index + 1).take(limit).collect();
        if page.len() == limit || !window_full { return Ok(page); }
    }
    // Too many same-second commits precede the cursor for the overlap window: page by the explicit
    // offset. Without one the cursor is unknown (or unreachable from these refs): nothing more to show.
    match offset {
        Some(offset) => list_repository_history_page(workspace_path, limit, Some(offset), None, all_refs),
        None => Ok(Vec::new()),
    }
}

/// Extensions the UI can open from a repository snapshot (mirrors `isRevisionDocumentPath`).
const REVISION_DOCUMENT_EXTENSIONS: &[&str] = &[
    "md", "mdx", "txt", "doc", "docx", "pdf", "html", "htm", "xls", "xlsx", "xlm", "pptx", "odt", "odp", "ods", "rtf",
];

fn is_revision_document_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| REVISION_DOCUMENT_EXTENSIONS.iter().any(|allowed| extension.eq_ignore_ascii_case(allowed)))
}

pub fn list_revision_files(workspace_path: &Path, oid: &str) -> Result<Vec<GitRevisionFile>, GitHistoryError> {
    let oid = validate_oid(oid)?;
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let prefix = workspace_repository_prefix(&repository_root, &workspace_root)?;
    // -z: NUL-separated, unquoted, untrimmed paths (names may contain spaces or non-ASCII characters).
    let mut args = vec!["ls-tree".into(), "-r".into(), "-z".into(), "--name-only".into(), oid];
    if !prefix.is_empty() {
        args.push("--".into());
        args.push(prefix.clone());
    }
    let output = run_git(&repository_root, &args)?;
    let prefix_with_slash = if prefix.is_empty() { String::new() } else { format!("{prefix}/") };
    Ok(output.split('\0').filter_map(|repository_path| {
        if repository_path.is_empty() { return None; }
        let relative = if prefix_with_slash.is_empty() {
            repository_path
        } else {
            repository_path.strip_prefix(&prefix_with_slash)?
        };
        if relative.is_empty() || !is_revision_document_path(relative) { None } else { Some(GitRevisionFile { path: relative.to_owned() }) }
    }).collect())
}

pub fn read_revision_file(workspace_path: &Path, oid: &str, revision_path: &str) -> Result<GitRevisionFileSnapshot, GitHistoryError> {
    let oid = validate_oid(oid)?;
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let (workspace_relative, repository_relative) = validate_workspace_relative_path(&repository_root, &workspace_root, revision_path)?;
    let source = run_git(&repository_root, &["show".into(), format!("{oid}:{repository_relative}")])?;
    Ok(GitRevisionFileSnapshot { oid, path: workspace_relative, source })
}
