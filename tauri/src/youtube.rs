use std::io::Read;

const YOUTUBE_EMBED_REFERRER: &str = "https://the-long-ride.github.io/markdown-explorer/";
const ALLOWED_HOSTS: &[&str] = &["www.youtube.com", "www.youtube-nocookie.com"];

pub fn handle_youtube_proxy(
    _ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    let path_and_query = request
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    if !is_allowed_youtube_path(path_and_query) {
        return http::Response::builder()
            .status(403)
            .header("content-type", "text/plain")
            .body(b"Blocked: only YouTube hosts are allowed".to_vec())
            .unwrap_or_default();
    }

    let target_url = resolve_youtube_url(path_and_query);

    let headers_to_forward: Vec<(String, String)> = request
        .headers()
        .iter()
        .filter(|(name, _)| {
            let lower = name.as_str().to_lowercase();
            lower == "user-agent" || lower == "accept" || lower == "accept-language"
        })
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                value.to_str().unwrap_or("").to_string(),
            )
        })
        .collect();

    let mut req = ureq::get(&target_url).set("Referer", YOUTUBE_EMBED_REFERRER);
    for (name, value) in &headers_to_forward {
        req = req.set(name, value);
    }

    match req.call() {
        Ok(response) => {
            let status = response.status();
            let content_type = response
                .header("content-type")
                .unwrap_or("application/octet-stream")
                .to_string();

            let mut body = Vec::new();
            if response.into_reader().read_to_end(&mut body).is_err() {
                return http::Response::builder()
                    .status(502)
                    .body(Vec::new())
                    .unwrap_or_default();
            }

            http::Response::builder()
                .status(status)
                .header("content-type", &content_type)
                .header("access-control-allow-origin", "*")
                .body(body)
                .unwrap_or_default()
        }
        Err(_err) => http::Response::builder()
            .status(502)
            .header("content-type", "text/plain")
            .body(b"Failed to fetch YouTube content".to_vec())
            .unwrap_or_default(),
    }
}

fn is_allowed_youtube_path(path: &str) -> bool {
    if path.is_empty() || path == "/" {
        return true;
    }

    let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    if parts.is_empty() {
        return true;
    }

    let host = parts[0];
    if ALLOWED_HOSTS.contains(&host) {
        return true;
    }

    if host == "embed" || host == "www.youtube.com" || host == "www.youtube-nocookie.com" {
        return true;
    }

    false
}

fn resolve_youtube_url(path_and_query: &str) -> String {
    let path = path_and_query.trim_start_matches('/');

    if path.starts_with("embed/") || path.is_empty() {
        return format!("https://www.youtube.com/{}", path);
    }

    if path.starts_with("www.youtube.com/") {
        return format!("https://{}", path);
    }
    if path.starts_with("www.youtube-nocookie.com/") {
        return format!("https://{}", path);
    }

    let parts: Vec<&str> = path.splitn(2, '/').collect();
    if parts.len() == 2 && ALLOWED_HOSTS.contains(&parts[0]) {
        return format!("https://{}/{}", parts[0], parts[1]);
    }

    format!("https://www.youtube.com/{}", path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_youtube_embed_paths() {
        assert!(is_allowed_youtube_path("/embed/abc123"));
        assert!(is_allowed_youtube_path("/www.youtube.com/embed/abc123"));
        assert!(is_allowed_youtube_path(
            "/www.youtube-nocookie.com/embed/abc123"
        ));
    }

    #[test]
    fn blocks_non_youtube_hosts() {
        assert!(!is_allowed_youtube_path("/evil.com/embed/abc123"));
    }

    #[test]
    fn resolves_embed_paths() {
        assert_eq!(
            resolve_youtube_url("/embed/abc123"),
            "https://www.youtube.com/embed/abc123"
        );
    }

    #[test]
    fn resolves_host_prefixed_paths() {
        assert_eq!(
            resolve_youtube_url("/www.youtube-nocookie.com/embed/abc123"),
            "https://www.youtube-nocookie.com/embed/abc123"
        );
    }
}
