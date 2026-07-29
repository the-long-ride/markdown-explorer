use super::{
    markdown::normalize, spreadsheet::markdown_table, ConversionError, ConversionOutput,
    ConversionQuality,
};
use quick_xml::events::{BytesRef, BytesStart, Event};
use quick_xml::{Reader, XmlVersion};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use zip::ZipArchive;

const MAX_XML_MEMBER_BYTES: u64 = 32 * 1024 * 1024;

pub fn convert_odt(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let xml = read_zip_member(path, "content.xml")?;
    Ok(ConversionOutput {
        markdown: parse_content_xml(&xml, OdfKind::Text)?,
        quality: ConversionQuality::Standard,
    })
}

pub fn convert_odp(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let xml = read_zip_member(path, "content.xml")?;
    Ok(ConversionOutput {
        markdown: parse_content_xml(&xml, OdfKind::Presentation)?,
        quality: ConversionQuality::Standard,
    })
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum OdfKind {
    Text,
    Presentation,
}

fn read_zip_member(path: &Path, member: &str) -> Result<Vec<u8>, ConversionError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    if archive
        .has_overlapping_files()
        .map_err(|error| ConversionError::Parse(error.to_string()))?
    {
        return Err(ConversionError::Parse("overlapping ZIP members are not allowed".to_string()));
    }
    let mut entry = archive
        .by_name(member)
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    if entry.size() > MAX_XML_MEMBER_BYTES {
        return Err(ConversionError::TooLarge {
            member: member.to_string(),
            bytes: entry.size(),
        });
    }
    let mut output = Vec::with_capacity(entry.size() as usize);
    entry
        .by_ref()
        .take(MAX_XML_MEMBER_BYTES + 1)
        .read_to_end(&mut output)?;
    if output.len() as u64 > MAX_XML_MEMBER_BYTES {
        return Err(ConversionError::TooLarge {
            member: member.to_string(),
            bytes: output.len() as u64,
        });
    }
    Ok(output)
}

fn local_name(name: &[u8]) -> &[u8] {
    name.rsplit(|byte| *byte == b':').next().unwrap_or(name)
}

fn attribute_value(reader: &Reader<&[u8]>, start: &BytesStart<'_>, key: &[u8]) -> Option<String> {
    start.attributes().flatten().find_map(|attribute| {
        if local_name(attribute.key.as_ref()) == key {
            attribute
                .decoded_and_normalized_value(XmlVersion::Implicit1_0, reader.decoder())
                .ok()
                .map(|value| value.into_owned())
        } else {
            None
        }
    })
}

fn append_text(in_cell: bool, table_cell: &mut String, block: &mut String, text: &str) {
    if in_cell {
        table_cell.push_str(text);
    } else {
        block.push_str(text);
    }
}

fn resolve_reference(reference: &BytesRef<'_>) -> Result<String, ConversionError> {
    if let Some(character) = reference
        .resolve_char_ref()
        .map_err(|error| ConversionError::Parse(error.to_string()))?
    {
        return Ok(character.to_string());
    }

    let name = reference
        .decode()
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    match name.as_ref() {
        "amp" => Ok("&".to_string()),
        "apos" => Ok("'".to_string()),
        "gt" => Ok(">".to_string()),
        "lt" => Ok("<".to_string()),
        "quot" => Ok("\"".to_string()),
        other => Err(ConversionError::Parse(format!(
            "unsupported XML entity reference: &{other};"
        ))),
    }
}

fn parse_content_xml(xml: &[u8], kind: OdfKind) -> Result<String, ConversionError> {
    let mut reader = Reader::from_reader(xml);
    reader.config_mut().trim_text(false);
    reader.config_mut().check_end_names = true;
    let mut output = String::new();
    let mut block = String::new();
    let mut heading_level = None::<usize>;
    let mut list_depth = 0usize;
    let mut list_item_depth = 0usize;
    let mut link_target = None::<String>;
    let mut slide_number = 0usize;
    let mut in_table = false;
    let mut in_cell = false;
    let mut table_rows = Vec::<Vec<String>>::new();
    let mut table_row = Vec::<String>::new();
    let mut table_cell = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) => match local_name(start.name().as_ref()) {
                b"page" if kind == OdfKind::Presentation => {
                    slide_number += 1;
                    if !output.is_empty() {
                        output.push_str("\n\n");
                    }
                    output.push_str(&format!("## Slide {slide_number}\n\n"));
                }
                b"h" => {
                    heading_level = attribute_value(&reader, &start, b"outline-level")
                        .and_then(|value| value.parse::<usize>().ok())
                        .map(|level| level.clamp(1, 6));
                    block.clear();
                }
                b"p" => block.clear(),
                b"list" => list_depth += 1,
                b"list-item" => {
                    list_item_depth += 1;
                    block.clear();
                }
                b"a" => {
                    link_target = attribute_value(&reader, &start, b"href");
                    append_text(in_cell, &mut table_cell, &mut block, "[");
                }
                b"table" => {
                    in_table = true;
                    table_rows.clear();
                }
                b"table-row" if in_table => table_row.clear(),
                b"table-cell" if in_table => {
                    in_cell = true;
                    table_cell.clear();
                }
                _ => {}
            },
            Ok(Event::Empty(empty)) => match local_name(empty.name().as_ref()) {
                b"line-break" => {
                    if in_cell {
                        table_cell.push_str("<br>");
                    } else {
                        block.push_str("  \n");
                    }
                }
                b"tab" => {
                    if in_cell {
                        table_cell.push(' ');
                    } else {
                        block.push(' ');
                    }
                }
                b"s" => {
                    let count = attribute_value(&reader, &empty, b"c")
                        .and_then(|value| value.parse::<usize>().ok())
                        .unwrap_or(1)
                        .min(32);
                    for _ in 0..count {
                        if in_cell {
                            table_cell.push(' ');
                        } else {
                            block.push(' ');
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::Text(text)) => {
                let decoded = text
                    .decode()
                    .map_err(|error| ConversionError::Parse(error.to_string()))?;
                append_text(in_cell, &mut table_cell, &mut block, decoded.as_ref());
            }
            Ok(Event::CData(text)) => {
                let decoded = text
                    .decode()
                    .map_err(|error| ConversionError::Parse(error.to_string()))?;
                append_text(in_cell, &mut table_cell, &mut block, decoded.as_ref());
            }
            Ok(Event::GeneralRef(reference)) => {
                let resolved = resolve_reference(&reference)?;
                append_text(in_cell, &mut table_cell, &mut block, &resolved);
            }
            Ok(Event::End(end)) => match local_name(end.name().as_ref()) {
                b"a" => {
                    let suffix = format!("]({})", link_target.as_deref().unwrap_or(""));
                    append_text(in_cell, &mut table_cell, &mut block, &suffix);
                    link_target = None;
                }
                b"h" => {
                    let content = block.trim();
                    if !content.is_empty() {
                        output.push_str(&"#".repeat(heading_level.unwrap_or(1)));
                        output.push(' ');
                        output.push_str(content);
                        output.push_str("\n\n");
                    }
                    block.clear();
                    heading_level = None;
                }
                b"p" => {
                    if in_cell {
                        if !table_cell.is_empty() && !table_cell.ends_with("<br>") {
                            table_cell.push_str("<br>");
                        }
                    } else {
                        let content = block.trim();
                        if !content.is_empty() {
                            if list_item_depth > 0 {
                                output.push_str(&"  ".repeat(list_depth.saturating_sub(1)));
                                output.push_str("- ");
                            }
                            output.push_str(content);
                            output.push_str(if list_item_depth > 0 { "\n" } else { "\n\n" });
                        }
                    }
                    block.clear();
                }
                b"list-item" => list_item_depth = list_item_depth.saturating_sub(1),
                b"list" => list_depth = list_depth.saturating_sub(1),
                b"table-cell" if in_table => {
                    in_cell = false;
                    let cell = table_cell.trim().trim_end_matches("<br>").to_string();
                    table_row.push(cell);
                    table_cell.clear();
                }
                b"table-row" if in_table => {
                    table_rows.push(std::mem::take(&mut table_row));
                }
                b"table" => {
                    in_table = false;
                    let table = markdown_table(&table_rows);
                    if !table.is_empty() {
                        output.push_str(&table);
                        output.push_str("\n\n");
                    }
                    table_rows.clear();
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(ConversionError::Parse(error.to_string())),
        }
    }

    Ok(normalize(&output))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn odt_xml_keeps_heading_list_link_table_and_entities() {
        let xml = br#"<office:document-content xmlns:office="o" xmlns:text="t" xmlns:table="tb" xmlns:xlink="x"><office:body><office:text><text:h text:outline-level="2">A &amp; B</text:h><text:list><text:list-item><text:p>One</text:p></text:list-item></text:list><text:p><text:a xlink:href="https://example.com">Link</text:a></text:p><table:table><table:table-row><table:table-cell><text:p>Name</text:p></table:table-cell><table:table-cell><text:p>Value</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>A|B</text:p></table:table-cell><table:table-cell><text:p>2</text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>"#;
        let markdown = parse_content_xml(xml, OdfKind::Text).unwrap();
        assert!(markdown.contains("## A & B"));
        assert!(markdown.contains("- One"));
        assert!(markdown.contains("[Link](https://example.com)"));
        assert!(markdown.contains("A\\|B"));
    }

    #[test]
    fn odf_xml_keeps_character_references_cdata_and_table_links() {
        let xml = br#"<office:document-content xmlns:office="o" xmlns:text="t" xmlns:table="tb" xmlns:xlink="x"><office:body><office:text><text:p><![CDATA[A < B]]> &#x26; C</text:p><table:table><table:table-row><table:table-cell><text:p><text:a xlink:href="https://example.com">Cell link</text:a></text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>"#;
        let markdown = parse_content_xml(xml, OdfKind::Text).unwrap();
        assert!(markdown.contains("A < B & C"));
        assert!(markdown.contains("[Cell link](https://example.com)"));
    }

    #[test]
    fn table_cells_keep_paragraph_boundaries_without_trailing_breaks() {
        let xml = br#"<office:document-content xmlns:office="o" xmlns:text="t" xmlns:table="tb"><office:body><office:text><table:table><table:table-row><table:table-cell><text:p>One</text:p><text:p>Two</text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>"#;
        let markdown = parse_content_xml(xml, OdfKind::Text).unwrap();
        assert!(markdown.contains("One<br>Two"));
        assert!(!markdown.contains("Two<br> |"));
    }

    #[test]
    fn nested_odt_lists_keep_outer_list_state() {
        let xml = br#"<office:document-content xmlns:office="o" xmlns:text="t"><office:body><office:text><text:list><text:list-item><text:p>Outer</text:p><text:list><text:list-item><text:p>Inner</text:p></text:list-item></text:list><text:p>Outer again</text:p></text:list-item></text:list></office:text></office:body></office:document-content>"#;
        let markdown = parse_content_xml(xml, OdfKind::Text).unwrap();
        assert!(markdown.contains("- Outer"));
        assert!(markdown.contains("  - Inner"));
        assert!(markdown.contains("- Outer again"));
    }

    #[test]
    fn odp_xml_preserves_page_order_and_line_breaks() {
        let xml = br#"<office:document-content xmlns:office="o" xmlns:draw="d" xmlns:text="t"><office:body><office:presentation><draw:page><text:p>First<text:line-break/>Line</text:p></draw:page><draw:page><text:p>Second</text:p></draw:page></office:presentation></office:body></office:document-content>"#;
        let markdown = parse_content_xml(xml, OdfKind::Presentation).unwrap();
        assert!(markdown.find("## Slide 1").unwrap() < markdown.find("## Slide 2").unwrap());
        assert!(markdown.contains("First  \nLine"));
    }

    #[test]
    fn malformed_xml_returns_error() {
        assert!(parse_content_xml(b"<a></b>", OdfKind::Text).is_err());
    }
}
