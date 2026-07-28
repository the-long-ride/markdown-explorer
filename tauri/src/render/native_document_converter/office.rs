use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use office_oxide::{Document, DocumentFormat};
use std::io::Cursor;
use std::path::Path;

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
        markdown: normalize(&document.to_markdown()),
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
    fn converts_real_pptx_fixture_in_slide_order() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join("sample-presentation.pptx");
        let output = convert(&path, "pptx").expect("convert PPTX fixture");
        assert_eq!(output.quality, ConversionQuality::Standard);
        assert!(output.markdown.contains("First slide title"));
        assert!(output.markdown.contains("Alpha & beta"));
        assert!(output.markdown.contains("Second line"));
        assert!(output.markdown.contains("Second slide title"));
        assert!(
            output.markdown.find("First slide title").unwrap()
                < output.markdown.find("Second slide title").unwrap()
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
        for extension in ["docx", "xlsx", "pptx"] {
            assert_eq!(quality_for_extension(extension), ConversionQuality::Standard);
        }
    }
}
