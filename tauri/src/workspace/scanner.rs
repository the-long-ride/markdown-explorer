use crate::error::HostResult;
use crate::workspace::file_types::{
    extension, is_markdown_file_path, is_supported_file_path, strip_known_extension,
};
use regex_lite::Regex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
#[allow(unused_imports)]
use std::path::{Path, PathBuf};

const TITLE_CHUNK_BYTES: usize = 8 * 1024;
const DEFAULT_IGNORED_FOLDERS: &[&str] = &[
    ".git",
    "node_modules",
    ".vscode",
    "dist",
    "out",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    "vendor",
    "target",
    "bin",
    "obj",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MdFile {
    pub fs_path: String,
    pub relative_path: String,
    pub parts: Vec<String>,
    pub file_name: String,
    pub title: String,
    pub extension: String,
    pub document_kind: DocumentKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DocumentKind {
    Markdown,
    Document,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub children: Vec<FolderNode>,
    pub files: Vec<MdFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScanResult {
    pub tree: FolderNode,
    pub flat: Vec<MdFile>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct ScanOptions {
    pub document_conversion_enabled: bool,
}

pub fn load_ignore_patterns(root_path: &Path) -> Vec<String> {
    let ignore_path = root_path.join(".markdown-explorer-ignore");
    fs::read_to_string(ignore_path)
        .map(|content| {
            content
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty() && !line.starts_with('#'))
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

pub fn read_title_chunk(fs_path: &Path) -> std::io::Result<String> {
    let mut file = fs::File::open(fs_path)?;
    file.seek(SeekFrom::Start(0))?;
    let mut buf = vec![0_u8; TITLE_CHUNK_BYTES];
    let bytes_read = file.read(&mut buf)?;
    buf.truncate(bytes_read);
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

pub fn extract_mdx_title(content: &str) -> Option<String> {
    if let Some(frontmatter) = content.strip_prefix("---\n") {
        if let Some(end) = frontmatter.find("\n---") {
            for line in frontmatter[..end].lines() {
                let Some(sep) = line.find(':') else {
                    continue;
                };
                if sep > 0 && line[..sep].trim() == "title" {
                    let title = line[sep + 1..].trim().trim_matches(['\'', '"']);
                    if !title.is_empty() {
                        return Some(title.to_string());
                    }
                }
            }
        }
    }

    let export_title =
        Regex::new(r#"export\s+(?:const|let|var)\s+title\s*=\s*(['"`])([^'"`]*)['"`]"#).ok()?;
    if let Some(caps) = export_title.captures(content) {
        return caps
            .get(2)
            .map(|m| m.as_str().trim().to_string())
            .filter(|s| !s.is_empty());
    }

    let meta_title = Regex::new(
        r#"export\s+(?:const|let|var)\s+meta\s*=\s*\{(?s:.*?)title\s*:\s*(['"`])([^'"`]*)['"`]"#,
    )
    .ok()?;
    if let Some(caps) = meta_title.captures(content) {
        return caps
            .get(2)
            .map(|m| m.as_str().trim().to_string())
            .filter(|s| !s.is_empty());
    }

    let jsx_title = Regex::new(
        r#"<[A-Z]\w*\s+[^>]*?title=(?:(['"`])([^'"`]*)['"`]|\{(['"`])([^'"`]*)['"`]\})"#,
    )
    .ok()?;
    jsx_title.captures(content).and_then(|caps| {
        caps.get(2)
            .or_else(|| caps.get(4))
            .map(|m| m.as_str().trim().to_string())
            .filter(|s| !s.is_empty())
    })
}

pub fn extract_title(fs_path: &Path, is_mdx: bool) -> Option<String> {
    let content = read_title_chunk(fs_path).ok()?;
    if is_mdx {
        if let Some(title) = extract_mdx_title(&content) {
            return Some(title);
        }
    }
    let heading = Regex::new(r"(?m)^#+\s+(.+)$").ok()?;
    heading
        .captures(&content)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn build_file_entry_lite(fs_path: &Path, root_path: &Path, placeholder_title: &str) -> MdFile {
    let relative =
        pathdiff::diff_paths(fs_path, root_path).unwrap_or_else(|| fs_path.to_path_buf());
    let parts: Vec<String> = relative
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    let file_name = fs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = extension(&file_name);
    let markdown = is_markdown_file_path(&file_name);

    MdFile {
        fs_path: fs_path.to_string_lossy().to_string(),
        relative_path: parts.join(std::path::MAIN_SEPARATOR_STR),
        parts,
        title: if placeholder_title.is_empty() {
            strip_known_extension(&file_name)
        } else {
            placeholder_title.to_string()
        },
        file_name,
        extension: ext,
        document_kind: if markdown {
            DocumentKind::Markdown
        } else {
            DocumentKind::Document
        },
        tab_id: None,
        tab_label: None,
    }
}

pub fn build_file_entry(fs_path: &Path, root_path: &Path) -> MdFile {
    let file_name = fs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = extension(&file_name);
    let markdown = is_markdown_file_path(&file_name);
    let title = if markdown {
        extract_title(fs_path, ext == ".mdx").unwrap_or_else(|| strip_known_extension(&file_name))
    } else {
        strip_known_extension(&file_name)
    };
    build_file_entry_lite(fs_path, root_path, &title)
}

pub fn build_tree(flat: &[MdFile]) -> FolderNode {
    let mut root = FolderNode {
        name: "root".into(),
        path: String::new(),
        children: vec![],
        files: vec![],
    };
    for file in flat {
        insert_file(&mut root, file, 0);
    }
    root
}

fn insert_file(node: &mut FolderNode, file: &MdFile, depth: usize) {
    if depth + 1 >= file.parts.len() {
        node.files.push(file.clone());
        return;
    }
    let name = &file.parts[depth];
    let idx = node
        .children
        .iter()
        .position(|child| &child.name == name)
        .unwrap_or_else(|| {
            let path = file.parts[..=depth].join("/");
            node.children.push(FolderNode {
                name: name.clone(),
                path,
                children: vec![],
                files: vec![],
            });
            node.children.len() - 1
        });
    insert_file(&mut node.children[idx], file, depth + 1);
}

pub fn scan(root_path: &Path, options: ScanOptions) -> HostResult<ScanResult> {
    scan_with_progress(root_path, options, |_| {})
}

pub fn scan_with_progress(
    root_path: &Path,
    options: ScanOptions,
    mut report_progress: impl FnMut(usize),
) -> HostResult<ScanResult> {
    let custom_ignores = load_ignore_patterns(root_path);
    let mut excludes: Vec<String> = DEFAULT_IGNORED_FOLDERS
        .iter()
        .map(|s| s.to_string())
        .collect();
    excludes.extend(custom_ignores);

    let mut flat: Vec<MdFile> = Vec::new();
    let mut queue = VecDeque::from([root_path.to_path_buf()]);

    while let Some(current_dir) = queue.pop_front() {
        let entries = match fs::read_dir(&current_dir) {
            Ok(entries) => entries,
            Err(err) => {
                eprintln!("Failed to read directory: {} {err}", current_dir.display());
                continue;
            }
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if excludes.iter().any(|exclude| exclude == &name) {
                continue;
            }
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            if file_type.is_dir() {
                queue.push_back(path);
                continue;
            }
            if file_type.is_file()
                && is_supported_file_path(
                    &path.to_string_lossy(),
                    options.document_conversion_enabled,
                )
            {
                flat.push(build_file_entry(&path, root_path));
                if flat.len() % 100 == 0 {
                    report_progress(flat.len());
                }
            }
        }
    }

    flat.sort_by(|a, b| a.fs_path.cmp(&b.fs_path));
    report_progress(flat.len());
    let tree = build_tree(&flat);
    Ok(ScanResult { tree, flat })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn extract_mdx_title_prefers_frontmatter() {
        assert_eq!(
            extract_mdx_title(
                "---\ntitle: \"Frontmatter Title\"\n---\n\nexport const title = 'Ignored';"
            )
            .unwrap(),
            "Frontmatter Title"
        );
    }

    #[test]
    fn extract_title_falls_back_to_heading() {
        let root = temp_dir("tauri-title");
        let file = root.join("sample.mdx");
        write(&file, "Intro\n\n# Visible Heading");
        assert_eq!(extract_title(&file, true).unwrap(), "Visible Heading");
    }

    #[test]
    fn scan_ignores_excluded_folders_and_unsupported_files() {
        let root = temp_dir("tauri-scan");
        write(&root.join("docs/guide.md"), "# Guide");
        write(&root.join(".git/ignored.md"), "# Git");
        write(&root.join("node_modules/pkg.md"), "# Pkg");
        write(&root.join("notes.txt"), "plain text");
        write(&root.join("image.png"), "not supported");

        let result = scan(&root, ScanOptions::default()).unwrap();
        let rel: Vec<_> = result
            .flat
            .iter()
            .map(|entry| entry.relative_path.clone())
            .collect();
        assert_eq!(
            rel,
            vec![
                "docs\\guide.md".replace('\\', std::path::MAIN_SEPARATOR_STR),
                "notes.txt".to_string()
            ]
        );
        assert_eq!(result.tree.children[0].name, "docs");
    }

    #[test]
    fn scan_applies_custom_ignore_patterns_by_name() {
        let root = temp_dir("tauri-ignore");
        write(&root.join("keep.md"), "# Keep");
        write(&root.join("skip.md"), "# Skip");
        write(&root.join(".markdown-explorer-ignore"), "skip.md\n");
        let result = scan(&root, ScanOptions::default()).unwrap();
        assert_eq!(
            result
                .flat
                .iter()
                .map(|e| e.file_name.as_str())
                .collect::<Vec<_>>(),
            vec!["keep.md"]
        );
    }

    #[test]
    fn scan_includes_extra_docs_only_when_enabled() {
        let root = temp_dir("tauri-docconv");
        write(&root.join("report.doc"), "fake doc");
        write(&root.join("readme.md"), "# Readme");
        let off = scan(&root, ScanOptions::default()).unwrap();
        assert_eq!(
            off.flat
                .iter()
                .map(|e| e.file_name.as_str())
                .collect::<Vec<_>>(),
            vec!["readme.md"]
        );
        let on = scan(
            &root,
            ScanOptions {
                document_conversion_enabled: true,
            },
        )
        .unwrap();
        assert_eq!(on.flat.len(), 2);
    }

    #[test]
    fn scan_includes_more_than_1000_files() {
        let root = temp_dir("tauri-large-scan");
        for index in 0..1100 {
            write(&root.join(format!("dir-{index:04}/file.md")), "# Title");
        }

        let result = scan(&root, ScanOptions::default()).unwrap();
        assert_eq!(result.flat.len(), 1100);
    }

    #[test]
    fn scan_reports_supported_file_progress() {
        let root = temp_dir("tauri-progress-scan");
        for index in 0..100 {
            write(&root.join(format!("file-{index:03}.md")), "# Title");
        }
        let mut progress = vec![];
        let result = scan_with_progress(&root, ScanOptions::default(), |count| progress.push(count))
            .unwrap();
        assert_eq!(result.flat.len(), 100);
        assert_eq!(progress, vec![100, 100]);
    }

    #[test]
    fn build_tree_reuses_child_nodes() {
        let root = temp_dir("tauri-tree");
        let flat = vec![
            build_file_entry_lite(&root.join("shared/one.md"), &root, "pending"),
            build_file_entry_lite(&root.join("shared/two.md"), &root, "pending"),
        ];
        let tree = build_tree(&flat);
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].files.len(), 2);
    }
}
