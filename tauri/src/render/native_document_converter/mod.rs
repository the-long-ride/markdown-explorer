use std::path::Path;

mod html;
mod markdown;
mod odf;
mod office;
mod pdf;
mod pptx;
mod rtf;
mod spreadsheet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConversionQuality {
    Standard,
    BestEffortLegacy,
}

impl ConversionQuality {
    pub fn quality_code(self) -> &'static str {
        match self {
            Self::Standard => "converted-preview",
            Self::BestEffortLegacy => "legacy-best-effort",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConversionOutput {
    pub markdown: String,
    pub quality: ConversionQuality,
}

#[derive(Debug, thiserror::Error)]
pub enum ConversionError {
    #[error("unsupported document format: {0}")]
    UnsupportedFormat(String),
    #[error("unable to read document: {0}")]
    Io(#[from] std::io::Error),
    #[error("unable to parse document: {0}")]
    Parse(String),
    #[error("document member {member} is too large to preview safely ({bytes} bytes)")]
    TooLarge { member: String, bytes: u64 },
}

pub fn convert_file(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "doc" | "docx" | "xls" | "xlsx" | "xlm" => office::convert(path, &extension),
        "pptx" => pptx::convert(path),
        "pdf" => pdf::convert(path),
        "html" => html::convert(path),
        "rtf" => rtf::convert(path),
        "odt" => odf::convert_odt(path),
        "odp" => odf::convert_odp(path),
        "ods" => spreadsheet::convert_ods(path),
        _ => Err(ConversionError::UnsupportedFormat(extension)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quality_codes_are_stable() {
        assert_eq!(ConversionQuality::Standard.quality_code(), "converted-preview");
        assert_eq!(
            ConversionQuality::BestEffortLegacy.quality_code(),
            "legacy-best-effort"
        );
    }

    #[test]
    fn unsupported_extension_returns_typed_error() {
        let error = convert_file(Path::new("report.pages")).unwrap_err();
        assert!(matches!(error, ConversionError::UnsupportedFormat(_)));
    }
}
