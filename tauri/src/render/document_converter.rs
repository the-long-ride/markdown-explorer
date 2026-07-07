use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DocumentKind {
    Markdown,
    Text,
    Convertible,
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPreviewInfo {
    pub kind: String,
    pub source_extension: String,
    pub source_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_cache: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality_warning: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ReadMarkdownResult {
    pub markdown: String,
    pub preview_info: Option<DocumentPreviewInfo>,
}

#[derive(Clone)]
struct CacheEntry {
    mtime_ms: u128,
    size: u64,
    markdown: String,
    duration_ms: u64,
}

#[derive(Clone)]
pub struct DocumentConverter {
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
}

fn get_extension(file_path: &str) -> String {
    Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default()
}

fn get_file_type_label(file_path: &str) -> String {
    let ext = get_extension(file_path);
    ext.strip_prefix('.')
        .unwrap_or(&ext)
        .to_uppercase()
}

fn strip_known_extension(file_name: &str) -> String {
    match file_name.rfind('.') {
        Some(idx) => file_name[..idx].to_string(),
        None => file_name.to_string(),
    }
}

fn normalize_preview_markdown(markdown: &str, file_path: &str) -> String {
    let trimmed = markdown.trim();
    if trimmed.is_empty() {
        let title = strip_known_extension(
            Path::new(file_path).file_name().map(|n| n.to_string_lossy().to_string()).as_deref().unwrap_or(file_path),
        )
        .replace('\n', " ")
        .replace('\r', " ")
        .trim()
        .to_string();
        return format!("# {title}\n\n_No readable content was found while preparing this preview._");
    }
    if trimmed.lines().any(|l| l.starts_with('#')) {
        trimmed.to_string()
    } else {
        let title = strip_known_extension(
            Path::new(file_path).file_name().map(|n| n.to_string_lossy().to_string()).as_deref().unwrap_or(file_path),
        )
        .replace('\n', " ")
        .replace('\r', " ")
        .trim()
        .to_string();
        format!("# {title}\n\n{trimmed}")
    }
}

impl DocumentConverter {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn classify_extension(&self, ext: &str) -> DocumentKind {
        match ext {
            ".md" | ".mdx" => DocumentKind::Markdown,
            ".txt" => DocumentKind::Text,
            ".doc" | ".docx" | ".pdf" | ".html" | ".xls" | ".xlsx" | ".xlm"
            | ".pptx" | ".odt" | ".odp" | ".ods" | ".rtf" => DocumentKind::Convertible,
            _ => DocumentKind::Unsupported,
        }
    }

    pub fn create_failure_markdown(&self, file_path: &str, error: &str) -> String {
        let file_name = Path::new(file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| file_path.to_string());
        let title = strip_known_extension(&file_name)
            .replace('\n', " ")
            .replace('\r', " ")
            .trim()
            .to_string();
        let label = get_file_type_label(file_path);
        format!(
            "# {title}\n\nMarkdown Explorer could not convert this {label} file.\n\n```text\n{error}\n```\n"
        )
    }

    pub fn read_markdown(
        &self,
        file_path: &str,
        sidecar_available: bool,
    ) -> ReadMarkdownResult {
        let ext = get_extension(file_path);
        let kind = self.classify_extension(&ext);

        match kind {
            DocumentKind::Markdown => {
                let markdown = fs::read_to_string(file_path).unwrap_or_else(|err| {
                    self.create_failure_markdown(file_path, &err.to_string())
                });
                ReadMarkdownResult {
                    markdown,
                    preview_info: None,
                }
            }
            DocumentKind::Text => {
                let raw = fs::read_to_string(file_path).unwrap_or_else(|err| {
                    self.create_failure_markdown(file_path, &err.to_string())
                });
                let markdown = normalize_preview_markdown(&raw, file_path);
                ReadMarkdownResult {
                    markdown,
                    preview_info: Some(DocumentPreviewInfo {
                        kind: "text".to_string(),
                        source_extension: ext,
                        source_label: get_file_type_label(file_path),
                        duration_ms: None,
                        from_cache: None,
                        quality_warning: None,
                    }),
                }
            }
            DocumentKind::Convertible => {
                let path_buf = Path::new(file_path);
                let metadata = match fs::metadata(path_buf) {
                    Ok(m) => m,
                    Err(err) => {
                        let markdown = self.create_failure_markdown(file_path, &err.to_string());
                        return ReadMarkdownResult {
                            markdown,
                            preview_info: Some(DocumentPreviewInfo {
                                kind: "converted".to_string(),
                                source_extension: ext.clone(),
                                source_label: get_file_type_label(file_path),
                                duration_ms: None,
                                from_cache: None,
                                quality_warning: Some(
                                    "Markdown Explorer could not convert this file. The details are shown below."
                                        .to_string(),
                                ),
                            }),
                        };
                    }
                };

                let mtime_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis())
                    .unwrap_or(0);
                let size = metadata.len();

                {
                    let cache = self.cache.lock();
                    if let Some(entry) = cache.get(file_path) {
                        if entry.mtime_ms == mtime_ms && entry.size == size {
                            return ReadMarkdownResult {
                                markdown: entry.markdown.clone(),
                                preview_info: Some(DocumentPreviewInfo {
                                    kind: "converted".to_string(),
                                    source_extension: ext.clone(),
                                    source_label: get_file_type_label(file_path),
                                    duration_ms: Some(entry.duration_ms),
                                    from_cache: Some(true),
                                    quality_warning: Some(
                                        "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file."
                                            .to_string(),
                                    ),
                                }),
                            };
                        }
                    }
                }

                if sidecar_available {
                    let started = std::time::Instant::now();
                    match crate::render::sidecar::convert_file(file_path) {
                        Ok(converted) => {
                            let duration_ms = started.elapsed().as_millis() as u64;
                            let markdown = normalize_preview_markdown(&converted, file_path);
                            {
                                let mut cache = self.cache.lock();
                                cache.insert(
                                    file_path.to_string(),
                                    CacheEntry { mtime_ms, size, markdown: markdown.clone(), duration_ms },
                                );
                            }
                            ReadMarkdownResult {
                                markdown,
                                preview_info: Some(DocumentPreviewInfo {
                                    kind: "converted".to_string(),
                                    source_extension: ext,
                                    source_label: get_file_type_label(file_path),
                                    duration_ms: Some(duration_ms),
                                    from_cache: Some(false),
                                    quality_warning: Some(
                                        "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file."
                                            .to_string(),
                                    ),
                                }),
                            }
                        }
                        Err(err) => {
                            let markdown = self.create_failure_markdown(file_path, &err);
                            ReadMarkdownResult {
                                markdown,
                                preview_info: Some(DocumentPreviewInfo {
                                    kind: "converted".to_string(),
                                    source_extension: ext,
                                    source_label: get_file_type_label(file_path),
                                    duration_ms: None,
                                    from_cache: None,
                                    quality_warning: Some(
                                        "Markdown Explorer could not convert this file. The details are shown below."
                                            .to_string(),
                                    ),
                                }),
                            }
                        }
                    }
                } else {
                    let markdown = self.create_failure_markdown(
                        file_path,
                        "Document conversion sidecar is not available.",
                    );
                    ReadMarkdownResult {
                        markdown,
                        preview_info: Some(DocumentPreviewInfo {
                            kind: "converted".to_string(),
                            source_extension: ext,
                            source_label: get_file_type_label(file_path),
                            duration_ms: None,
                            from_cache: None,
                            quality_warning: Some(
                                "Markdown Explorer could not convert this file. The details are shown below."
                                    .to_string(),
                            ),
                        }),
                    }
                }
            }
            DocumentKind::Unsupported => {
                let markdown = self.create_failure_markdown(file_path, "Unsupported file type");
                ReadMarkdownResult {
                    markdown,
                    preview_info: None,
                }
            }
        }
    }
}

impl Default for DocumentConverter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_extension_markdown() {
        let conv = DocumentConverter::new();
        assert_eq!(conv.classify_extension(".md"), DocumentKind::Markdown);
        assert_eq!(conv.classify_extension(".txt"), DocumentKind::Text);
        assert_eq!(conv.classify_extension(".docx"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".xyz"), DocumentKind::Unsupported);
    }

    #[test]
    fn normalize_empty_content_adds_title() {
        let result = normalize_preview_markdown("  \n ", "/ws/report.txt");
        assert!(result.starts_with("# report"));
        assert!(result.contains("No readable content"));
    }

    #[test]
    fn normalize_preserves_existing_heading() {
        let result = normalize_preview_markdown("# My Title\n\nContent", "/ws/file.txt");
        assert!(result.starts_with("# My Title"));
    }

    #[test]
    fn read_markdown_passthrough() {
        let conv = DocumentConverter::new();
        let dir = std::env::temp_dir();
        let file = dir.join("test_md.md");
        fs::write(&file, "# Hello").unwrap();
        let result = conv.read_markdown(&file.to_string_lossy(), false);
        assert_eq!(result.markdown, "# Hello");
        assert!(result.preview_info.is_none());
    }

    #[test]
    fn read_text_file_adds_heading() {
        let conv = DocumentConverter::new();
        let dir = std::env::temp_dir();
        let file = dir.join("test_txt.txt");
        fs::write(&file, "just plain text").unwrap();
        let result = conv.read_markdown(&file.to_string_lossy(), false);
        assert!(result.markdown.starts_with("# test_txt"));
        assert!(result.markdown.contains("just plain text"));
        assert!(result.preview_info.is_some());
        let info = result.preview_info.unwrap();
        assert_eq!(info.kind, "text");
        assert_eq!(info.source_extension, ".txt");
    }

    #[test]
    fn read_markdown_file_not_found_returns_failure() {
        let conv = DocumentConverter::new();
        let result = conv.read_markdown("/nonexistent/file.md", false);
        assert!(result.markdown.contains("could not convert"));
        assert!(result.preview_info.is_none());
    }

    #[test]
    fn read_unsupported_file_type() {
        let conv = DocumentConverter::new();
        let dir = std::env::temp_dir();
        let file = dir.join("test_unsupported.xyz");
        fs::write(&file, "data").unwrap();
        let result = conv.read_markdown(&file.to_string_lossy(), false);
        assert!(result.markdown.contains("Unsupported file type"));
        assert!(result.preview_info.is_none());
    }

    #[test]
    fn read_convertible_no_sidecar_returns_failure() {
        let conv = DocumentConverter::new();
        let dir = std::env::temp_dir();
        let file = dir.join("test_doc.docx");
        fs::write(&file, "fake doc").unwrap();
        let result = conv.read_markdown(&file.to_string_lossy(), false);
        assert!(result.markdown.contains("sidecar is not available"));
        assert!(result.preview_info.is_some());
        let info = result.preview_info.unwrap();
        assert_eq!(info.kind, "converted");
        assert_eq!(info.source_extension, ".docx");
    }

    #[test]
    fn read_convertible_file_not_found_returns_failure() {
        let conv = DocumentConverter::new();
        let result = conv.read_markdown("/nonexistent/file.docx", false);
        assert!(result.markdown.contains("could not convert"));
        assert!(result.preview_info.is_some());
    }

    #[test]
    fn create_failure_markdown_contains_error() {
        let conv = DocumentConverter::new();
        let md = conv.create_failure_markdown("/ws/report.docx", "conversion failed");
        assert!(md.contains("# report"));
        assert!(md.contains("DOCX"));
        assert!(md.contains("conversion failed"));
    }

    #[test]
    fn normalize_adds_heading_for_no_heading_content() {
        let result = normalize_preview_markdown("some content", "/ws/notes.txt");
        assert!(result.starts_with("# notes"));
        assert!(result.contains("some content"));
    }

    #[test]
    fn normalize_strips_newlines_from_title() {
        let result = normalize_preview_markdown("", "/ws/file\nname.txt");
        assert!(!result.contains("file\nname"));
    }

    #[test]
    fn get_extension_lowercase() {
        assert_eq!(get_extension("file.MD"), ".md");
        assert_eq!(get_extension("file.TXT"), ".txt");
        assert_eq!(get_extension("file"), "");
    }

    #[test]
    fn get_file_type_label_uppercase() {
        assert_eq!(get_file_type_label("file.docx"), "DOCX");
        assert_eq!(get_file_type_label("file.pdf"), "PDF");
    }

    #[test]
    fn strip_known_extension_works() {
        assert_eq!(strip_known_extension("report.docx"), "report");
        assert_eq!(strip_known_extension("noext"), "noext");
        assert_eq!(strip_known_extension("a.b.c"), "a.b");
    }

    #[test]
    fn default_equals_new() {
        let a = DocumentConverter::new();
        let b = DocumentConverter::default();
        // Both should classify the same way
        assert_eq!(a.classify_extension(".md"), b.classify_extension(".md"));
    }

    #[test]
    fn document_preview_info_serialization() {
        let info = DocumentPreviewInfo {
            kind: "text".to_string(),
            source_extension: ".txt".to_string(),
            source_label: "TXT".to_string(),
            duration_ms: Some(100),
            from_cache: Some(false),
            quality_warning: None,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"sourceExtension\""));
        assert!(json.contains("\"sourceLabel\""));
        assert!(!json.contains("\"qualityWarning\""));
    }

    #[test]
    fn classify_all_extensions() {
        let conv = DocumentConverter::new();
        assert_eq!(conv.classify_extension(".md"), DocumentKind::Markdown);
        assert_eq!(conv.classify_extension(".mdx"), DocumentKind::Markdown);
        assert_eq!(conv.classify_extension(".txt"), DocumentKind::Text);
        assert_eq!(conv.classify_extension(".doc"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".docx"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".pdf"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".html"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".xls"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".xlsx"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".pptx"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".odt"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".rtf"), DocumentKind::Convertible);
        assert_eq!(conv.classify_extension(".xyz"), DocumentKind::Unsupported);
        assert_eq!(conv.classify_extension(""), DocumentKind::Unsupported);
    }

    #[test]
    fn read_text_file_not_found_returns_failure() {
        let conv = DocumentConverter::new();
        let result = conv.read_markdown("/nonexistent/file.txt", false);
        assert!(result.markdown.contains("could not convert"));
        assert!(result.preview_info.is_some());
    }
}