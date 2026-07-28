use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use rtf_parser::RtfDocument;
use std::path::Path;

pub fn convert(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let bytes = std::fs::read(path)?;
    let source = String::from_utf8_lossy(&bytes);
    Ok(ConversionOutput {
        markdown: convert_rtf(&source)?,
        quality: ConversionQuality::Standard,
    })
}

fn convert_rtf(source: &str) -> Result<String, ConversionError> {
    if !source.trim_start().starts_with("{\\rtf") {
        return Err(ConversionError::Parse("invalid RTF header".to_string()));
    }
    if source.contains("\\bin") {
        return Err(ConversionError::Parse(
            "binary RTF payloads are not supported in preview".to_string(),
        ));
    }

    let document = RtfDocument::try_from(source)
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    let mut markdown = String::new();

    for block in document.body {
        let mut text = block.text;
        if text.is_empty() {
            continue;
        }
        if block.painter.bold {
            text = format!("**{text}**");
        }
        if block.painter.italic {
            text = format!("*{text}*");
        }
        if block.painter.strike {
            text = format!("~~{text}~~");
        }
        markdown.push_str(&text);
    }

    Ok(normalize(&markdown))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_styled_rtf_without_panicking() {
        let markdown = convert_rtf(r#"{\rtf1\ansi Hello \b bold\b0\par Next}"#).unwrap();
        assert!(markdown.contains("Hello"));
        assert!(markdown.contains("**bold**"));
        assert!(markdown.contains("Next"));
    }

    #[test]
    fn malformed_rtf_is_an_error() {
        let outcome = std::panic::catch_unwind(|| convert_rtf("not rtf"));
        assert!(outcome.is_ok());
        assert!(outcome.unwrap().is_err());
    }

    #[test]
    fn binary_rtf_payload_is_rejected() {
        assert!(convert_rtf(r#"{\rtf1\ansi\bin4 abcd}"#).is_err());
    }
}
