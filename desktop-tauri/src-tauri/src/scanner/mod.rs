// ============================================================
// scanner/mod.rs — Recursive workspace file scanner
// Port of desktop/scanner.js → Rust using walkdir
// ============================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Default folders excluded from scans
const DEFAULT_IGNORED: &[&str] = &[
    ".git", "node_modules", ".vscode", "dist", "out", "build",
    "coverage", ".next", ".nuxt", ".turbo", ".cache", "vendor",
    "target", "bin", "obj",
];

/// Maximum number of files to scan (matches Electron scanner cap)
const MAX_FILES: usize = 1000;

/// Supported markdown extensions
const MARKDOWN_EXTS: &[&str] = &[".md", ".mdx", ".markdown", ".txt"];

/// Extra document extensions (when doc conversion is enabled)
const DOC_EXTS: &[&str] = &[
    ".docx", ".pdf", ".html", ".xlsx", ".pptx",
    ".odt", ".odp", ".ods", ".rtf",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MdFile {
    pub fs_path: String,
    pub relative_path: String,
    pub parts: Vec<String>,
    pub file_name: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub children: Vec<FolderNode>,
    pub files: Vec<MdFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub tree: FolderNode,
    pub flat: Vec<MdFile>,
}

fn is_supported_ext(ext: &str, doc_conversion_enabled: bool) -> bool {
    let lower = ext.to_lowercase();
    if MARKDOWN_EXTS.iter().any(|e| e == &lower.as_str()) {
        return true;
    }
    if doc_conversion_enabled {
        return DOC_EXTS.iter().any(|e| e == &lower.as_str());
    }
    false
}

fn extract_title(file_path: &Path) -> String {
    // Try to read the first heading from the file
    if let Ok(content) = fs::read_to_string(file_path) {
        for line in content.lines().take(30) {
            let trimmed = line.trim();
            if let Some(stripped) = trimmed.strip_prefix("# ") {
                let title = stripped.trim().trim_end_matches('#').trim();
                if !title.is_empty() {
                    return title.to_string();
                }
            }
        }
    }
    // Fallback: filename without extension
    file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled")
        .to_string()
}

fn load_ignore_patterns(root: &Path) -> Vec<String> {
    let ignore_file = root.join(".markdown-explorer-ignore");
    match fs::read_to_string(&ignore_file) {
        Ok(content) => content
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .collect(),
        Err(_) => vec![],
    }
}

fn build_folder_tree(flat: &[MdFile]) -> FolderNode {
    let mut root = FolderNode {
        name: String::new(),
        path: String::new(),
        children: vec![],
        files: vec![],
    };

    for file in flat {
        let parts: Vec<&str> = file.parts.iter().map(|s| s.as_str()).collect();
        if parts.is_empty() {
            root.files.push(file.clone());
            continue;
        }
        insert_into_tree(&mut root, &parts, 0, file);
    }

    root
}

fn insert_into_tree(node: &mut FolderNode, parts: &[&str], depth: usize, file: &MdFile) {
    if depth >= parts.len() - 1 {
        // Last part is the filename, add as file
        node.files.push(file.clone());
        return;
    }

    let folder_name = parts[depth];
    let folder_path = if node.path.is_empty() {
        folder_name.to_string()
    } else {
        format!("{}/{}", node.path, folder_name)
    };

    // Find or create child folder
    let child_idx = node.children.iter().position(|c| c.name == folder_name);
    if let Some(idx) = child_idx {
        insert_into_tree(&mut node.children[idx], parts, depth + 1, file);
    } else {
        let mut child = FolderNode {
            name: folder_name.to_string(),
            path: folder_path,
            children: vec![],
            files: vec![],
        };
        insert_into_tree(&mut child, parts, depth + 1, file);
        node.children.push(child);
    }
}

pub fn scan(root_path: &Path, doc_conversion_enabled: bool) -> ScanResult {
    let custom_ignored = load_ignore_patterns(root_path);
    let mut excludes: Vec<String> = DEFAULT_IGNORED.iter().map(|s| s.to_string()).collect();
    excludes.extend(custom_ignored);

    let mut flat: Vec<MdFile> = Vec::new();
    let _root_str = root_path.to_string_lossy().to_string();

    for entry in WalkDir::new(root_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !excludes.iter().any(|ex| ex == name.as_ref())
        })
    {
        if flat.len() >= MAX_FILES {
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let full_path = entry.path();
        let ext = full_path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let ext_with_dot = format!(".{}", ext);

        if !is_supported_ext(&ext_with_dot, doc_conversion_enabled) {
            continue;
        }

        let rel_path = full_path
            .strip_prefix(root_path)
            .unwrap_or(full_path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        let parts: Vec<String> = rel_path
            .split('/')
            .map(|s| s.to_string())
            .collect();

        let file_name = full_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let title = extract_title(full_path);
        let is_markdown = MARKDOWN_EXTS.iter().any(|e| e == &ext_with_dot.to_lowercase().as_str());

        flat.push(MdFile {
            fs_path: full_path.to_string_lossy().to_string(),
            relative_path: rel_path,
            parts,
            file_name,
            title,
            extension: Some(ext.to_string()),
            document_kind: if is_markdown {
                Some("markdown".to_string())
            } else {
                Some("document".to_string())
            },
        });
    }

    let tree = build_folder_tree(&flat);
    ScanResult { tree, flat }
}
