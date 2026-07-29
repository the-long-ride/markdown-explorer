use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use office_oxide::{Document, DocumentFormat};
use std::io::Cursor;
use std::path::Path;

fn unescape_xml_entities(text: &str) -> String {
    let mut decoded = text.to_owned();

    loop {
        let next = decoded
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'");

        if next == decoded {
            return decoded;
        }
        decoded = next;
    }
}

pub fn convert(path: &Path, extension: &str) -> Result<ConversionOutput, ConversionError> {
    let document = if extension == "xlm" {
        let bytes = std::fs::read(path)?;
        Document::from_reader(Cursor::new(bytes), DocumentFormat::Xls)
    } else {
        Document::open(path)
    }
    .map_err(|error| ConversionError::Parse(error.to_string()))?;

    let quality = quality_for_extension(extension);

    Ok(ConversionOutput {
        markdown: normalize(&unescape_xml_entities(&document.to_markdown())),
        quality,
    })
}

fn quality_for_extension(extension: &str) -> ConversionQuality {
    if matches!(extension, "doc" | "xls" | "xlm") {
        ConversionQuality::BestEffortLegacy
    } else {
        ConversionQuality::Standard
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_nested_xml_entities_from_office_markdown() {
        assert_eq!(
            unescape_xml_entities("Alpha &amp;amp; beta"),
            "Alpha & beta"
        );
        assert_eq!(
            unescape_xml_entities("&amp;lt;tag&amp;gt; &quot;value&quot;"),
            "<tag> \"value\""
        );
    }

    #[test]
    fn classifies_legacy_extensions_as_best_effort() {
        for extension in ["doc", "xls", "xlm"] {
            assert_eq!(
                quality_for_extension(extension),
                ConversionQuality::BestEffortLegacy
            );
        }
        for extension in ["docx", "xlsx"] {
            assert_eq!(quality_for_extension(extension), ConversionQuality::Standard);
        }
    }
}
