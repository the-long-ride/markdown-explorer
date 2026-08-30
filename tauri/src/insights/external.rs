use serde_json::{json, Value};
use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::str::FromStr;
use std::time::Duration;

pub const MAX_REDIRECTS: usize = 5;
pub const GLOBAL_CONCURRENCY: usize = 4;
pub const ORIGIN_CONCURRENCY: usize = 2;
pub const DEFAULT_TIMEOUT_MS: u64 = 10_000;

#[derive(Clone, Debug, PartialEq, Eq)]
struct ParsedHttpUrl {
    raw: String,
    scheme: String,
    authority: String,
    host: String,
    port: u16,
    path_and_query: String,
}

impl ParsedHttpUrl {
    fn parse(input: &str) -> Result<Self, String> {
        let uri = http::Uri::from_str(input).map_err(|_| "invalid-url".to_string())?;
        let scheme = uri.scheme_str().ok_or_else(|| "missing-scheme".to_string())?.to_ascii_lowercase();
        if scheme != "http" && scheme != "https" {
            return Err("unsupported-scheme".into());
        }
        let authority = uri.authority().ok_or_else(|| "missing-authority".to_string())?;
        if authority.as_str().contains('@') {
            return Err("embedded-credentials-unsupported".into());
        }
        let host = authority.host().to_string();
        if host.is_empty() {
            return Err("missing-host".into());
        }
        let port = authority.port_u16().unwrap_or(if scheme == "https" { 443 } else { 80 });
        let path_and_query = uri
            .path_and_query()
            .map(|value| value.as_str().to_string())
            .unwrap_or_else(|| "/".to_string());
        Ok(Self {
            raw: input.to_string(),
            scheme,
            authority: authority.as_str().to_string(),
            host,
            port,
            path_and_query,
        })
    }

    fn origin(&self) -> String {
        let default_port = (self.scheme == "https" && self.port == 443) || (self.scheme == "http" && self.port == 80);
        if default_port && !self.authority.rsplit_once(':').is_some_and(|(_, port)| port.parse::<u16>().is_ok()) {
            format!("{}://{}", self.scheme, self.host)
        } else {
            format!("{}://{}", self.scheme, self.authority)
        }
    }
}

fn normalize_path(path: &str) -> String {
    let mut output: Vec<&str> = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                output.pop();
            }
            other => output.push(other),
        }
    }
    format!("/{}", output.join("/"))
}

fn resolve_redirect(base: &ParsedHttpUrl, location: &str) -> Result<ParsedHttpUrl, String> {
    let location = location.trim();
    let target = if location.starts_with("http://") || location.starts_with("https://") {
        location.to_string()
    } else if location.starts_with("//") {
        format!("{}:{}", base.scheme, location)
    } else if location.starts_with('/') {
        format!("{}://{}{}", base.scheme, base.authority, location)
    } else if location.starts_with('?') {
        let path = base.path_and_query.split('?').next().unwrap_or("/");
        format!("{}://{}{}{}", base.scheme, base.authority, path, location)
    } else {
        let base_path = base.path_and_query.split('?').next().unwrap_or("/");
        let directory = base_path.rsplit_once('/').map(|(dir, _)| dir).unwrap_or("");
        let path = normalize_path(&format!("{directory}/{location}"));
        format!("{}://{}{}", base.scheme, base.authority, path)
    };
    ParsedHttpUrl::parse(&target)
}

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, _, _] = ip.octets();
    a == 0
        || a == 10
        || a == 127
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || a >= 224
}

fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() || ip.is_multicast() {
        return true;
    }
    let first = ip.segments()[0];
    (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(value) => is_private_ipv4(value),
        IpAddr::V6(value) => value.to_ipv4_mapped().map(is_private_ipv4).unwrap_or_else(|| is_private_ipv6(value)),
    }
}

fn is_private_hostname(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    host == "localhost" || host.ends_with(".localhost")
}

pub fn classify_status(status: u16) -> &'static str {
    match status {
        200..=399 => "reachable",
        401 | 403 => "reachable-auth-required",
        404 | 410 => "broken",
        429 => "rate-limited",
        500..=599 => "server-error",
        _ => "unreachable",
    }
}

fn resolve_addresses(parsed: &ParsedHttpUrl) -> Result<Vec<IpAddr>, String> {
    let addresses = (parsed.host.as_str(), parsed.port)
        .to_socket_addrs()
        .map_err(|error| error.to_string())?
        .map(|socket| socket.ip())
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        Err("dns-empty".into())
    } else {
        Ok(addresses)
    }
}

#[derive(Debug)]
struct ResponseMeta {
    status: u16,
    location: Option<String>,
    retry_after: Option<String>,
}

fn request_once(parsed: &ParsedHttpUrl, ip: IpAddr, method: &str, timeout_ms: u64) -> Result<ResponseMeta, String> {
    let socket = SocketAddr::new(ip, parsed.port);
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(Duration::from_millis(timeout_ms.max(1)))
        .resolver(move |_addr: &str| Ok(vec![socket]))
        .build();
    let outcome = agent
        .request(method, &parsed.raw)
        .set("Accept", "*/*")
        .set("User-Agent", "Markdown Explorer/Insights")
        .call();
    let response = match outcome {
        Ok(response) => response,
        Err(ureq::Error::Status(_, response)) => response,
        Err(error) => return Err(error.to_string()),
    };
    Ok(ResponseMeta {
        status: response.status(),
        location: response.header("Location").map(ToOwned::to_owned),
        retry_after: response.header("Retry-After").map(ToOwned::to_owned),
    })
}

fn parse_retry_after(value: Option<&str>) -> Option<u64> {
    let raw = value?.trim();
    raw.parse::<u64>().ok().map(|seconds| seconds.saturating_mul(1000))
}

pub fn origin_for_url(url: &str) -> String {
    ParsedHttpUrl::parse(url).map(|parsed| parsed.origin()).unwrap_or_default()
}

pub fn check_url(url: &str, timeout_ms: u64, approved_private_origins: &HashSet<String>) -> Value {
    let original_url = url.to_string();
    let mut current = match ParsedHttpUrl::parse(url) {
        Ok(value) => value,
        Err(reason) => return json!({"url": original_url, "status": "unsupported", "reason": reason}),
    };
    let mut redirects = 0usize;
    let mut transient_retries = 0usize;
    let mut insecure_downgrade = false;

    loop {
        let origin = current.origin();
        let addresses = match resolve_addresses(&current) {
            Ok(value) => value,
            Err(reason) => return json!({
                "url": original_url,
                "status": "unreachable",
                "finalUrl": current.raw,
                "insecureDowngrade": insecure_downgrade,
                "reason": reason,
            }),
        };
        if (is_private_hostname(&current.host) || addresses.iter().copied().any(is_private_ip))
            && !approved_private_origins.contains(&origin)
        {
            return json!({
                "url": original_url,
                "status": "unchecked",
                "finalUrl": current.raw,
                "insecureDowngrade": insecure_downgrade,
                "privateOrigin": origin,
                "requiresPrivateOriginConfirmation": true,
                "reason": "private-origin-confirmation-required",
            });
        }
        let ip = addresses[0];
        let mut response = match request_once(&current, ip, "HEAD", timeout_ms) {
            Ok(value) => value,
            Err(reason) => return json!({
                "url": original_url,
                "status": "unreachable",
                "finalUrl": current.raw,
                "insecureDowngrade": insecure_downgrade,
                "reason": reason,
            }),
        };
        if response.status == 405 || response.status == 501 {
            response = match request_once(&current, ip, "GET", timeout_ms) {
                Ok(value) => value,
                Err(reason) => return json!({
                    "url": original_url,
                    "status": "unreachable",
                    "finalUrl": current.raw,
                    "insecureDowngrade": insecure_downgrade,
                    "reason": reason,
                }),
            };
        }

        if (300..400).contains(&response.status) {
            if let Some(location) = response.location.as_deref() {
                if redirects >= MAX_REDIRECTS {
                    return json!({
                        "url": original_url,
                        "status": "unreachable",
                        "httpStatus": response.status,
                        "finalUrl": current.raw,
                        "insecureDowngrade": insecure_downgrade,
                        "reason": "redirect-limit",
                    });
                }
                let next = match resolve_redirect(&current, location) {
                    Ok(value) => value,
                    Err(reason) => return json!({
                        "url": original_url,
                        "status": "unreachable",
                        "httpStatus": response.status,
                        "finalUrl": current.raw,
                        "insecureDowngrade": insecure_downgrade,
                        "reason": reason,
                    }),
                };
                if current.scheme == "https" && next.scheme == "http" {
                    insecure_downgrade = true;
                }
                current = next;
                redirects += 1;
                transient_retries = 0;
                continue;
            }
        }

        if (500..600).contains(&response.status) && transient_retries < 1 {
            transient_retries += 1;
            continue;
        }

        let mut result = json!({
            "url": original_url,
            "status": classify_status(response.status),
            "httpStatus": response.status,
            "finalUrl": current.raw,
            "insecureDowngrade": insecure_downgrade,
        });
        if let Some(retry_after_ms) = parse_retry_after(response.retry_after.as_deref()) {
            if let Some(object) = result.as_object_mut() {
                object.insert("retryAfterMs".into(), retry_after_ms.into());
            }
        }
        return result;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_http_statuses() {
        assert_eq!(classify_status(200), "reachable");
        assert_eq!(classify_status(302), "reachable");
        assert_eq!(classify_status(401), "reachable-auth-required");
        assert_eq!(classify_status(404), "broken");
        assert_eq!(classify_status(429), "rate-limited");
        assert_eq!(classify_status(503), "server-error");
    }

    #[test]
    fn rejects_private_and_local_addresses() {
        assert!(is_private_ip("127.0.0.1".parse().unwrap()));
        assert!(is_private_ip("10.1.2.3".parse().unwrap()));
        assert!(is_private_ip("169.254.2.3".parse().unwrap()));
        assert!(is_private_ip("::1".parse().unwrap()));
        assert!(is_private_ip("fd00::1".parse().unwrap()));
        assert!(!is_private_ip("203.0.113.15".parse().unwrap()));
    }

    #[test]
    fn keeps_private_approval_origin_scoped() {
        assert_eq!(origin_for_url("https://example.test/path"), "https://example.test");
        assert_eq!(origin_for_url("http://example.test:8080/path"), "http://example.test:8080");
    }

    #[test]
    fn resolves_relative_redirects_without_losing_origin() {
        let base = ParsedHttpUrl::parse("https://example.test/a/b/index.md?x=1").unwrap();
        assert_eq!(resolve_redirect(&base, "../next").unwrap().raw, "https://example.test/a/next");
        assert_eq!(resolve_redirect(&base, "/root").unwrap().raw, "https://example.test/root");
    }
}
