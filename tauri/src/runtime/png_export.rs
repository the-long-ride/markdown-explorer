use std::path::Path;

pub const PNG_DATA_URL_PREFIX: &str = "data:image/png;base64,";
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut accumulator = 0u32;
    let mut bits = 0u8;
    let mut padding_started = false;

    for byte in input.bytes() {
        if byte.is_ascii_whitespace() {
            continue;
        }
        if byte == b'=' {
            padding_started = true;
            continue;
        }
        if padding_started {
            return Err("Invalid base64 padding".into());
        }
        let value = base64_value(byte).ok_or_else(|| "Invalid base64 character".to_string())?;
        accumulator = (accumulator << 6) | u32::from(value);
        bits += 6;
        while bits >= 8 {
            bits -= 8;
            output.push(((accumulator >> bits) & 0xff) as u8);
        }
    }

    Ok(output)
}

pub fn decode_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "Expected a base64 data URL".to_string())?;
    if !metadata.starts_with("data:") || !metadata.to_ascii_lowercase().ends_with(";base64") {
        return Err("Expected a base64 data URL".into());
    }
    decode_base64(encoded)
}

pub fn decode_png_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let encoded = data_url
        .strip_prefix(PNG_DATA_URL_PREFIX)
        .ok_or_else(|| "Expected a PNG data URL".to_string())?;
    let bytes = decode_base64(encoded)?;
    if bytes.len() < PNG_SIGNATURE.len() || &bytes[..PNG_SIGNATURE.len()] != PNG_SIGNATURE {
        return Err("Decoded data is not a PNG".into());
    }
    Ok(bytes)
}

fn sanitize_leaf(file_name: &str, fallback: &str) -> String {
    let leaf = Path::new(file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(fallback)
        .trim();
    let safe = leaf
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            other => other,
        })
        .collect::<String>();
    if safe.is_empty() { fallback.into() } else { safe }
}

pub fn normalize_export_file_name(file_name: &str) -> String {
    sanitize_leaf(file_name, "export.bin")
}

pub fn normalize_png_file_name(file_name: &str) -> String {
    let mut safe = sanitize_leaf(file_name, "chart.png");
    if !safe.to_ascii_lowercase().ends_with(".png") {
        safe.push_str(".png");
    }
    safe
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_png_data_url() {
        let data = decode_png_data_url("data:image/png;base64,iVBORw0KGgo=").unwrap();
        assert_eq!(&data[..8], PNG_SIGNATURE);
    }

    #[test]
    fn rejects_non_png_data() {
        assert!(decode_png_data_url("data:image/png;base64,SGVsbG8=").is_err());
    }

    #[test]
    fn decodes_generic_base64_data_url() {
        assert_eq!(decode_data_url("data:text/html;charset=utf-8;base64,SGVsbG8=").unwrap(), b"Hello");
        assert_eq!(decode_data_url("data:application/zip;base64,WklQ").unwrap(), b"ZIP");
    }

    #[test]
    fn rejects_non_base64_data_url() {
        assert!(decode_data_url("data:text/plain,Hello").is_err());
    }

    #[test]
    fn normalizes_export_file_name_without_forcing_png() {
        assert_eq!(normalize_export_file_name("../Docs: export.html"), "Docs- export.html");
        assert_eq!(normalize_export_file_name("site.zip"), "site.zip");
    }

    #[test]
    fn normalizes_png_file_name() {
        assert_eq!(normalize_png_file_name("../Budget: chart"), "Budget- chart.png");
        assert_eq!(normalize_png_file_name("report.PNG"), "report.PNG");
    }
}
