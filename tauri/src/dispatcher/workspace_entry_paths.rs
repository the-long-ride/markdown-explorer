use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

// Copy of ui/src/workspace/workspaceEntryName.ts; tested against tests/fixtures/workspace-entry-names.json.
const FORBIDDEN: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
const RESERVED: &[&str] = &[
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

pub(crate) fn is_protected_segment(segment: &str) -> bool {
    segment
        .trim_end_matches(['.', ' '])
        .eq_ignore_ascii_case(".git")
}

/// True when any segment of an (already split or resolved relative) path is protected.
pub(crate) fn has_protected_segment(segments: &[String]) -> bool {
    segments.iter().any(|segment| is_protected_segment(segment))
}

/// On Windows a ':' inside a path segment addresses an NTFS alternate data stream (e.g. `.git::$INDEX_ALLOCATION`).
pub(crate) fn has_stream_segment(segments: &[String], windows: bool) -> bool {
    windows && segments.iter().any(|segment| segment.contains(':'))
}

/// Segments of a resolved path below the resolved workspace base; `None` when it is not below the base.
pub(crate) fn relative_segments(base: &Path, target: &Path) -> Option<Vec<String>> {
    let relative = target.strip_prefix(base).ok()?;
    Some(
        relative
            .components()
            .filter_map(|component| match component {
                Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
                _ => None,
            })
            .collect(),
    )
}

pub(crate) fn name_error(name: &str) -> Option<&'static str> {
    if name.trim().is_empty() {
        return Some("empty");
    }
    if is_protected_segment(name) {
        return Some("protected");
    }
    if name == "." || name == ".." {
        return Some("invalid");
    }
    if name
        .chars()
        .any(|c| FORBIDDEN.contains(&c) || (c as u32) < 0x20)
        || name.ends_with('.')
        || name.ends_with(' ')
    {
        return Some("invalid");
    }
    let stem = name.split('.').next().unwrap_or("").to_ascii_lowercase();
    if RESERVED.contains(&stem.as_str()) {
        return Some("reserved");
    }
    None
}

pub(crate) fn split_relative(value: &str) -> Option<Vec<String>> {
    if value.is_empty() {
        return Some(Vec::new());
    }
    let parts: Vec<String> = value.split('/').map(str::to_string).collect();
    if parts
        .iter()
        .any(|p| p.is_empty() || p == "." || p == ".." || p.contains('\\'))
    {
        return None;
    }
    Some(parts)
}

/// `parentPath` of a create request: absent or null is the workspace root, a string is itself,
/// anything else is `None` (outside-workspace, like the Electron host).
pub(crate) fn parent_path_arg(msg: &Value) -> Option<String> {
    match msg.get("parentPath") {
        None | Some(Value::Null) => Some(String::new()),
        Some(Value::String(path)) => Some(path.clone()),
        Some(_) => None,
    }
}

/// `paths` of a delete request: a non-array is empty, a non-string element is `None` (outside-workspace).
pub(crate) fn delete_paths_arg(msg: &Value) -> Vec<Option<String>> {
    msg.get("paths")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|item| item.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn error_reason(err: &std::io::Error) -> &'static str {
    match err.kind() {
        ErrorKind::AlreadyExists => "exists",
        ErrorKind::PermissionDenied => "permission-denied",
        ErrorKind::NotFound | ErrorKind::NotADirectory => "missing",
        _ => "failed",
    }
}

pub(crate) fn resolve_base(workspace: Option<&Path>) -> Result<PathBuf, &'static str> {
    let workspace = workspace.ok_or("unsupported")?;
    let meta = fs::metadata(workspace).map_err(|e| error_reason(&e))?;
    if !meta.is_dir() {
        return Err("unsupported");
    }
    fs::canonicalize(workspace).map_err(|e| error_reason(&e))
}

pub(crate) fn join_parts(base: &Path, parts: &[String]) -> PathBuf {
    parts
        .iter()
        .fold(base.to_path_buf(), |acc, part| acc.join(part))
}

pub(crate) fn copy_file_exclusive(source: &Path, target: &Path) -> std::io::Result<()> {
    let mut input = fs::File::open(source)?;
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)?;
    let result = std::io::copy(&mut input, &mut output).and_then(|_| output.sync_all());
    drop(output);
    if result.is_err() {
        let _ = fs::remove_file(target);
    }
    result
}
