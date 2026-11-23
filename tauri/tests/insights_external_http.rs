use markdown_explorer_tauri_lib::insights_external::{check_url, MAX_REDIRECTS};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::thread;
use std::time::{Duration, Instant};

fn with_http_responses(steps: &[(&str, &str)], check: impl FnOnce(&str, &HashSet<String>)) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    listener.set_nonblocking(true).unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    thread::scope(|scope| {
        let server = scope.spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(5);
            for (expected_request_line, response) in steps {
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            assert!(
                                Instant::now() < deadline,
                                "expected {expected_request_line}"
                            );
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(error) => panic!("{error}"),
                    }
                };
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .unwrap();
                let mut request = BufReader::new(&stream);
                let mut line = String::new();
                request.read_line(&mut line).unwrap();
                assert_eq!(line.trim_end(), *expected_request_line);
                loop {
                    line.clear();
                    if request.read_line(&mut line).unwrap() == 0 || line == "\r\n" {
                        break;
                    }
                }
                write!(
                    stream,
                    "HTTP/1.1 {response}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                )
                .unwrap();
            }
        });
        check(&origin, &HashSet::from([origin.clone()]));
        server.join().unwrap();
    });
}

#[test]
fn check_retries_transient_error_follows_redirect_and_falls_back_to_get() {
    with_http_responses(
        &[
            ("HEAD /start HTTP/1.1", "503 Service Unavailable"),
            ("HEAD /start HTTP/1.1", "302 Found\r\nLocation: /target?a=1"),
            ("HEAD /target?a=1 HTTP/1.1", "405 Method Not Allowed"),
            (
                "GET /target?a=1 HTTP/1.1",
                "429 Too Many Requests\r\nRetry-After: 2",
            ),
        ],
        |origin, approved| {
            let url = format!("{origin}/start");
            assert_eq!(
                check_url(&url, 1000, &HashSet::new())["requiresPrivateOriginConfirmation"],
                true
            );
            let result = check_url(&url, 1000, approved);
            assert_eq!(result["url"], url);
            assert_eq!(result["status"], "rate-limited");
            assert_eq!(result["httpStatus"], 429);
            assert_eq!(result["finalUrl"], format!("{origin}/target?a=1"));
            assert_eq!(result["retryAfterMs"], 2000);
            assert_eq!(result["insecureDowngrade"], false);
        },
    );
}

#[test]
fn redirect_loop_stops_at_the_limit() {
    with_http_responses(
        &vec![("HEAD /loop HTTP/1.1", "302 Found\r\nLocation: /loop"); MAX_REDIRECTS + 1],
        |origin, approved| {
            let result = check_url(&format!("{origin}/loop"), 1000, approved);
            assert_eq!(result["status"], "unreachable");
            assert_eq!(result["reason"], "redirect-limit");
            assert_eq!(result["httpStatus"], 302);
        },
    );
}

#[test]
fn unsupported_scheme_does_not_start_a_request() {
    let result = check_url("ftp://example.com/file", 1000, &HashSet::new());
    assert_eq!(result["status"], "unsupported");
    assert_eq!(result["reason"], "unsupported-scheme");
}
