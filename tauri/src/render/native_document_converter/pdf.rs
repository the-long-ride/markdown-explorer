use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use std::path::Path;

pub fn convert(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let extracted = pdf_extract::extract_text(path)
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    Ok(ConversionOutput {
        markdown: normalize_pdf_text(&extracted),
        quality: ConversionQuality::Standard,
    })
}

fn normalize_pdf_text(text: &str) -> String {
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut paragraphs = Vec::new();
    let mut paragraph = String::new();

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !paragraph.is_empty() {
                paragraphs.push(std::mem::take(&mut paragraph));
            }
            continue;
        }
        if !paragraph.is_empty() {
            paragraph.push(' ');
        }
        paragraph.push_str(line);
    }
    if !paragraph.is_empty() {
        paragraphs.push(paragraph);
    }

    normalize(&paragraphs.join("\n\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_wrapped_pdf_lines_but_keeps_paragraphs_and_unicode() {
        assert_eq!(
            normalize_pdf_text("Café first\nline\n\n第二段\ntext"),
            "Café first line\n\n第二段 text"
        );
    }
}
