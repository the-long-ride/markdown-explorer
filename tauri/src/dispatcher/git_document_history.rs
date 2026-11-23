use super::{
    error, repository_relative_path, resolve_context, run_git, validate_git_path, validate_oid,
    GitCompareSide, GitComparisonSources, GitHistoryError, GitRevisionSnapshot, GitRevisionSummary,
    DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT,
};
use std::fs;
use std::path::Path;

pub(super) fn parse_history(output: &str, initial_path: &str) -> Vec<GitRevisionSummary> {
    let mut tracked_path = initial_path.to_owned();
    let mut revisions = Vec::new();
    for record in output.split('\x1e').skip(1) {
        let (header, changes) = record.split_once('\0').unwrap_or((record, ""));
        let mut fields = header.trim_start_matches(['\r', '\n']).split('\x1f');
        let oid = fields.next().unwrap_or_default();
        if validate_oid(oid).is_err() {
            continue;
        }
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
            if status.is_empty() {
                continue;
            }
            if status.starts_with('R') || status.starts_with('C') {
                let old_path = tokens.next().unwrap_or_default();
                let new_path = tokens.next().unwrap_or_default();
                if status.starts_with('R')
                    && status[1..].bytes().all(|byte| byte.is_ascii_digit())
                    && new_path == tracked_path
                {
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

pub fn list_document_history(
    workspace_path: &Path,
    file_path: &Path,
    limit: usize,
) -> Result<Vec<GitRevisionSummary>, GitHistoryError> {
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let git_path = repository_relative_path(&repository_root, &workspace_root, file_path)?;
    let limit = if limit == 0 {
        DEFAULT_HISTORY_LIMIT
    } else {
        limit.min(MAX_HISTORY_LIMIT)
    };
    let output = run_git(
        &repository_root,
        &[
            "log".into(),
            "--follow".into(),
            "--format=%x1e%H%x1f%an%x1f%aI%x1f%s".into(),
            "--name-status".into(),
            "-M".into(),
            "-z".into(),
            "-n".into(),
            limit.to_string(),
            "--".into(),
            git_path.clone(),
        ],
    )?;
    Ok(parse_history(&output, &git_path))
}

pub fn read_git_revision(
    workspace_path: &Path,
    oid: &str,
    revision_path: &str,
) -> Result<GitRevisionSnapshot, GitHistoryError> {
    let oid = validate_oid(oid)?;
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let git_path = validate_git_path(&repository_root, &workspace_root, revision_path)?;
    let source = run_git(
        &repository_root,
        &["show".into(), format!("{oid}:{git_path}")],
    )?;
    Ok(GitRevisionSnapshot {
        oid,
        path: git_path,
        source,
    })
}

fn read_compare_side(
    repository_root: &Path,
    workspace_root: &Path,
    side: &GitCompareSide,
) -> Result<(String, String), GitHistoryError> {
    match side {
        GitCompareSide::Revision { oid, path } => {
            let oid = validate_oid(oid)?;
            let git_path = validate_git_path(repository_root, workspace_root, path)?;
            let source = run_git(
                repository_root,
                &["show".into(), format!("{oid}:{git_path}")],
            )?;
            Ok((source, format!("{}:{git_path}", &oid[..7])))
        }
        GitCompareSide::Current { path } => {
            let git_path =
                repository_relative_path(repository_root, workspace_root, Path::new(path))?;
            let source = fs::read_to_string(repository_root.join(&git_path))
                .map_err(|err| error("unreadable", err.to_string()))?;
            Ok((source, format!("Current:{git_path}")))
        }
    }
}

pub fn compare_git_sources(
    workspace_path: &Path,
    left: &GitCompareSide,
    right: &GitCompareSide,
) -> Result<GitComparisonSources, GitHistoryError> {
    let (repository_root, workspace_root) = resolve_context(workspace_path)?;
    let (left_source, left_label) = read_compare_side(&repository_root, &workspace_root, left)?;
    let (right_source, right_label) = read_compare_side(&repository_root, &workspace_root, right)?;
    Ok(GitComparisonSources {
        left_source,
        right_source,
        left_label,
        right_label,
    })
}
