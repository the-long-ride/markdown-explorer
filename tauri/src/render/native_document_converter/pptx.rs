use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use quick_xml::events::{BytesRef, BytesStart, Event};
use quick_xml::{Reader, XmlVersion};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use zip::ZipArchive;

const MAX_XML_MEMBER_BYTES: u64 = 32 * 1024 * 1024;
const PRESENTATION_MEMBER: &str = "ppt/presentation.xml";
const PRESENTATION_RELS_MEMBER: &str = "ppt/_rels/presentation.xml.rels";

pub fn convert(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    if archive
        .has_overlapping_files()
        .map_err(|error| ConversionError::Parse(error.to_string()))?
    {
        return Err(ConversionError::Parse(
            "overlapping ZIP members are not allowed".to_string(),
        ));
    }

    let presentation = read_member(&mut archive, PRESENTATION_MEMBER)?;
    let relationships = read_member(&mut archive, PRESENTATION_RELS_MEMBER)?;
    let slide_ids = parse_slide_relationship_ids(&presentation)?;
    let slide_targets = parse_slide_relationships(&relationships)?;
    let mut markdown = String::new();

    for (index, relationship_id) in slide_ids.iter().enumerate() {
        let target = slide_targets.get(relationship_id).ok_or_else(|| {
            ConversionError::Parse(format!(
                "presentation relationship {relationship_id} does not point to a slide"
            ))
        })?;
        let member = resolve_slide_member(target)?;
        let slide_xml = read_member(&mut archive, &member)?;
        let slide_markdown = parse_slide_xml(&slide_xml)?;
        if !markdown.is_empty() {
            markdown.push_str("\n\n");
        }
        markdown.push_str(&format!("## Slide {}", index + 1));
        if !slide_markdown.is_empty() {
            markdown.push_str("\n\n");
            markdown.push_str(&slide_markdown);
        }
    }

    Ok(ConversionOutput {
        markdown: normalize(&markdown),
        quality: ConversionQuality::Standard,
    })
}

fn read_member(
    archive: &mut ZipArchive<BufReader<File>>,
    member: &str,
) -> Result<Vec<u8>, ConversionError> {
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

fn relationship_id(reader: &Reader<&[u8]>, start: &BytesStart<'_>) -> Option<String> {
    start.attributes().flatten().find_map(|attribute| {
        let key = attribute.key.as_ref();
        if key.contains(&b':') && local_name(key) == b"id" {
            attribute
                .decoded_and_normalized_value(XmlVersion::Implicit1_0, reader.decoder())
                .ok()
                .map(|value| value.into_owned())
        } else {
            None
        }
    })
}

fn parse_slide_relationship_ids(xml: &[u8]) -> Result<Vec<String>, ConversionError> {
    let mut reader = Reader::from_reader(xml);
    reader.config_mut().check_end_names = true;
    let mut ids = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(start) | Event::Empty(start))
                if local_name(start.name().as_ref()) == b"sldId" =>
            {
                if let Some(id) = relationship_id(&reader, &start) {
                    ids.push(id);
                }
            }
            Ok(Event::Eof) => return Ok(ids),
            Ok(_) => {}
            Err(error) => return Err(ConversionError::Parse(error.to_string())),
        }
    }
}

fn parse_slide_relationships(xml: &[u8]) -> Result<HashMap<String, String>, ConversionError> {
    let mut reader = Reader::from_reader(xml);
    reader.config_mut().check_end_names = true;
    let mut relationships = HashMap::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(start) | Event::Empty(start))
                if local_name(start.name().as_ref()) == b"Relationship" =>
            {
                let relationship_type = attribute_value(&reader, &start, b"Type");
                let target_mode = attribute_value(&reader, &start, b"TargetMode");
                if relationship_type.as_deref().is_some_and(|value| value.ends_with("/slide"))
                    && target_mode.as_deref() != Some("External")
                {
                    if let (Some(id), Some(target)) = (
                        attribute_value(&reader, &start, b"Id"),
                        attribute_value(&reader, &start, b"Target"),
                    ) {
                        relationships.insert(id, target);
                    }
                }
            }
            Ok(Event::Eof) => return Ok(relationships),
            Ok(_) => {}
            Err(error) => return Err(ConversionError::Parse(error.to_string())),
        }
    }
}

fn resolve_slide_member(target: &str) -> Result<String, ConversionError> {
    let normalized = target.replace('\\', "/");
    let path = normalized.trim_start_matches('/');
    let candidate = if path.starts_with("ppt/") {
        path.to_string()
    } else {
        format!("ppt/{path}")
    };
    let mut components = Vec::new();

    for component in candidate.split('/') {
        match component {
            "" | "." => {}
            ".." => {
                if components.pop().is_none() {
                    return Err(ConversionError::Parse(format!(
                        "slide target escapes the presentation archive: {target}"
                    )));
                }
            }
            value => components.push(value),
        }
    }

    let member = components.join("/");
    if !member.starts_with("ppt/slides/") {
        return Err(ConversionError::Parse(format!(
            "unsupported slide target: {target}"
        )));
    }
    Ok(member)
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

fn finish_paragraph(paragraphs: &mut Vec<String>, paragraph: &mut String) {
    let value = paragraph.trim();
    if !value.is_empty() {
        paragraphs.push(value.to_string());
    }
    paragraph.clear();
}

fn parse_slide_xml(xml: &[u8]) -> Result<String, ConversionError> {
    let mut reader = Reader::from_reader(xml);
    reader.config_mut().trim_text(false);
    reader.config_mut().check_end_names = true;
    let mut paragraphs = Vec::new();
    let mut paragraph = String::new();
    let mut in_paragraph = false;
    let mut in_text = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) => match local_name(start.name().as_ref()) {
                b"p" => {
                    if in_paragraph {
                        finish_paragraph(&mut paragraphs, &mut paragraph);
                    }
                    in_paragraph = true;
                }
                b"t" if in_paragraph => in_text = true,
                _ => {}
            },
            Ok(Event::Empty(empty)) if in_paragraph => match local_name(empty.name().as_ref()) {
                b"br" => paragraph.push_str("  \n"),
                b"tab" => paragraph.push('\t'),
                _ => {}
            },
            Ok(Event::Text(text)) if in_text => {
                let decoded = text
                    .decode()
                    .map_err(|error| ConversionError::Parse(error.to_string()))?;
                paragraph.push_str(decoded.as_ref());
            }
            Ok(Event::CData(text)) if in_text => {
                let decoded = text
                    .decode()
                    .map_err(|error| ConversionError::Parse(error.to_string()))?;
                paragraph.push_str(decoded.as_ref());
            }
            Ok(Event::GeneralRef(reference)) if in_text => {
                paragraph.push_str(&resolve_reference(&reference)?);
            }
            Ok(Event::End(end)) => match local_name(end.name().as_ref()) {
                b"t" => in_text = false,
                b"p" if in_paragraph => {
                    finish_paragraph(&mut paragraphs, &mut paragraph);
                    in_paragraph = false;
                    in_text = false;
                }
                _ => {}
            },
            Ok(Event::Eof) => {
                if in_paragraph {
                    finish_paragraph(&mut paragraphs, &mut paragraph);
                }
                return Ok(paragraphs.join("\n\n"));
            }
            Ok(_) => {}
            Err(error) => return Err(ConversionError::Parse(error.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_entities_and_line_breaks_from_slide_xml() {
        let xml = br#"<p:sld xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>Alpha &amp; beta</a:t></a:r><a:br/><a:r><a:t>Second line</a:t></a:r></a:p></p:sld>"#;
        assert_eq!(parse_slide_xml(xml).unwrap(), "Alpha & beta  \nSecond line");
    }

    #[test]
    fn converts_real_pptx_fixture_in_presentation_order() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join("sample-presentation.pptx");
        let output = convert(&path).expect("convert PPTX fixture");
        assert_eq!(output.quality, ConversionQuality::Standard);
        assert!(output.markdown.contains("Alpha & beta"), "{:?}", output.markdown);
        assert!(!output.markdown.contains("&amp;"));
        assert!(output.markdown.contains("Second line"));
        assert!(
            output.markdown.find("Second slide title").unwrap()
                < output.markdown.find("First slide title").unwrap(),
            "presentation order was not preserved: {:?}",
            output.markdown
        );
    }

    #[test]
    fn rejects_slide_targets_outside_the_slides_directory() {
        assert!(resolve_slide_member("../media/image1.png").is_err());
    }
}
