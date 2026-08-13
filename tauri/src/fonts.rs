use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

const MAX_SYSTEM_FONT_FILES: usize = 6000;

#[derive(Clone, Debug)]
pub struct ParsedFontFace {
    pub family: String,
    pub style: String,
    pub min_weight: u16,
    pub max_weight: u16,
    pub variable: bool,
    pub supports_italic_axis: bool,
    pub source_path: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopFontFace {
    pub style: String,
    pub min_weight: u16,
    pub max_weight: u16,
    pub variable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css_url: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopFontFamily {
    pub id: String,
    pub family: String,
    pub source: String,
    pub faces: Vec<DesktopFontFace>,
    pub css_family: String,
    pub available: bool,
}

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
        let Some(name) = tag(data, record) else { continue; };
        let offset = u32_be(data, record + 8) as usize;
        let length = u32_be(data, record + 12) as usize;
        if offset.checked_add(length).is_some_and(|end| end <= data.len()) {
            result.insert(name.to_string(), (offset, length));
        }
    }
    result
}

fn decode_name(data: &[u8], record: usize, storage_offset: usize) -> String {
    let platform = u16_be(data, record);
    let length = u16_be(data, record + 8) as usize;
    let string_offset = u16_be(data, record + 10) as usize;
    let Some(start) = storage_offset.checked_add(string_offset) else { return String::new(); };
    let Some(end) = start.checked_add(length) else { return String::new(); };
    let Some(bytes) = data.get(start..end) else { return String::new(); };
    if platform == 0 || platform == 3 {
        if bytes.len() % 2 != 0 { return String::new(); }
        let units: Vec<u16> = bytes.chunks_exact(2).map(|pair| u16::from_be_bytes([pair[0], pair[1]])).collect();
        return String::from_utf16_lossy(&units).trim_matches('\0').trim().to_string();
    }
    String::from_utf8_lossy(bytes).trim_matches('\0').trim().to_string()
}

fn read_names(data: &[u8], table: Option<&(usize, usize)>) -> (String, String) {
    let Some(&(offset, length)) = table else { return (String::new(), String::new()); };
    let count = u16_be(data, offset + 2) as usize;
    let storage_offset = offset + u16_be(data, offset + 4) as usize;
    let mut family: Vec<(i32, String)> = Vec::new();
    let mut typographic_family: Vec<(i32, String)> = Vec::new();
    let mut subfamily: Vec<(i32, String)> = Vec::new();
    let mut typographic_subfamily: Vec<(i32, String)> = Vec::new();
    for index in 0..count {
        let record = offset + 6 + index * 12;
        if record + 12 > offset + length { break; }
        let name_id = u16_be(data, record + 6);
        let value = decode_name(data, record, storage_offset);
        if value.is_empty() { continue; }
        let platform = u16_be(data, record);
        let language = u16_be(data, record + 4);
        let score = if platform == 3 { 10 } else if platform == 0 { 8 } else { 0 }
            + if language == 0x0409 || language == 0 { 2 } else { 0 };
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
        items.first().map(|(_, value)| value.clone()).unwrap_or_default()
    };
    let typed_family = pick(&mut typographic_family);
    let typed_subfamily = pick(&mut typographic_subfamily);
    (
        if typed_family.is_empty() { pick(&mut family) } else { typed_family },
        if typed_subfamily.is_empty() { pick(&mut subfamily) } else { typed_subfamily },
    )
}

fn inspect_face(data: &[u8], face_offset: usize, source_path: &Path) -> Result<ParsedFontFace, String> {
    let tables = table_map(data, face_offset);
    let (family, subfamily) = read_names(data, tables.get("name"));
    if family.is_empty() { return Err(format!("Font family metadata is missing: {}", source_path.display())); }

    let mut weight = tables.get("OS/2").map(|(offset, _)| u16_be(data, offset + 4)).unwrap_or(400);
    if weight == 0 || weight > 1000 { weight = 400; }
    let mut italic = tables.get("OS/2")
        .filter(|(_, length)| *length >= 64)
        .is_some_and(|(offset, _)| u16_be(data, offset + 62) & 0x0001 != 0);
    if !italic {
        italic = tables.get("head")
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
                if axis + 16 > offset + length { break; }
                let axis_tag = tag(data, axis);
                let fixed = |pos: usize| -> f64 { u32_be(data, pos) as f64 / 65536.0 };
                let signed_fixed = |pos: usize| -> f64 {
                    data.get(pos..pos + 4)
                        .map(|bytes| i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64 / 65536.0)
                        .unwrap_or(0.0)
                };
                match axis_tag {
                    Some("wght") => {
                        min_weight = fixed(axis + 4).round().clamp(1.0, 1000.0) as u16;
                        max_weight = fixed(axis + 12).round().clamp(1.0, 1000.0) as u16;
                    }
                    Some("ital") => supports_italic_axis = fixed(axis + 12) >= 1.0,
                    Some("slnt") => supports_italic_axis = signed_fixed(axis + 4) != 0.0 || signed_fixed(axis + 12) != 0.0,
                    _ => {}
                }
            }
        }
    }

    Ok(ParsedFontFace {
        family,
        style: if italic { "italic".into() } else { "normal".into() },
        min_weight,
        max_weight,
        variable,
        supports_italic_axis,
        source_path: source_path.to_path_buf(),
    })
}

fn expand_italic_axis(face: ParsedFontFace) -> Vec<ParsedFontFace> {
    if !face.supports_italic_axis { return vec![face]; }
    let mut upright = face.clone();
    upright.style = "normal".into();
    let mut italic = face;
    italic.style = "italic".into();
    vec![upright, italic]
}

pub fn inspect_font_file(path: &Path) -> Result<Vec<ParsedFontFace>, String> {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if !matches!(extension.as_str(), "ttf" | "otf" | "ttc" | "otc") { return Err("Unsupported font file type".into()); }
    let data = fs::read(path).map_err(|error| error.to_string())?;
    let mut raw = Vec::new();
    if tag(&data, 0) == Some("ttcf") {
        let count = u32_be(&data, 8) as usize;
        for index in 0..count { raw.push(inspect_face(&data, u32_be(&data, 12 + index * 4) as usize, path)?); }
    } else {
        raw.push(inspect_face(&data, 0, path)?);
    }
    Ok(raw.into_iter().flat_map(expand_italic_axis).collect())
}

fn system_font_roots() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let windows = PathBuf::from(std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into())).join("Fonts");
        let local = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| dirs_home().join("AppData").join("Local"))
            .join("Microsoft").join("Windows").join("Fonts");
        vec![windows, local]
    }
    #[cfg(target_os = "macos")]
    { vec![PathBuf::from("/System/Library/Fonts"), PathBuf::from("/Library/Fonts"), dirs_home().join("Library/Fonts")] }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    { vec![PathBuf::from("/usr/share/fonts"), PathBuf::from("/usr/local/share/fonts"), dirs_home().join(".fonts"), dirs_home().join(".local/share/fonts")] }
}

fn dirs_home() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn is_system_font_path(path: &Path) -> bool {
    matches!(path.extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()).as_deref(), Some("ttf") | Some("otf") | Some("ttc") | Some("otc"))
}

fn is_import_font_path(path: &Path) -> bool {
    matches!(path.extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()).as_deref(), Some("ttf") | Some("otf"))
}

fn collect_system_font_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for root in system_font_roots() {
        if !root.exists() { continue; }
        for entry in WalkDir::new(root).follow_links(false).into_iter().filter_map(Result::ok) {
            if entry.file_type().is_file() && is_system_font_path(entry.path()) {
                paths.push(entry.path().to_path_buf());
                if paths.len() >= MAX_SYSTEM_FONT_FILES { return paths; }
            }
        }
    }
    paths
}

fn managed_url(path: &Path) -> String {
    format!("local-file://{}", urlencoding::encode(path.to_string_lossy().as_ref()))
}

fn group_faces(faces: Vec<ParsedFontFace>, source: &str, imported_id: Option<&str>) -> Vec<DesktopFontFamily> {
    let mut groups: BTreeMap<String, Vec<ParsedFontFace>> = BTreeMap::new();
    for face in faces { groups.entry(face.family.clone()).or_default().push(face); }
    groups.into_iter().map(|(family, faces)| {
        let id = if source == "imported" { imported_id.unwrap_or("font_unknown").to_string() } else { format!("system:{family}") };
        let css_family = if source == "imported" { format!("MarkdownExplorer Imported {id}") } else { family.clone() };
        DesktopFontFamily {
            id,
            family,
            source: source.to_string(),
            css_family,
            available: true,
            faces: faces.into_iter().map(|face| DesktopFontFace {
                style: face.style,
                min_weight: face.min_weight,
                max_weight: face.max_weight,
                variable: face.variable,
                css_url: if source == "imported" { Some(managed_url(&face.source_path)) } else { None },
            }).collect(),
        }
    }).collect()
}

fn inspect_many(paths: impl IntoIterator<Item = PathBuf>) -> Vec<ParsedFontFace> {
    let mut result = Vec::new();
    for path in paths {
        if let Ok(mut faces) = inspect_font_file(&path) { result.append(&mut faces); }
    }
    result
}

fn managed_root(app_data_dir: &Path) -> PathBuf { app_data_dir.join("fonts") }

fn list_imported_fonts(app_data_dir: &Path) -> Vec<DesktopFontFamily> {
    let root = managed_root(app_data_dir);
    let Ok(entries) = fs::read_dir(root) else { return Vec::new(); };
    let mut result = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        let id = entry.file_name().to_string_lossy().into_owned();
        if !entry.path().is_dir() || !id.starts_with("font_") || !id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') { continue; }
        let Ok(files) = fs::read_dir(entry.path()) else { continue; };
        let paths: Vec<_> = files.filter_map(Result::ok).map(|item| item.path()).filter(|path| is_import_font_path(path)).collect();
        result.extend(group_faces(inspect_many(paths), "imported", Some(&id)));
    }
    result
}

pub fn list_fonts(app_data_dir: &Path) -> Result<Vec<DesktopFontFamily>, String> {
    let mut fonts = group_faces(inspect_many(collect_system_font_paths()), "system", None);
    fonts.extend(list_imported_fonts(app_data_dir));
    fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    Ok(fonts)
}

pub fn import_font_files(app_data_dir: &Path, paths: &[PathBuf]) -> Result<DesktopFontFamily, String> {
    if paths.is_empty() { return Err("Choose at least one .ttf or .otf font file.".into()); }
    if paths.iter().any(|path| !is_import_font_path(path)) { return Err("Only .ttf and .otf font files can be imported.".into()); }
    let mut parsed = Vec::new();
    for path in paths { parsed.extend(inspect_font_file(path)?); }
    let families: std::collections::BTreeSet<_> = parsed.iter().map(|face| face.family.clone()).collect();
    if families.len() != 1 { return Err("Imported font files must belong to one font family.".into()); }
    let _preview = group_faces(parsed, "imported", Some("font_preview")).into_iter().next().ok_or("No usable font faces were found")?;

    let id = format!("font_{}", Uuid::new_v4());
    let target = managed_root(app_data_dir).join(&id);
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;
    let result = (|| -> Result<DesktopFontFamily, String> {
        let mut copied = Vec::new();
        for (index, source) in paths.iter().enumerate() {
            let file_name = source.file_name().and_then(|value| value.to_str()).unwrap_or("font.ttf");
            let safe_name: String = file_name.chars().map(|ch| if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') { ch } else { '-' }).collect();
            let destination = target.join(format!("{:02}-{}", index + 1, safe_name));
            fs::copy(source, &destination).map_err(|error| error.to_string())?;
            copied.push(destination);
        }
        let family = group_faces(inspect_many(copied), "imported", Some(&id)).into_iter().next().ok_or("No usable font faces were copied")?;
        Ok(family)
    })();
    if result.is_err() { let _ = fs::remove_dir_all(&target); }
    result
}

pub fn remove_imported_font(app_data_dir: &Path, id: &str) -> Result<(), String> {
    if !id.starts_with("font_") || !id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') { return Err("Invalid imported font id.".into()); }
    fs::remove_dir_all(managed_root(app_data_dir).join(id)).or_else(|error| if error.kind() == std::io::ErrorKind::NotFound { Ok(()) } else { Err(error) }).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_jetbrains_variable_faces_have_required_axes() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/assets/fonts/JetBrainsMono");
        let upright = inspect_font_file(&root.join("JetBrainsMono-VariableFont_wght.ttf")).unwrap();
        let italic = inspect_font_file(&root.join("JetBrainsMono-Italic-VariableFont_wght.ttf")).unwrap();
        assert!(upright.iter().any(|face| face.family == "JetBrains Mono" && face.style == "normal" && face.variable && face.max_weight >= 700));
        assert!(italic.iter().any(|face| face.family == "JetBrains Mono" && face.style == "italic" && face.variable));
    }
}
