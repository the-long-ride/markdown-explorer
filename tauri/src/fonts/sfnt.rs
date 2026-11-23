use super::{expand_italic_axis, ItalicAxis, ParsedFontFace};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

fn u16_be(data: &[u8], offset: usize) -> u16 {
    data.get(offset..offset + 2)
        .map(|slice| u16::from_be_bytes([slice[0], slice[1]]))
        .unwrap_or(0)
}

fn u32_be(data: &[u8], offset: usize) -> u32 {
    data.get(offset..offset + 4)
        .map(|slice| u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]))
        .unwrap_or(0)
}

fn tag(data: &[u8], offset: usize) -> Option<&str> {
    std::str::from_utf8(data.get(offset..offset + 4)?).ok()
}

fn table_map(data: &[u8], face_offset: usize) -> BTreeMap<String, (usize, usize)> {
    let mut result = BTreeMap::new();
    let count = u16_be(data, face_offset + 4) as usize;
    for index in 0..count {
        let record = face_offset + 12 + index * 16;
        let Some(name) = tag(data, record) else {
            continue;
        };
        let offset = u32_be(data, record + 8) as usize;
        let length = u32_be(data, record + 12) as usize;
        if offset
            .checked_add(length)
            .is_some_and(|end| end <= data.len())
        {
            result.insert(name.to_string(), (offset, length));
        }
    }
    result
}

fn decode_name(data: &[u8], record: usize, storage_offset: usize) -> String {
    let platform = u16_be(data, record);
    let length = u16_be(data, record + 8) as usize;
    let string_offset = u16_be(data, record + 10) as usize;
    let Some(start) = storage_offset.checked_add(string_offset) else {
        return String::new();
    };
    let Some(end) = start.checked_add(length) else {
        return String::new();
    };
    let Some(bytes) = data.get(start..end) else {
        return String::new();
    };
    if platform == 0 || platform == 3 {
        if bytes.len() % 2 != 0 {
            return String::new();
        }
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect();
        return String::from_utf16_lossy(&units)
            .trim_matches('\0')
            .trim()
            .to_string();
    }
    String::from_utf8_lossy(bytes)
        .trim_matches('\0')
        .trim()
        .to_string()
}

fn read_names(data: &[u8], table: Option<&(usize, usize)>) -> (String, String) {
    let Some(&(offset, length)) = table else {
        return (String::new(), String::new());
    };
    let count = u16_be(data, offset + 2) as usize;
    let storage_offset = offset + u16_be(data, offset + 4) as usize;
    let mut family: Vec<(i32, String)> = Vec::new();
    let mut typographic_family: Vec<(i32, String)> = Vec::new();
    let mut subfamily: Vec<(i32, String)> = Vec::new();
    let mut typographic_subfamily: Vec<(i32, String)> = Vec::new();
    for index in 0..count {
        let record = offset + 6 + index * 12;
        if record + 12 > offset + length {
            break;
        }
        let name_id = u16_be(data, record + 6);
        let value = decode_name(data, record, storage_offset);
        if value.is_empty() {
            continue;
        }
        let platform = u16_be(data, record);
        let language = u16_be(data, record + 4);
        let score = if platform == 3 {
            10
        } else if platform == 0 {
            8
        } else {
            0
        } + if language == 0x0409 || language == 0 {
            2
        } else {
            0
        };
        match name_id {
            16 => typographic_family.push((score, value)),
            1 => family.push((score, value)),
            17 => typographic_subfamily.push((score, value)),
            2 => subfamily.push((score, value)),
            _ => {}
        }
    }
    let pick = |items: &mut Vec<(i32, String)>| -> String {
        items.sort_by(|a, b| b.0.cmp(&a.0));
        items
            .first()
            .map(|(_, value)| value.clone())
            .unwrap_or_default()
    };
    let typed_family = pick(&mut typographic_family);
    let typed_subfamily = pick(&mut typographic_subfamily);
    (
        if typed_family.is_empty() {
            pick(&mut family)
        } else {
            typed_family
        },
        if typed_subfamily.is_empty() {
            pick(&mut subfamily)
        } else {
            typed_subfamily
        },
    )
}

fn inspect_face(
    data: &[u8],
    face_offset: usize,
    source_path: &Path,
) -> Result<ParsedFontFace, String> {
    let tables = table_map(data, face_offset);
    let (family, subfamily) = read_names(data, tables.get("name"));
    if family.is_empty() {
        return Err(format!(
            "Font family metadata is missing: {}",
            source_path.display()
        ));
    }

    let mut weight = tables
        .get("OS/2")
        .map(|(offset, _)| u16_be(data, offset + 4))
        .unwrap_or(400);
    if weight == 0 || weight > 1000 {
        weight = 400;
    }
    let mut italic = tables
        .get("OS/2")
        .filter(|(_, length)| *length >= 64)
        .is_some_and(|(offset, _)| u16_be(data, offset + 62) & 0x0001 != 0);
    if !italic {
        italic = tables
            .get("head")
            .filter(|(_, length)| *length >= 46)
            .is_some_and(|(offset, _)| u16_be(data, offset + 44) & 0x0002 != 0);
    }
    if !italic {
        let lower = subfamily.to_ascii_lowercase();
        italic = lower.contains("italic") || lower.contains("oblique");
    }

    let mut min_weight = weight;
    let mut max_weight = weight;
    let mut variable = false;
    let mut supports_italic_axis = false;
    if let Some(&(offset, length)) = tables.get("fvar") {
        if length >= 16 {
            let axes_offset = u16_be(data, offset + 4) as usize;
            let axis_count = u16_be(data, offset + 8) as usize;
            let axis_size = u16_be(data, offset + 10) as usize;
            variable = axis_count > 0;
            for index in 0..axis_count {
                let axis = offset + axes_offset + index * axis_size;
                if axis + 16 > offset + length {
                    break;
                }
                let axis_tag = tag(data, axis);
                let fixed = |pos: usize| -> f64 { u32_be(data, pos) as f64 / 65536.0 };
                let signed_fixed = |pos: usize| -> f64 {
                    data.get(pos..pos + 4)
                        .map(|bytes| {
                            i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64
                                / 65536.0
                        })
                        .unwrap_or(0.0)
                };
                if axis_tag == Some("wght") {
                    min_weight = fixed(axis + 4).round().clamp(1.0, 1000.0) as u16;
                    max_weight = fixed(axis + 12).round().clamp(1.0, 1000.0) as u16;
                } else {
                    match ItalicAxis::from_tag(axis_tag) {
                        Some(ItalicAxis::Toggle) => supports_italic_axis = fixed(axis + 12) >= 1.0,
                        Some(ItalicAxis::Slant) => {
                            supports_italic_axis =
                                signed_fixed(axis + 4) != 0.0 || signed_fixed(axis + 12) != 0.0;
                        }
                        None => {}
                    }
                }
            }
        }
    }

    Ok(ParsedFontFace {
        family,
        style: if italic {
            "italic".into()
        } else {
            "normal".into()
        },
        min_weight,
        max_weight,
        variable,
        supports_italic_axis,
        source_path: source_path.to_path_buf(),
    })
}

pub(super) fn inspect_font_file(path: &Path) -> Result<Vec<ParsedFontFace>, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "ttf" | "otf" | "ttc" | "otc") {
        return Err("Unsupported font file type".into());
    }
    let data = fs::read(path).map_err(|error| error.to_string())?;
    let mut raw = Vec::new();
    if tag(&data, 0) == Some("ttcf") {
        let count = u32_be(&data, 8) as usize;
        for index in 0..count {
            raw.push(inspect_face(
                &data,
                u32_be(&data, 12 + index * 4) as usize,
                path,
            )?);
        }
    } else {
        raw.push(inspect_face(&data, 0, path)?);
    }
    Ok(raw.into_iter().flat_map(expand_italic_axis).collect())
}
