use super::{same_or_inside, InsightsWorkspaceEntry};
use std::path::Path;

pub(in crate::insights) fn entry_for_path(
    root: &Path,
    path: &Path,
) -> Option<InsightsWorkspaceEntry> {
    let root_real = std::fs::canonicalize(root).ok()?;
    let real = std::fs::canonicalize(path).ok()?;
    if !same_or_inside(&root_real, &real) {
        return None;
    }
    let metadata = std::fs::metadata(&real).ok()?;
    if !metadata.is_file() {
        return None;
    }
    let relative_path = pathdiff::diff_paths(path, &root_real)?
        .to_string_lossy()
        .replace('\\', "/");
    let canonical_relative_path = pathdiff::diff_paths(&real, &root_real)?
        .to_string_lossy()
        .replace('\\', "/");
    let mtime_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0);
    Some(InsightsWorkspaceEntry {
        relative_path,
        canonical_relative_path,
        kind: "file",
        size_bytes: metadata.len(),
        mtime_ms,
        extension: real
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{}", value.to_lowercase())),
        is_symlink: std::fs::symlink_metadata(path)
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(false),
    })
}
