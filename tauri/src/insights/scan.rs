use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub const DEFAULT_SOFT_LIMIT_BYTES: u64 = 10 * 1024 * 1024;
pub const DEFAULT_HARD_LIMIT_BYTES: u64 = 64 * 1024 * 1024;
pub const SCAN_BATCH_SIZE: usize = 200;

const HARD_EXCLUDED: &[&str] = &[".git", ".hg", ".svn"];
const DEFAULT_EXCLUDED: &[&str] = &["node_modules", ".next", "dist", "build", "coverage", ".cache"];

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InsightsWorkspaceEntry {
    pub relative_path: String,
    pub canonical_relative_path: String,
    pub kind: &'static str,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub is_symlink: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScanResult {
    pub entries: Vec<InsightsWorkspaceEntry>,
    pub excluded_entries: usize,
    pub skipped_entries: usize,
    pub cancelled: bool,
}

fn normalized_relative(root: &Path, target: &Path) -> Option<String> {
    pathdiff::diff_paths(target, root).map(|path| path.to_string_lossy().replace('\\', "/"))
}

pub fn same_or_inside(root: &Path, target: &Path) -> bool {
    normalized_relative(root, target)
        .map(|relative| {
            relative.is_empty()
                || (relative != ".."
                    && !relative.starts_with("../")
                    && !Path::new(&relative).is_absolute())
        })
        .unwrap_or(false)
}

fn has_excluded_segment(relative: &str, segments: &[&str]) -> bool {
    relative
        .split('/')
        .any(|segment| segments.iter().any(|candidate| segment == *candidate))
}

fn matches_simple_pattern(relative: &str, pattern: &str) -> bool {
    let pattern = pattern.trim().trim_start_matches('/').trim_end_matches('/');
    if pattern.is_empty() {
        return false;
    }
    if !pattern.contains('*') && !pattern.contains('?') {
        return relative == pattern
            || relative.starts_with(&format!("{pattern}/"))
            || (!pattern.contains('/') && relative.split('/').any(|part| part == pattern));
    }
    let mut regex = String::from("(?i)^");
    for ch in pattern.chars() {
        match ch {
            '*' => regex.push_str(".*"),
            '?' => regex.push('.'),
            '.' => regex.push_str("\\."),
            '/' => regex.push('/'),
            other if "()[]{}+^$|\\".contains(other) => {
                regex.push('\\');
                regex.push(other);
            }
            other => regex.push(other),
        }
    }
    regex.push('$');
    regex_lite::Regex::new(&regex)
        .map(|compiled| compiled.is_match(relative))
        .unwrap_or(false)
}

fn should_exclude(relative: &str, gitignore: &[String], user_patterns: &[String]) -> bool {
    if has_excluded_segment(relative, HARD_EXCLUDED) {
        return true;
    }
    let mut excluded = has_excluded_segment(relative, DEFAULT_EXCLUDED);
    for raw in gitignore.iter().chain(user_patterns.iter()) {
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let (negated, pattern) = trimmed
            .strip_prefix('!')
            .map(|value| (true, value))
            .unwrap_or((false, trimmed));
        if matches_simple_pattern(relative, pattern) {
            excluded = !negated;
        }
    }
    excluded
}

fn read_gitignore(root: &Path) -> Vec<String> {
    fs::read_to_string(root.join(".gitignore"))
        .map(|source| {
            source
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty() && !line.starts_with('#'))
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn modified_ms(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

pub fn scan_workspace<F>(root: &Path, user_patterns: &[String], cancelled: F) -> ScanResult
where
    F: Fn() -> bool,
{
    let Ok(root_real) = fs::canonicalize(root) else {
        return ScanResult { entries: vec![], excluded_entries: 0, skipped_entries: 1, cancelled: false };
    };
    let gitignore = read_gitignore(&root_real);
    let mut entries = Vec::new();
    let mut excluded_entries = 0usize;
    let mut skipped_entries = 0usize;
    let mut seen_files = HashSet::<PathBuf>::new();
    let mut seen_dirs = HashSet::<PathBuf>::new();
    seen_dirs.insert(root_real.clone());

    let mut it = WalkDir::new(&root_real).follow_links(true).into_iter();
    while let Some(item) = it.next() {
        if cancelled() {
            return ScanResult { entries, excluded_entries, skipped_entries, cancelled: true };
        }
        let entry = match item {
            Ok(entry) => entry,
            Err(_) => { skipped_entries += 1; continue; }
        };
        if entry.path() == root_real {
            continue;
        }
        let display_relative = normalized_relative(&root_real, entry.path()).unwrap_or_default();
        if should_exclude(&display_relative, &gitignore, user_patterns) {
            excluded_entries += 1;
            if entry.file_type().is_dir() {
                it.skip_current_dir();
            }
            continue;
        }
        let Ok(real) = fs::canonicalize(entry.path()) else {
            skipped_entries += 1;
            continue;
        };
        if !same_or_inside(&root_real, &real) {
            excluded_entries += 1;
            if entry.file_type().is_dir() {
                it.skip_current_dir();
            }
            continue;
        }
        let Ok(metadata) = fs::metadata(&real) else {
            skipped_entries += 1;
            continue;
        };
        if metadata.is_dir() {
            if !seen_dirs.insert(real) {
                it.skip_current_dir();
                continue;
            }
            continue;
        }
        if !metadata.is_file() || !seen_files.insert(real.clone()) {
            continue;
        }
        let canonical_relative = normalized_relative(&root_real, &real).unwrap_or_else(|| display_relative.clone());
        entries.push(InsightsWorkspaceEntry {
            relative_path: display_relative,
            canonical_relative_path: canonical_relative,
            kind: "file",
            size_bytes: metadata.len(),
            mtime_ms: modified_ms(&metadata),
            extension: real
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| format!(".{}", value.to_lowercase())),
            is_symlink: entry.path_is_symlink(),
        });
    }

    ScanResult { entries, excluded_entries, skipped_entries, cancelled: false }
}

fn resolve_relative(root: &Path, relative_path: &str) -> Option<PathBuf> {
    if relative_path.is_empty() {
        return None;
    }
    let candidate = root.join(relative_path);
    let root_real = fs::canonicalize(root).ok()?;
    let real = fs::canonicalize(candidate).ok()?;
    same_or_inside(&root_real, &real).then_some(real)
}

pub fn read_document_source(root: &Path, relative_path: &str, soft_limit: u64, hard_limit: u64) -> Value {
    if !relative_path.to_lowercase().ends_with(".md") && !relative_path.to_lowercase().ends_with(".mdx") {
        return json!({"status": "unsupported"});
    }
    let Some(real) = resolve_relative(root, relative_path) else {
        return json!({"status": "missing"});
    };
    let Ok(metadata) = fs::metadata(&real) else {
        return json!({"status": "unreadable"});
    };
    if !metadata.is_file() {
        return json!({"status": "missing"});
    }
    let hard_limit = hard_limit.clamp(1, DEFAULT_HARD_LIMIT_BYTES);
    let soft_limit = soft_limit.max(1);
    if metadata.len() > hard_limit {
        return json!({"status": "too-large", "sizeBytes": metadata.len(), "mtimeMs": modified_ms(&metadata), "hardLimit": true});
    }
    if metadata.len() > soft_limit {
        return json!({"status": "too-large", "sizeBytes": metadata.len(), "mtimeMs": modified_ms(&metadata), "hardLimit": false});
    }
    match fs::read_to_string(&real) {
        Ok(source) => json!({
            "status": "ok",
            "source": source,
            "sizeBytes": metadata.len(),
            "mtimeMs": modified_ms(&metadata)
        }),
        Err(_) => json!({"status": "unreadable"}),
    }
}

fn mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase().as_str() {
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp",
        "svg" => "image/svg+xml", "avif" => "image/avif", "mp4" => "video/mp4", "webm" => "video/webm",
        "mp3" => "audio/mpeg", "wav" => "audio/wav", "ogg" => "audio/ogg", "m4a" => "audio/mp4",
        "md" => "text/markdown", "mdx" => "text/mdx", "pdf" => "application/pdf", _ => "application/octet-stream",
    }
}

pub fn probe_resource(root: &Path, document_path: &str, resource_path: &str) -> Value {
    let raw = resource_path.split(['?', '#']).next().unwrap_or("");
    if raw.is_empty() || raw.starts_with("http:") || raw.starts_with("https:") || raw.starts_with("data:") || raw.starts_with("blob:") || raw.starts_with("file:") {
        return json!({"status": "outside-workspace"});
    }
    let Ok(root_real) = fs::canonicalize(root) else {
        return json!({"status": "missing"});
    };
    let doc = Path::new(document_path);
    let doc_absolute = if doc.is_absolute() { doc.to_path_buf() } else { root_real.join(doc) };
    let candidate = if raw.starts_with('/') {
        root_real.join(raw.trim_start_matches('/'))
    } else {
        doc_absolute.parent().unwrap_or(&root_real).join(raw)
    };
    let Ok(real) = fs::canonicalize(candidate) else {
        return json!({"status": "missing"});
    };
    if !same_or_inside(&root_real, &real) {
        return json!({"status": "outside-workspace"});
    }
    let Ok(metadata) = fs::metadata(&real) else {
        return json!({"status": "unreadable"});
    };
    json!({
        "status": "exists",
        "relativePath": normalized_relative(&root_real, &real),
        "kind": if metadata.is_dir() { "directory" } else { "file" },
        "sizeBytes": if metadata.is_file() { Some(metadata.len()) } else { None },
        "mimeType": if metadata.is_file() { Some(mime_type(&real)) } else { None }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn scans_more_than_sidebar_cap() {
        let dir = tempfile::tempdir().unwrap();
        for index in 0..1005 {
            fs::write(dir.path().join(format!("{index}.md")), format!("# {index}")).unwrap();
        }
        let result = scan_workspace(dir.path(), &[], || false);
        assert_eq!(result.entries.len(), 1005);
        assert!(!result.cancelled);
    }

    #[test]
    fn source_limits_are_checked_before_read() {
        let dir = tempfile::tempdir().unwrap();
        let mut file = fs::File::create(dir.path().join("large.md")).unwrap();
        file.write_all(&vec![b'x'; 2048]).unwrap();
        let value = read_document_source(dir.path(), "large.md", 1024, DEFAULT_HARD_LIMIT_BYTES);
        assert_eq!(value["status"], "too-large");
        assert_eq!(value["hardLimit"], false);
    }

    #[test]
    fn probe_returns_metadata() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("docs")).unwrap();
        fs::create_dir_all(dir.path().join("img")).unwrap();
        fs::write(dir.path().join("docs/a.md"), "# A").unwrap();
        fs::write(dir.path().join("img/a.png"), "PNG").unwrap();
        let value = probe_resource(dir.path(), "docs/a.md", "../img/a.png");
        assert_eq!(value["status"], "exists");
        assert_eq!(value["sizeBytes"], 3);
    }
}
