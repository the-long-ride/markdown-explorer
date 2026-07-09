fn content_type_for(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "ogg" => "video/ogg",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "css" => "text/css",
        "js" | "mjs" => "application/javascript",
        "json" => "application/json",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

/// Strip `?query` and `#fragment` so cache-busting suffixes don't become part
/// of the filename (which would 404 the request).
fn strip_query_fragment(s: &str) -> &str {
    let mut end = s.len();
    for (i, ch) in s.char_indices() {
        if ch == '?' || ch == '#' {
            end = i;
            break;
        }
    }
    &s[..end]
}

fn parse_range(header: &str, total: u64) -> Option<(u64, u64)> {
    let h = header.strip_prefix("bytes=")?;
    let mut parts = h.splitn(2, '-');
    let start_str = parts.next()?;
    let end_str = parts.next().unwrap_or("");

    let (start, end) = if start_str.is_empty() {
        // suffix range: bytes=-N -> last N bytes
        let n: u64 = end_str.parse().ok()?;
        if n == 0 || n > total {
            return None;
        }
        (total - n, total - 1)
    } else {
        let s: u64 = start_str.parse().ok()?;
        let e = if end_str.is_empty() {
            total - 1
        } else {
            let parsed: u64 = end_str.parse().ok()?;
            parsed.min(total - 1)
        };
        if s > e || s >= total {
            return None;
        }
        (s, e)
    };
    Some((start, end))
}

#[cfg(not(test))]
mod server {
    use std::fs;
    use std::io::{Read, Seek, SeekFrom};
    use std::path::{Path, PathBuf};

    use tauri::Manager;

    use crate::app_state::AppState;

    use super::{content_type_for, parse_range, strip_query_fragment};

    /// Resolve and validate the requested path against the active workspace.
    /// Returns `None` if the path is outside the workspace (security scope).
    fn resolve_scoped_path(
        ctx: &tauri::UriSchemeContext<'_, tauri::Wry>,
        decoded_path: &str,
    ) -> Option<PathBuf> {
        let workspace_path = {
            let state = ctx.app_handle().state::<AppState>();
            let inner = state.inner.read();
            inner.workspace_path.clone()?
        };

        let requested = Path::new(decoded_path);
        let canonical_req = requested.canonicalize().ok()?;
        let canonical_ws = workspace_path.canonicalize().ok()?;
        if canonical_req.starts_with(&canonical_ws) {
            Some(canonical_req)
        } else {
            None
        }
    }

    pub fn handle_local_file(
        ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
        request: http::Request<Vec<u8>>,
    ) -> http::Response<Vec<u8>> {
        let uri_str = request.uri().to_string();
        let path_str = uri_str.strip_prefix("local-file://").unwrap_or("");

        let decoded_path = urlencoding::decode(path_str).unwrap_or_else(|_| path_str.into());
        let decoded_path = strip_query_fragment(decoded_path.as_ref());

        let file_path = match resolve_scoped_path(&ctx, decoded_path) {
            Some(p) => p,
            None => {
                return http::Response::builder()
                    .status(403)
                    .header("content-type", "text/plain")
                    .body(b"Path is outside the active workspace".to_vec())
                    .unwrap_or_default();
            }
        };

        if !file_path.is_file() {
            return http::Response::builder()
                .status(404)
                .header("content-type", "text/plain")
                .body(b"File not found".to_vec())
                .unwrap_or_default();
        }

        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let content_type = content_type_for(ext.as_str());

        let total = match fs::metadata(&file_path) {
            Ok(m) => m.len(),
            Err(_) => {
                return http::Response::builder()
                    .status(500)
                    .body(Vec::new())
                    .unwrap_or_default();
            }
        };

        let range_header = request
            .headers()
            .get("range")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        if let Some(range) = &range_header {
            if let Some((start, end)) = parse_range(range, total) {
                let length = end - start + 1;
                let mut buf = vec![0u8; length as usize];
                let body = match fs::File::open(&file_path)
                    .and_then(|mut f| f.seek(SeekFrom::Start(start)).map(|_| f))
                    .and_then(|mut f| f.read_exact(&mut buf).map(|_| buf))
                {
                    Ok(b) => b,
                    Err(_) => {
                        return http::Response::builder()
                            .status(500)
                            .body(Vec::new())
                            .unwrap_or_default();
                    }
                };
                return http::Response::builder()
                    .status(206)
                    .header("content-type", content_type)
                    .header("accept-ranges", "bytes")
                    .header(
                        "content-range",
                        format!("bytes {}-{}/{}", start, end, total),
                    )
                    .header("content-length", length.to_string())
                    .header("cache-control", "no-cache")
                    .body(body)
                    .unwrap_or_default();
            }
        }

        // No valid range: serve full file. Guard against loading absurdly large
        // files into memory without a range request (e.g. >256 MiB).
        const MAX_UNRANGED: u64 = 256 * 1024 * 1024;
        if total > MAX_UNRANGED {
            return http::Response::builder()
                .status(413)
                .header("content-type", "text/plain")
                .header("accept-ranges", "bytes")
                .header("content-range", format!("bytes */{}", total))
                .body(b"File too large; use a Range request".to_vec())
                .unwrap_or_default();
        }

        match fs::File::open(&file_path) {
            Ok(mut f) => {
                let mut body = Vec::new();
                if f.read_to_end(&mut body).is_err() {
                    return http::Response::builder()
                        .status(500)
                        .body(Vec::new())
                        .unwrap_or_default();
                }
                http::Response::builder()
                    .status(200)
                    .header("content-type", content_type)
                    .header("accept-ranges", "bytes")
                    .header("cache-control", "no-cache")
                    .body(body)
                    .unwrap_or_default()
            }
            Err(_) => http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap_or_default(),
        }
    }
}

#[cfg(not(test))]
pub use server::handle_local_file;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_query_fragment_removes_query() {
        assert_eq!(
            strip_query_fragment("F:/my-repos/img.png?v=1"),
            "F:/my-repos/img.png"
        );
        assert_eq!(strip_query_fragment("img.png#anchor"), "img.png");
        assert_eq!(strip_query_fragment("img.png"), "img.png");
        assert_eq!(strip_query_fragment("img.png?v=1#x"), "img.png");
    }

    #[test]
    fn extracts_path_from_local_file_uri() {
        let path_str = "local-file://C:/Users/test/file.png";
        let extracted = path_str.strip_prefix("local-file://").unwrap_or("");
        assert_eq!(extracted, "C:/Users/test/file.png");
    }

    #[test]
    fn extracts_path_strips_query_and_fragment() {
        let uri = "local-file://F:/my-repos/img.png?v=1";
        let raw = uri.strip_prefix("local-file://").unwrap_or("");
        let decoded = urlencoding::decode(raw).unwrap_or_else(|_| raw.into());
        assert_eq!(
            strip_query_fragment(decoded.as_ref()),
            "F:/my-repos/img.png"
        );
    }

    #[test]
    fn handles_percent_encoded_paths() {
        let encoded = "local-file://F%3A%2Fmy-repos%2Fimg.png";
        let raw = encoded.strip_prefix("local-file://").unwrap_or("");
        let decoded = urlencoding::decode(raw).unwrap_or_else(|_| raw.into());
        assert_eq!(decoded, "F:/my-repos/img.png");
    }

    #[test]
    fn parse_range_full_suffix() {
        assert_eq!(parse_range("bytes=0-99", 100), Some((0, 99)));
    }

    #[test]
    fn parse_range_open_end() {
        assert_eq!(parse_range("bytes=50-", 100), Some((50, 99)));
    }

    #[test]
    fn parse_range_suffix() {
        assert_eq!(parse_range("bytes=-10", 100), Some((90, 99)));
    }

    #[test]
    fn parse_range_clamps_end() {
        assert_eq!(parse_range("bytes=90-9999", 100), Some((90, 99)));
    }

    #[test]
    fn parse_range_rejects_out_of_bounds_start() {
        assert_eq!(parse_range("bytes=100-", 100), None);
    }

    #[test]
    fn parse_range_rejects_bad_prefix() {
        assert_eq!(parse_range("items=0-99", 100), None);
    }

    #[test]
    fn content_type_covers_common_types() {
        assert_eq!(content_type_for("png"), "image/png");
        assert_eq!(content_type_for("mp4"), "video/mp4");
        assert_eq!(content_type_for("mp3"), "audio/mpeg");
        assert_eq!(content_type_for("unknown"), "application/octet-stream");
    }
}
