use markdown_explorer_tauri_lib::render::native_document_converter::{
    convert_file, ConversionError, ConversionQuality,
};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use zip::{write::SimpleFileOptions, ZipWriter};

fn archive(path: &Path, files: &[(&str, &str)]) {
    let mut zip = ZipWriter::new(File::create(path).unwrap());
    for (name, content) in files {
        zip.start_file(*name, SimpleFileOptions::default()).unwrap();
        zip.write_all(content.as_bytes()).unwrap();
    }
    zip.finish().unwrap();
}

#[test]
fn converts_open_document_text_presentation_and_spreadsheet_archives() {
    let temp = tempfile::tempdir().unwrap();
    for (ext, body, expected) in [
        ("odt", "<office:text><text:p>Document content</text:p></office:text>", "Document content"),
        ("odp", "<office:presentation><draw:page><text:p>Slide content</text:p></draw:page></office:presentation>", "Slide content"),
        ("ods", r#"<office:spreadsheet><table:table table:name="Empty"></table:table><table:table table:name="Costs"><table:table-row><table:table-cell office:value-type="string"><text:p>Budget</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="float" office:value="42"/></table:table-row></table:table><table:table table:name="Totals"><table:table-row><table:table-cell office:value-type="string"><text:p>Total</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>"#, "| Budget |\n| --- |\n| 42 |"),
    ] {
        let path = temp.path().join(format!("example.{ext}"));
        let content = format!(
            r#"<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"><office:body>{body}</office:body></office:document-content>"#
        );
        if ext == "ods" {
            archive(
                &path,
                &[
                    ("mimetype", "application/vnd.oasis.opendocument.spreadsheet"),
                    (
                        "META-INF/manifest.xml",
                        r#"<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>"#,
                    ),
                    ("content.xml", &content),
                ],
            );
        } else {
            archive(&path, &[("content.xml", &content)]);
        }
        let result = convert_file(&path).unwrap_or_else(|err| panic!("{ext}: {err}"));
        assert_eq!(result.quality, ConversionQuality::Standard);
        assert!(result.markdown.contains(expected), "{ext}: {:?}", result.markdown);
        if ext == "ods" {
            assert!(result.markdown.contains("## Costs"));
            assert!(result.markdown.contains("## Totals"));
            assert!(!result.markdown.contains("## Empty"));
        }
    }
}

#[test]
fn converts_html_rtf_and_pdf_through_the_file_dispatcher() {
    let temp = tempfile::tempdir().unwrap();
    for (ext, source) in [
        ("html", "<h1>Sample heading</h1><script>hidden()</script>"),
        ("rtf", r"{\rtf1\ansi Sample heading\par}"),
    ] {
        let path = temp.path().join(format!("example.{ext}"));
        fs::write(&path, source).unwrap();
        let result = convert_file(&path).unwrap();
        assert_eq!(result.quality, ConversionQuality::Standard);
        assert!(result.markdown.contains("Sample heading"));
        assert!(!result.markdown.contains("hidden"));
    }

    let path = temp.path().join("example.pdf");
    let stream = "BT /F1 12 Tf 20 100 Td (Sample heading) Tj ET";
    let page_stream = format!(
        "<< /Length {} >>\nstream\n{}\nendstream",
        stream.len(),
        stream
    );
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        &page_stream,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let mut file = b"%PDF-1.4\n".to_vec();
    let mut xref = String::from("xref\n0 6\n0000000000 65535 f \n");
    for (index, content) in objects.iter().enumerate() {
        use std::fmt::Write as _;
        writeln!(&mut xref, "{:010} 00000 n ", file.len()).unwrap();
        writeln!(&mut file, "{} 0 obj\n{}\nendobj", index + 1, content).unwrap();
    }
    let start = file.len();
    writeln!(
        &mut file,
        "{xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF"
    )
    .unwrap();
    fs::write(&path, file).unwrap();
    assert_eq!(convert_file(&path).unwrap().markdown, "Sample heading");
}

#[test]
fn invalid_container_and_missing_xml_return_typed_errors() {
    let temp = tempfile::tempdir().unwrap();
    for extension in ["odt", "ods", "odp", "pptx", "pdf", "docx", "xls", "xlm"] {
        let path = temp.path().join(format!("broken.{extension}"));
        fs::write(&path, b"not a document").unwrap();
        assert!(
            matches!(convert_file(&path), Err(ConversionError::Parse(_))),
            "{extension}"
        );
    }
    for extension in ["odt", "pptx"] {
        let path = temp.path().join(format!("missing.{extension}"));
        archive(&path, &[("unrelated.xml", "<ignored/>")]);
        assert!(
            matches!(convert_file(&path), Err(ConversionError::Parse(_))),
            "{extension}"
        );
    }
}
