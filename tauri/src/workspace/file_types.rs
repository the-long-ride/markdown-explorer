pub const EXTRA_DOCUMENT_EXTENSIONS: &[&str] = &[
    ".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx",
    ".odt", ".odp", ".ods", ".rtf",
];

pub fn extension(file_name: &str) -> String {
    std::path::Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!(".{}", ext.to_ascii_lowercase()))
        .unwrap_or_default()
}

pub fn is_markdown_file_path(file_path: &str) -> bool {
    matches!(extension(file_path).as_str(), ".md" | ".mdx" | ".markdown")
}

pub fn is_extra_document_file_path(file_path: &str) -> bool {
    EXTRA_DOCUMENT_EXTENSIONS.contains(&extension(file_path).as_str())
}

pub fn is_supported_file_path(file_path: &str, document_conversion_enabled: bool) -> bool {
    if matches!(extension(file_path).as_str(), ".md" | ".mdx" | ".markdown" | ".txt") {
        return true;
    }
    document_conversion_enabled && is_extra_document_file_path(file_path)
}

pub fn strip_known_extension(file_name: &str) -> String {
    let ext = extension(file_name);
    let known = [".md", ".mdx", ".markdown", ".txt"]
        .into_iter()
        .chain(EXTRA_DOCUMENT_EXTENSIONS.iter().copied())
        .any(|known| known == ext);
    if !known {
        return file_name.to_string();
    }
    file_name
        .strip_suffix(&ext)
        .unwrap_or(file_name)
        .to_string()
}

pub fn file_type_label(file_path: &str) -> String {
    match extension(file_path).trim_start_matches('.') {
        "doc" | "docx" => "Word".into(),
        "pdf" => "PDF".into(),
        "html" => "HTML".into(),
        "xls" | "xlsx" | "xlm" => "Excel".into(),
        "pptx" => "PowerPoint".into(),
        "odt" => "OpenDocument Text".into(),
        "odp" => "OpenDocument Presentation".into(),
        "ods" => "OpenDocument Spreadsheet".into(),
        "rtf" => "Rich Text".into(),
        other => other.to_ascii_uppercase(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supports_markdown_and_txt_without_document_conversion() {
        assert!(is_supported_file_path("README.md", false));
        assert!(is_supported_file_path("page.mdx", false));
        assert!(is_supported_file_path("notes.markdown", false));
        assert!(is_supported_file_path("notes.txt", false));
        assert!(!is_supported_file_path("report.docx", false));
    }

    #[test]
    fn supports_extra_documents_only_when_enabled() {
        assert!(is_supported_file_path("report.docx", true));
        assert!(is_supported_file_path("slides.pptx", true));
        assert!(!is_supported_file_path("image.png", true));
    }

    #[test]
    fn strips_known_extensions_only() {
        assert_eq!(strip_known_extension("guide.md"), "guide");
        assert_eq!(strip_known_extension("report.docx"), "report");
        assert_eq!(strip_known_extension("unknown.xyz"), "unknown.xyz");
    }

    #[test]
    fn extension_returns_lowercase_dot_prefixed() {
        assert_eq!(extension("file.MD"), ".md");
        assert_eq!(extension("FILE.TXT"), ".txt");
        assert_eq!(extension("noext"), "");
        assert_eq!(extension("path/to/file.dOCX"), ".docx");
    }

    #[test]
    fn is_markdown_file_path_variants() {
        assert!(is_markdown_file_path("readme.md"));
        assert!(is_markdown_file_path("page.MDX"));
        assert!(is_markdown_file_path("notes.markdown"));
        assert!(!is_markdown_file_path("readme.txt"));
        assert!(!is_markdown_file_path("readme.docx"));
        assert!(!is_markdown_file_path("noext"));
    }

    #[test]
    fn is_extra_document_file_path_all_types() {
        assert!(is_extra_document_file_path("file.doc"));
        assert!(is_extra_document_file_path("file.docx"));
        assert!(is_extra_document_file_path("file.pdf"));
        assert!(is_extra_document_file_path("file.html"));
        assert!(is_extra_document_file_path("file.xls"));
        assert!(is_extra_document_file_path("file.xlsx"));
        assert!(is_extra_document_file_path("file.xlm"));
        assert!(is_extra_document_file_path("file.pptx"));
        assert!(is_extra_document_file_path("file.odt"));
        assert!(is_extra_document_file_path("file.odp"));
        assert!(is_extra_document_file_path("file.ods"));
        assert!(is_extra_document_file_path("file.rtf"));
        assert!(!is_extra_document_file_path("file.md"));
        assert!(!is_extra_document_file_path("file.png"));
    }

    #[test]
    fn strip_known_extension_all_known() {
        assert_eq!(strip_known_extension("f.md"), "f");
        assert_eq!(strip_known_extension("f.mdx"), "f");
        assert_eq!(strip_known_extension("f.markdown"), "f");
        assert_eq!(strip_known_extension("f.txt"), "f");
        assert_eq!(strip_known_extension("f.docx"), "f");
        assert_eq!(strip_known_extension("f.pdf"), "f");
        assert_eq!(strip_known_extension("f.html"), "f");
        assert_eq!(strip_known_extension("f.rtf"), "f");
        assert_eq!(strip_known_extension("f.ods"), "f");
    }

    #[test]
    fn strip_unknown_extension_returns_original() {
        assert_eq!(strip_known_extension("file.xyz"), "file.xyz");
        assert_eq!(strip_known_extension("file"), "file");
    }

    #[test]
    fn file_type_label_known_types() {
        assert_eq!(file_type_label("file.doc"), "Word");
        assert_eq!(file_type_label("file.docx"), "Word");
        assert_eq!(file_type_label("file.pdf"), "PDF");
        assert_eq!(file_type_label("file.html"), "HTML");
        assert_eq!(file_type_label("file.xls"), "Excel");
        assert_eq!(file_type_label("file.xlsx"), "Excel");
        assert_eq!(file_type_label("file.xlm"), "Excel");
        assert_eq!(file_type_label("file.pptx"), "PowerPoint");
        assert_eq!(file_type_label("file.odt"), "OpenDocument Text");
        assert_eq!(file_type_label("file.odp"), "OpenDocument Presentation");
        assert_eq!(file_type_label("file.ods"), "OpenDocument Spreadsheet");
        assert_eq!(file_type_label("file.rtf"), "Rich Text");
    }

    #[test]
    fn file_type_label_unknown_returns_uppercase() {
        assert_eq!(file_type_label("file.md"), "MD");
        assert_eq!(file_type_label("file.txt"), "TXT");
        assert_eq!(file_type_label("file.xyz"), "XYZ");
        assert_eq!(file_type_label("noext"), "");
    }

    #[test]
    fn is_supported_file_path_more_cases() {
        assert!(is_supported_file_path("f.md", false));
        assert!(is_supported_file_path("f.txt", false));
        assert!(!is_supported_file_path("f.docx", false));
        assert!(is_supported_file_path("f.docx", true));
        assert!(!is_supported_file_path("f.png", true));
        assert!(!is_supported_file_path("noext", false));
        assert!(!is_supported_file_path("noext", true));
    }
}