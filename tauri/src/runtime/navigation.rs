use regex_lite::Regex;
use std::path::{Path, PathBuf};

pub fn strip_navigation_fragment(path: &str) -> &str {
    match path.find('#') {
        Some(idx) => &path[..idx],
        None => path,
    }
}

pub fn decode_navigation_path(path: &str) -> String {
    match urlencoding_compat::decode(path) {
        Some(decoded) => decoded,
        None => path.to_string(),
    }
}

pub fn is_root_relative_workspace_href(path: &str) -> bool {
    if !path.starts_with('/') || path.starts_with("//") {
        return false;
    }
    let re = Regex::new(r"^[a-zA-Z][a-zA-Z0-9+.-]*:").unwrap();
    !re.is_match(path)
}

pub fn is_same_or_inside_path(parent: &Path, child: &Path) -> bool {
    let parent_abs = parent.canonicalize();
    let child_abs = child.canonicalize();
    match (parent_abs, child_abs) {
        (Ok(p), Ok(c)) => {
            let relative = c.strip_prefix(&p);
            match relative {
                Ok(rel) => rel.as_os_str().is_empty() || !rel.starts_with(".."),
                Err(_) => false,
            }
        }
        _ => {
            let p = parent.to_path_buf();
            let c = child.to_path_buf();
            let relative = c.strip_prefix(&p);
            match relative {
                Ok(rel) => rel.as_os_str().is_empty() || !rel.starts_with(".."),
                Err(_) => {
                    let rel = pathdiff::diff_paths(&c, &p);
                    match rel {
                        Some(r) => r.as_os_str().is_empty() || !r.starts_with(".."),
                        None => false,
                    }
                }
            }
        }
    }
}

pub fn resolve_navigation_path(
    base_dir: &Path,
    current_file: Option<&Path>,
    requested: &str,
) -> PathBuf {
    let requested_path = decode_navigation_path(strip_navigation_fragment(requested));
    if requested_path.is_empty() {
        if let Some(cf) = current_file {
            return cf.to_path_buf();
        }
    }

    let current_dir = current_file
        .and_then(|f| f.parent())
        .unwrap_or(base_dir);

    let requested_pb = Path::new(&requested_path);

    if requested_pb.is_absolute() && is_same_or_inside_path(base_dir, requested_pb) {
        return requested_pb.to_path_buf();
    }

    if is_root_relative_workspace_href(&requested_path) {
        let relative = format!(".{}", requested_path);
        return base_dir.join(&relative);
    }

    if !requested_pb.is_absolute() {
        if let Ok(joined) = current_dir.join(requested_pb).canonicalize() {
            return joined;
        }
        return current_dir.join(requested_pb);
    }

    requested_pb.to_path_buf()
}

mod urlencoding_compat {
    pub fn decode(s: &str) -> Option<String> {
        let mut result = String::new();
        let bytes = s.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                let hex = &s[i + 1..i + 3];
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    result.push(byte as char);
                    i += 3;
                    continue;
                }
            }
            result.push(bytes[i] as char);
            i += 1;
        }
        // Try to interpret as UTF-8
        let result_bytes = result.into_bytes();
        String::from_utf8(result_bytes).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_fragment() {
        assert_eq!(strip_navigation_fragment("path/to/file.md#section"), "path/to/file.md");
        assert_eq!(strip_navigation_fragment("path/to/file.md"), "path/to/file.md");
    }

    #[test]
    fn decode_percent_encoded() {
        assert_eq!(decode_navigation_path("path%20to%20file.md"), "path to file.md");
        assert_eq!(decode_navigation_path("plain.md"), "plain.md");
    }

    #[test]
    fn root_relative_hrefs() {
        assert!(is_root_relative_workspace_href("/docs/readme.md"));
        assert!(!is_root_relative_workspace_href("//share/file.md"));
        assert!(!is_root_relative_workspace_href("https://example.com"));
        assert!(!is_root_relative_workspace_href("relative/path.md"));
    }

    #[test]
    fn same_or_inside_path() {
        let parent = Path::new("/workspace");
        assert!(is_same_or_inside_path(parent, Path::new("/workspace")));
        assert!(is_same_or_inside_path(parent, Path::new("/workspace/docs/file.md")));
        assert!(!is_same_or_inside_path(parent, Path::new("/other/file.md")));
    }

    #[test]
    fn resolve_empty_request_returns_current_file() {
        let base = Path::new("/workspace");
        let current = Path::new("/workspace/docs/readme.md");
        let result = resolve_navigation_path(base, Some(current), "");
        assert_eq!(result, current);
    }

    #[test]
    fn resolve_empty_request_no_current_returns_base() {
        let base = std::env::temp_dir();
        let result = resolve_navigation_path(&base, None, "");
        // Should return the base dir (canonicalized on Windows with \\?\ prefix)
        assert!(result.is_dir() || result == base);
    }

    #[test]
    fn resolve_relative_path_from_current_file() {
        let dir = std::env::temp_dir();
        let sub = dir.join("nav_test");
        std::fs::create_dir_all(&sub).unwrap();
        let file = sub.join("readme.md");
        std::fs::write(&file, "# Test").unwrap();
        let result = resolve_navigation_path(&sub, Some(&file), "readme.md");
        // canonicalize both for comparison (Windows adds \\?\ prefix)
        let result_canon = result.canonicalize().unwrap_or(result.clone());
        let file_canon = file.canonicalize().unwrap_or(file.clone());
        assert_eq!(result_canon, file_canon);
    }

    #[test]
    fn strip_fragment_no_fragment() {
        assert_eq!(strip_navigation_fragment("path.md"), "path.md");
    }

    #[test]
    fn strip_fragment_multiple_fragments() {
        assert_eq!(strip_navigation_fragment("path.md#a#b"), "path.md");
    }

    #[test]
    fn decode_invalid_percent_keeps_original() {
        let result = decode_navigation_path("file%zz.md");
        assert!(result.contains("file"));
    }

    #[test]
    fn root_relative_rejects_scheme() {
        assert!(!is_root_relative_workspace_href("http://example.com"));
        assert!(!is_root_relative_workspace_href("mailto:test@test.com"));
    }

    #[test]
    fn root_relative_accepts_slash_path() {
        assert!(is_root_relative_workspace_href("/docs/file.md"));
        assert!(is_root_relative_workspace_href("/a"));
    }

    #[test]
    fn urlencoding_compat_decode_ascii() {
        assert_eq!(
            urlencoding_compat::decode("hello%20world"),
            Some("hello world".to_string())
        );
    }

    #[test]
    fn urlencoding_compat_decode_no_encoding() {
        assert_eq!(
            urlencoding_compat::decode("plain"),
            Some("plain".to_string())
        );
    }

    #[test]
    fn urlencoding_compat_decode_high_byte() {
        // %ff becomes U+00FF (ÿ) since the decode function casts byte to char
        let result = urlencoding_compat::decode("test%ff");
        assert_eq!(result.as_deref(), Some("test\u{00ff}"));
    }
}
