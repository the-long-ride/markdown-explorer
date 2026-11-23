use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

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
        "ttf" => "font/ttf",
        "otf" => "font/otf",
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

fn resolve_scoped_path(
    decoded_path: &str,
    workspace_path: Option<&Path>,
    fonts_path: Option<&Path>,
) -> Option<PathBuf> {
    let canonical_req = Path::new(decoded_path).canonicalize().ok()?;
    let is_contained = |root: &Path| {
        root.canonicalize()
            .is_ok_and(|root| canonical_req.starts_with(root))
    };
    if workspace_path.is_some_and(is_contained) || fonts_path.is_some_and(is_contained) {
        Some(canonical_req)
    } else {
        None
    }
}

fn serve_local_file(
    uri_str: &str,
    range_header: Option<&str>,
    workspace_path: Option<&Path>,
    fonts_path: Option<&Path>,
) -> http::Response<Vec<u8>> {
    // Accept every transport form the webviews produce for this protocol:
    // - `local-file://<path>` (macOS/Linux, and the historical JS shim form)
    // - `http(s)://local-file.localhost/<path>` (WebView2 on Windows rewrites
    //   custom schemes to the .localhost transport before they reach us)
    let path_str = uri_str
        .strip_prefix("local-file://")
        .or_else(|| uri_str.strip_prefix("http://local-file.localhost/"))
        .or_else(|| uri_str.strip_prefix("https://local-file.localhost/"))
        .unwrap_or("");

    let decoded_path = urlencoding::decode(path_str).unwrap_or_else(|_| path_str.into());
    let decoded_path = strip_query_fragment(decoded_path.as_ref());

    let file_path = match resolve_scoped_path(decoded_path, workspace_path, fonts_path) {
        Some(p) => p,
        None => {
            return http::Response::builder()
                .status(403)
                .header("content-type", "text/plain")
                .body(b"Path is outside the allowed local roots".to_vec())
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

    if let Some(range) = range_header {
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

#[cfg(not(test))]
pub fn handle_local_file(
    ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    use tauri::Manager;
    let workspace_path = {
        let state = ctx.app_handle().state::<crate::app_state::AppState>();
        let inner = state.inner.read();
        inner.workspace_path.clone()
    };
    let fonts_path = ctx
        .app_handle()
        .path()
        .app_data_dir()
        .ok()
        .map(|root| root.join("fonts"));
    serve_local_file(
        &request.uri().to_string(),
        request
            .headers()
            .get("range")
            .and_then(|value| value.to_str().ok()),
        workspace_path.as_deref(),
        fonts_path.as_deref(),
    )
}

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

    #[test]
    fn serves_full_and_partial_responses_for_both_webview_transports() {
        let temp = tempfile::tempdir().unwrap();
        let fonts = temp.path().join("fonts");
        fs::create_dir(&fonts).unwrap();
        let path = fonts.join("Managed Face.OTF");
        fs::write(&path, b"0123456789").unwrap();
        let name = path.to_str().unwrap();
        let encoded = urlencoding::encode(name);
        for prefix in [
            "local-file://",
            "http://local-file.localhost/",
            "https://local-file.localhost/",
        ] {
            let uri = format!("{prefix}{encoded}?v=2");
            let full = serve_local_file(&uri, None, None, Some(&fonts));
            assert_eq!(full.status(), 200);
            assert_eq!(full.headers()["content-type"], "font/otf");
            assert_eq!(full.body(), b"0123456789");
            let partial = serve_local_file(&uri, Some("bytes=2-4"), None, Some(&fonts));
            assert_eq!(partial.status(), 206);
            assert_eq!(partial.headers()["content-range"], "bytes 2-4/10");
            assert_eq!(partial.body(), b"234");
            let invalid = serve_local_file(&uri, Some("bytes=bogus"), None, Some(&fonts));
            assert_eq!(invalid.status(), 200);
        }
        let blocked = serve_local_file(&format!("local-file://{encoded}"), None, None, None);
        assert_eq!(blocked.status(), 403);
        let directory = format!(
            "local-file://{}",
            urlencoding::encode(fonts.to_str().unwrap())
        );
        assert_eq!(
            serve_local_file(&directory, None, Some(temp.path()), None).status(),
            404
        );
    }

    #[test]
    fn large_media_requires_a_range() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("large.mp4");
        fs::File::create(&path)
            .unwrap()
            .set_len(256 * 1024 * 1024 + 1)
            .unwrap();
        let uri = format!(
            "local-file://{}",
            urlencoding::encode(path.to_str().unwrap())
        );
        let response = serve_local_file(&uri, None, Some(temp.path()), None);
        assert_eq!(response.status(), 413);
        assert_eq!(response.headers()["content-range"], "bytes */268435457");
        let partial = serve_local_file(&uri, Some("bytes=0-1"), Some(temp.path()), None);
        assert_eq!(partial.status(), 206);
        assert_eq!(partial.body(), &[0, 0]);
    }
}
