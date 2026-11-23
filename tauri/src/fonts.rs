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

mod sfnt;

enum ItalicAxis {
    Toggle,
    Slant,
}

impl ItalicAxis {
    fn from_tag(tag: Option<&str>) -> Option<Self> {
        match tag {
            Some("ital") => Some(Self::Toggle),
            Some("slnt") => Some(Self::Slant),
            _ => None,
        }
    }
}

fn expand_italic_axis(face: ParsedFontFace) -> Vec<ParsedFontFace> {
    if !face.supports_italic_axis {
        return vec![face];
    }
    let mut upright = face.clone();
    upright.style = "normal".into();
    let mut italic = face;
    italic.style = "italic".into();
    vec![upright, italic]
}

pub fn inspect_font_file(path: &Path) -> Result<Vec<ParsedFontFace>, String> {
    sfnt::inspect_font_file(path)
}

fn system_font_roots() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let windows =
            PathBuf::from(std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into()))
                .join("Fonts");
        let local = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| dirs_home().join("AppData").join("Local"))
            .join(Path::new("Microsoft/Windows/Fonts"));
        vec![windows, local]
    }
    #[cfg(target_os = "macos")]
    {
        vec![
            PathBuf::from("/System/Library/Fonts"),
            PathBuf::from("/Library/Fonts"),
            dirs_home().join("Library/Fonts"),
        ]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        vec![
            PathBuf::from("/usr/share/fonts"),
            PathBuf::from("/usr/local/share/fonts"),
            dirs_home().join(".fonts"),
            dirs_home().join(".local/share/fonts"),
        ]
    }
}

fn dirs_home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn is_system_font_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("ttf") | Some("otf") | Some("ttc") | Some("otc")
    )
}

fn is_import_font_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("ttf") | Some("otf")
    )
}

fn collect_system_font_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for root in system_font_roots() {
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
        {
            if entry.file_type().is_file() && is_system_font_path(entry.path()) {
                paths.push(entry.path().to_path_buf());
                if paths.len() >= MAX_SYSTEM_FONT_FILES {
                    return paths;
                }
            }
        }
    }
    paths
}

fn managed_url(path: &Path) -> String {
    let lossy = path.to_string_lossy().into_owned();
    let encoded = urlencoding::encode(&lossy);
    // WebView2 (Windows) only routes custom protocols through the
    // http://<scheme>.localhost/ transport form; a raw local-file:// URL fails
    // with ERR_UNKNOWN_URL_SCHEME before reaching the protocol handler.
    #[cfg(target_os = "windows")]
    {
        format!("http://local-file.localhost/{encoded}")
    }
    #[cfg(not(target_os = "windows"))]
    {
        format!("local-file://{encoded}")
    }
}

fn group_faces(
    faces: Vec<ParsedFontFace>,
    source: &str,
    imported_id: Option<&str>,
) -> Vec<DesktopFontFamily> {
    let mut groups: BTreeMap<String, Vec<ParsedFontFace>> = BTreeMap::new();
    for face in faces {
        groups.entry(face.family.clone()).or_default().push(face);
    }
    groups
        .into_iter()
        .map(|(family, faces)| {
            let id = if source == "imported" {
                imported_id.unwrap_or("font_unknown").to_string()
            } else {
                format!("system:{family}")
            };
            let css_family = if source == "imported" {
                format!("MarkdownExplorer Imported {id}")
            } else {
                family.clone()
            };
            DesktopFontFamily {
                id,
                family,
                source: source.to_string(),
                css_family,
                available: true,
                faces: faces
                    .into_iter()
                    .map(|face| DesktopFontFace {
                        style: face.style,
                        min_weight: face.min_weight,
                        max_weight: face.max_weight,
                        variable: face.variable,
                        css_url: if source == "imported" {
                            Some(managed_url(&face.source_path))
                        } else {
                            None
                        },
                    })
                    .collect(),
            }
        })
        .collect()
}

fn inspect_many(paths: impl IntoIterator<Item = PathBuf>) -> Vec<ParsedFontFace> {
    let mut result = Vec::new();
    for path in paths {
        if let Ok(mut faces) = inspect_font_file(&path) {
            result.append(&mut faces);
        }
    }
    result
}

fn managed_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("fonts")
}

fn list_imported_fonts(app_data_dir: &Path) -> Vec<DesktopFontFamily> {
    let root = managed_root(app_data_dir);
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };
    let mut result = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        let id = entry.file_name().to_string_lossy().into_owned();
        if !entry.path().is_dir()
            || !id.starts_with("font_")
            || !id
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
        {
            continue;
        }
        let Ok(files) = fs::read_dir(entry.path()) else {
            continue;
        };
        let paths: Vec<_> = files
            .filter_map(Result::ok)
            .map(|item| item.path())
            .filter(|path| is_import_font_path(path))
            .collect();
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

pub fn import_font_files(
    app_data_dir: &Path,
    paths: &[PathBuf],
) -> Result<DesktopFontFamily, String> {
    if paths.is_empty() {
        return Err("Choose at least one .ttf or .otf font file.".into());
    }
    if paths.iter().any(|path| !is_import_font_path(path)) {
        return Err("Only .ttf and .otf font files can be imported.".into());
    }
    let mut parsed = Vec::new();
    for path in paths {
        parsed.extend(inspect_font_file(path)?);
    }
    let families: std::collections::BTreeSet<_> =
        parsed.iter().map(|face| face.family.clone()).collect();
    if families.len() != 1 {
        return Err("Imported font files must belong to one font family.".into());
    }
    let _preview = group_faces(parsed, "imported", Some("font_preview"))
        .into_iter()
        .next()
        .ok_or("No usable font faces were found")?;

    let id = format!("font_{}", Uuid::new_v4());
    let target = managed_root(app_data_dir).join(&id);
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;
    let result = (|| -> Result<DesktopFontFamily, String> {
        let mut copied = Vec::new();
        for (index, source) in paths.iter().enumerate() {
            let file_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("font.ttf");
            let safe_name: String = file_name
                .chars()
                .map(|ch| {
                    if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                        ch
                    } else {
                        '-'
                    }
                })
                .collect();
            let destination = target.join(format!("{:02}-{}", index + 1, safe_name));
            fs::copy(source, &destination).map_err(|error| error.to_string())?;
            copied.push(destination);
        }
        let family = group_faces(inspect_many(copied), "imported", Some(&id))
            .into_iter()
            .next()
            .ok_or("No usable font faces were copied")?;
        Ok(family)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&target);
    }
    result
}

pub fn remove_imported_font(app_data_dir: &Path, id: &str) -> Result<(), String> {
    if !id.starts_with("font_")
        || !id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err("Invalid imported font id.".into());
    }
    fs::remove_dir_all(managed_root(app_data_dir).join(id))
        .or_else(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                Ok(())
            } else {
                Err(error)
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_jetbrains_variable_faces_have_required_axes() {
        let root =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/assets/fonts/JetBrainsMono");
        let upright = inspect_font_file(&root.join("JetBrainsMono-VariableFont_wght.ttf")).unwrap();
        let italic =
            inspect_font_file(&root.join("JetBrainsMono-Italic-VariableFont_wght.ttf")).unwrap();
        assert!(upright.iter().any(|face| face.family == "JetBrains Mono"
            && face.style == "normal"
            && face.variable
            && face.max_weight >= 700));
        assert!(italic.iter().any(|face| face.family == "JetBrains Mono"
            && face.style == "italic"
            && face.variable));
    }
}
