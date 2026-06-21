// ============================================================
// search/mod.rs — In-memory workspace search index
// Port of desktop/search-index.js + unicode-search.js
// ============================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub fs_path: String,
    pub title: String,
    pub file_name: String,
    pub relative_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_ordinal: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_length: Option<usize>,
}

struct IndexedFile {
    fs_path: String,
    title: String,
    file_name: String,
    relative_path: String,
    content_lower: String,
    title_lower: String,
}

/// Simple Unicode-aware lowercasing sufficient for search.
fn unicode_lower(s: &str) -> String {
    s.to_lowercase() // Unicode-aware via Rust std
}

/// Strip common combining marks for more lenient search
fn normalize_search_text(s: &str) -> String {
    unicode_lower(s)
}

pub struct SearchIndex {
    files: Vec<IndexedFile>,
}

impl SearchIndex {
    pub fn new() -> Self {
        SearchIndex { files: vec![] }
    }

    pub fn build(&mut self, _root_path: &Path, file_list: &[crate::scanner::MdFile]) {
        self.files.clear();

        for file in file_list {
            // Read file content for content indexing
            let content = fs::read_to_string(&file.fs_path).unwrap_or_default();
            let content_lower = normalize_search_text(&content);
            let title_lower = normalize_search_text(&file.title);

            // Only index the first 50KB to keep memory usage reasonable
            let truncated = if content_lower.len() > 50_000 {
                content_lower[..50_000].to_string()
            } else {
                content_lower
            };

            self.files.push(IndexedFile {
                fs_path: file.fs_path.clone(),
                title: file.title.clone(),
                file_name: file.file_name.clone(),
                relative_path: file.relative_path.clone(),
                content_lower: truncated,
                title_lower,
            });
        }
    }

    pub fn search(&self, query: &str, max_results: usize) -> Vec<SearchResult> {
        let query_lower = normalize_search_text(query);

        // Require at least 2 characters for search
        if query_lower.len() < 2 {
            return vec![];
        }

        let mut scored: Vec<(usize, &IndexedFile)> = self
            .files
            .iter()
            .filter_map(|file| {
                let mut score: usize = 0;

                // Title matches get highest boost
                if file.title_lower.contains(&query_lower) {
                    score += 1000;
                    if file.title_lower.starts_with(&query_lower) {
                        score += 500;
                    }
                }

                // File name matches
                let file_name_lower = normalize_search_text(&file.file_name);
                if file_name_lower.contains(&query_lower) {
                    score += 200;
                }

                // Content matches
                if let Some(pos) = file.content_lower.find(&query_lower) {
                    score += 10;
                    // Earlier matches rank higher
                    score += 1000usize.saturating_sub(pos.min(999));
                }

                if score > 0 {
                    Some((score, file))
                } else {
                    None
                }
            })
            .collect();

        // Sort by score descending
        scored.sort_by(|a, b| b.0.cmp(&a.0));
        scored.truncate(max_results);

        let mut ordinal = 0u64;
        scored
            .iter()
            .map(|(_, file)| {
                let idx = file.content_lower.find(&query_lower);
                ordinal += 1;
                SearchResult {
                    fs_path: file.fs_path.clone(),
                    title: file.title.clone(),
                    file_name: file.file_name.clone(),
                    relative_path: file.relative_path.clone(),
                    excerpt: idx.map(|i| {
                        let start = i.saturating_sub(40);
                        let end = (i + query_lower.len() + 40).min(file.content_lower.len());
                        file.content_lower[start..end].to_string()
                    }),
                    match_index: idx,
                    match_ordinal: Some(ordinal as usize),
                    match_length: Some(query_lower.len()),
                }
            })
            .collect()
    }

    #[allow(dead_code)]
    pub fn file_count(&self) -> usize {
        self.files.len()
    }
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}
