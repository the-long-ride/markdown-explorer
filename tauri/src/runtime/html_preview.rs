use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex, RwLock};
use uuid::Uuid;

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(2 * 60);
const MAX_LIFETIME: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_DOCUMENT_BYTES: usize = 8 * 1024 * 1024;

struct PreviewSession {
    document_html: String,
    created_at: Instant,
    last_seen_at: Instant,
}

struct PreviewServer {
    origin: String,
    sessions: Arc<RwLock<HashMap<String, PreviewSession>>>,
    shutdown: Option<oneshot::Sender<()>>,
}

static SERVER: Lazy<Mutex<Option<PreviewServer>>> = Lazy::new(|| Mutex::new(None));

fn inject_lifecycle_script(document_html: &str, token: &str) -> String {
    let token_json = serde_json::to_string(token).unwrap_or_else(|_| "\"\"".to_string());
    let script = format!(
        r#"<script data-mdn-preview-session>(function(){{const token={token_json};const heartbeatUrl=location.origin+'/heartbeat/'+encodeURIComponent(token);const closeUrl=location.origin+'/close/'+encodeURIComponent(token);const ping=()=>fetch(heartbeatUrl,{{method:'POST',cache:'no-store',keepalive:true}}).catch(()=>{{}});const close=()=>{{try{{navigator.sendBeacon(closeUrl,'');}}catch(_){{}}}};ping();const timer=setInterval(ping,15000);addEventListener('pagehide',()=>{{clearInterval(timer);close();}},{{once:true}});addEventListener('beforeunload',close,{{once:true}});}})();</script>"#
    );
    let lower = document_html.to_ascii_lowercase();
    if let Some(head_start) = lower.find("<head") {
        if let Some(relative_end) = lower[head_start..].find('>') {
            let insertion = head_start + relative_end + 1;
            let mut result = String::with_capacity(document_html.len() + script.len());
            result.push_str(&document_html[..insertion]);
            result.push_str(&script);
            result.push_str(&document_html[insertion..]);
            return result;
        }
    }
    if let Some(html_start) = lower.find("<html") {
        if let Some(relative_end) = lower[html_start..].find('>') {
            let insertion = html_start + relative_end + 1;
            let mut result = String::with_capacity(document_html.len() + script.len());
            result.push_str(&document_html[..insertion]);
            result.push_str(&script);
            result.push_str(&document_html[insertion..]);
            return result;
        }
    }
    format!("{script}{document_html}")
}

async fn write_response(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &str,
) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store, no-cache, must-revalidate\r\nPragma: no-cache\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.as_bytes().len()
    );
    stream.write_all(response.as_bytes()).await
}

async fn handle_connection(
    mut stream: TcpStream,
    sessions: Arc<RwLock<HashMap<String, PreviewSession>>>,
) -> std::io::Result<()> {
    let mut buffer = vec![0_u8; 16 * 1024];
    let read = stream.read(&mut buffer).await?;
    if read == 0 {
        return Ok(());
    }
    let request = String::from_utf8_lossy(&buffer[..read]);
    let first_line = request.lines().next().unwrap_or_default();
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts
        .next()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default();

    if let Some(token) = path.strip_prefix("/preview/") {
        if method != "GET" {
            return write_response(
                &mut stream,
                "405 Method Not Allowed",
                "text/plain; charset=utf-8",
                "",
            )
            .await;
        }
        let document = {
            let mut guard = sessions.write().await;
            guard.get_mut(token).map(|session| {
                session.last_seen_at = Instant::now();
                session.document_html.clone()
            })
        };
        if let Some(document_html) = document {
            let body = inject_lifecycle_script(&document_html, token);
            return write_response(&mut stream, "200 OK", "text/html; charset=utf-8", &body).await;
        }
        return write_response(
            &mut stream,
            "404 Not Found",
            "text/plain; charset=utf-8",
            "Preview expired",
        )
        .await;
    }

    if let Some(token) = path.strip_prefix("/heartbeat/") {
        if method != "POST" {
            return write_response(
                &mut stream,
                "405 Method Not Allowed",
                "text/plain; charset=utf-8",
                "",
            )
            .await;
        }
        let found = {
            let mut guard = sessions.write().await;
            if let Some(session) = guard.get_mut(token) {
                session.last_seen_at = Instant::now();
                true
            } else {
                false
            }
        };
        return write_response(
            &mut stream,
            if found {
                "204 No Content"
            } else {
                "404 Not Found"
            },
            "text/plain; charset=utf-8",
            "",
        )
        .await;
    }

    if let Some(token) = path.strip_prefix("/close/") {
        if method != "POST" {
            return write_response(
                &mut stream,
                "405 Method Not Allowed",
                "text/plain; charset=utf-8",
                "",
            )
            .await;
        }
        sessions.write().await.remove(token);
        return write_response(
            &mut stream,
            "204 No Content",
            "text/plain; charset=utf-8",
            "",
        )
        .await;
    }

    write_response(
        &mut stream,
        "404 Not Found",
        "text/plain; charset=utf-8",
        "Not found",
    )
    .await
}

async fn ensure_server() -> anyhow::Result<(String, Arc<RwLock<HashMap<String, PreviewSession>>>)> {
    let mut guard = SERVER.lock().await;
    if let Some(server) = guard.as_ref() {
        return Ok((server.origin.clone(), server.sessions.clone()));
    }

    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let address = listener.local_addr()?;
    let origin = format!("http://127.0.0.1:{}", address.port());
    let sessions = Arc::new(RwLock::new(HashMap::<String, PreviewSession>::new()));
    let task_sessions = sessions.clone();
    let (shutdown_tx, mut shutdown_rx) = oneshot::channel();

    tauri::async_runtime::spawn(async move {
        let mut cleanup = tokio::time::interval(Duration::from_secs(15));
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => break,
                _ = cleanup.tick() => {
                    let now = Instant::now();
                    task_sessions.write().await.retain(|_, session| {
                        now.duration_since(session.last_seen_at) <= HEARTBEAT_TIMEOUT
                            && now.duration_since(session.created_at) <= MAX_LIFETIME
                    });
                }
                accepted = listener.accept() => {
                    match accepted {
                        Ok((stream, _)) => {
                            let connection_sessions = task_sessions.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = handle_connection(stream, connection_sessions).await;
                            });
                        }
                        Err(_) => break,
                    }
                }
            }
        }
        task_sessions.write().await.clear();
    });

    *guard = Some(PreviewServer {
        origin: origin.clone(),
        sessions: sessions.clone(),
        shutdown: Some(shutdown_tx),
    });
    Ok((origin, sessions))
}

pub async fn open<R: tauri::Runtime>(
    app: &AppHandle<R>,
    document_html: &str,
) -> anyhow::Result<String> {
    open_with(document_html, |url| {
        app.opener().open_url(url, None::<&str>)?;
        Ok(())
    })
    .await
}

async fn open_with(
    document_html: &str,
    open_url: impl FnOnce(&str) -> anyhow::Result<()>,
) -> anyhow::Result<String> {
    if document_html.trim().is_empty() {
        anyhow::bail!("Preview document must be a non-empty string");
    }
    if document_html.len() > MAX_DOCUMENT_BYTES {
        anyhow::bail!("Preview document is too large");
    }
    let (origin, sessions) = ensure_server().await?;
    let token = Uuid::new_v4().to_string();
    let now = Instant::now();
    sessions.write().await.insert(
        token.clone(),
        PreviewSession {
            document_html: document_html.to_string(),
            created_at: now,
            last_seen_at: now,
        },
    );
    let url = format!("{origin}/preview/{token}");
    if let Err(error) = open_url(&url) {
        sessions.write().await.remove(&token);
        return Err(error);
    }
    Ok(url)
}

pub async fn shutdown() {
    let mut guard = SERVER.lock().await;
    if let Some(mut server) = guard.take() {
        server.sessions.write().await.clear();
        if let Some(shutdown) = server.shutdown.take() {
            let _ = shutdown.send(());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn request(url: &str, method: &str, path: &str) -> String {
        tokio::time::timeout(Duration::from_secs(5), async {
            let mut stream = TcpStream::connect(url.strip_prefix("http://").unwrap())
                .await
                .unwrap();
            stream
                .write_all(
                    format!("{method} {path} HTTP/1.1\r\nHost: localhost\r\n\r\n").as_bytes(),
                )
                .await
                .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).await.unwrap();
            response
        })
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn creates_serves_and_closes_preview_sessions_without_launching_browser() {
        assert!(
            open_with(" ", |_| panic!("invalid preview must not launch"))
                .await
                .is_err()
        );
        assert!(open_with(&"x".repeat(MAX_DOCUMENT_BYTES + 1), |_| panic!(
            "oversized preview must not launch"
        ))
        .await
        .is_err());
        let mut launched = String::new();
        let url = open_with("<head></head><p>Preview</p>", |url| {
            launched = url.to_owned();
            Ok(())
        })
        .await
        .unwrap();
        assert_eq!(url, launched);
        let (origin, token) = url.split_once("/preview/").unwrap();
        let (reused_origin, sessions) = ensure_server().await.unwrap();
        assert_eq!(origin, reused_origin);

        let preview = format!("/preview/{token}");
        let heartbeat = format!("/heartbeat/{token}");
        let close = format!("/close/{token}");
        assert!(request(origin, "POST", &preview)
            .await
            .starts_with("HTTP/1.1 405"));
        assert!(request(origin, "GET", &heartbeat)
            .await
            .starts_with("HTTP/1.1 405"));
        assert!(request(origin, "GET", &close)
            .await
            .starts_with("HTTP/1.1 405"));
        let page = request(origin, "GET", &format!("{preview}?v=1")).await;
        assert!(page.starts_with("HTTP/1.1 200"));
        assert!(page.contains("Cache-Control: no-store"));
        assert!(page.contains("data-mdn-preview-session"));
        assert!(page.ends_with("<p>Preview</p>"));
        assert!(request(origin, "POST", &heartbeat)
            .await
            .starts_with("HTTP/1.1 204"));
        assert!(request(origin, "POST", &close)
            .await
            .starts_with("HTTP/1.1 204"));
        assert!(request(origin, "GET", &preview)
            .await
            .ends_with("Preview expired"));
        assert!(request(origin, "POST", &heartbeat)
            .await
            .starts_with("HTTP/1.1 404"));
        assert!(request(origin, "GET", "/unknown")
            .await
            .ends_with("Not found"));

        let failure = open_with("<p>second</p>", |_| anyhow::bail!("launch failed"))
            .await
            .unwrap_err();
        assert_eq!(failure.to_string(), "launch failed");
        assert!(sessions.read().await.is_empty());
        shutdown().await;
        assert!(SERVER.lock().await.is_none());
    }

    #[test]
    fn lifecycle_script_is_injected_before_body_close() {
        let html = inject_lifecycle_script("<html><body>Preview</body></html>", "token");
        assert!(html.contains("/heartbeat/"));
        assert!(html.contains("/close/"));
        assert!(html.find("data-mdn-preview-session").unwrap() < html.find("</body>").unwrap());
    }

    #[test]
    fn lifecycle_script_precedes_headless_csp_meta() {
        let html = inject_lifecycle_script(
            r#"<html><meta http-equiv="Content-Security-Policy" content="script-src 'none'"><body>Preview</body></html>"#,
            "token",
        );
        assert!(
            html.find("data-mdn-preview-session").unwrap()
                < html.find("Content-Security-Policy").unwrap()
        );
    }
}
