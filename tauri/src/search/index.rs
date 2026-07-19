use crate::search::unicode::{normalize_for_search, prepare_haystack, PreparedHaystack};
use crate::workspace::file_types::{
    extension, is_markdown_file_path, strip_known_extension, EXTRA_DOCUMENT_EXTENSIONS,
};
use crate::workspace::scanner::{DocumentKind, MdFile};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::Arc;

#[path = "incremental.rs"]
mod incremental;
pub use incremental::{IncrementalOptions, IncrementalSummary};

const MAX_INDEXABLE_BYTES: u64 = 2 * 1024 * 1024;
const PRIME_BATCH_SIZE: usize = 5;
const MAX_SYNC_MATCHES_PER_FILE: usize = 10000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_label: Option<String>,
    pub fs_path: String,
    pub title: String,
    pub file_name: String,
    pub relative_path: String,
    pub parts: Vec<String>,
    pub extension: String,
    pub document_kind: String,
    pub excerpt: Option<String>,
    pub match_index: Option<usize>,
    pub match_ordinal: Option<usize>,
    pub match_length: Option<usize>,
    pub line_number: Option<usize>,
}

struct ScoredResult {
    result: WorkspaceSearchResult,
    score: f64,
}

#[derive(Clone)]
pub(crate) struct SearchEntry {
    mtime_ms: u128,
    size: u64,
    raw: String,
    haystack: PreparedHaystack,
}

#[derive(Clone, Default)]
pub struct SearchIndex {
    cache: Arc<RwLock<HashMap<String, SearchEntry>>>,
}

pub fn can_search_file_contents(file_path: &str) -> bool {
    is_markdown_file_path(file_path) || extension(file_path) == ".txt"
}

fn is_known_supported_file_path(file_path: &str) -> bool {
    let ext = extension(file_path);
    matches!(ext.as_str(), ".md" | ".mdx" | ".markdown" | ".txt")
        || EXTRA_DOCUMENT_EXTENSIONS.contains(&ext.as_str())
}

fn should_skip_search_item(item: &MdFile) -> bool {
    item.fs_path.is_empty()
        || !Path::new(&item.fs_path).exists()
        || !is_known_supported_file_path(&item.fs_path)
}

fn score_item_name(title: &str, file_name: &str, relative_path: &str, query: &str) -> i32 {
    let title_score = if normalize_for_search(title).contains(query) { 5 } else { 0 };
    let file_name_score = if normalize_for_search(file_name).contains(query) { 4 } else { 0 };
    let path_score = if normalize_for_search(relative_path).contains(query) { 2 } else { 0 };
    title_score + file_name_score + path_score
}

fn doc_kind_string(kind: &DocumentKind) -> String {
    match kind {
        DocumentKind::Markdown => "markdown",
        DocumentKind::Document => "document",
    }
    .to_string()
}

pub fn make_search_excerpt(text: &str, index: usize, match_length: usize) -> String {
    let end = (index + match_length).min(text.len());
    let before = text[..index.min(text.len())]
        .split_whitespace()
        .collect::<Vec<_>>();
    let matched = text[index.min(text.len())..end]
        .split_whitespace()
        .collect::<Vec<_>>();
    let after = text[end..].split_whitespace().collect::<Vec<_>>();
    let mut parts = Vec::new();
    if before.len() > 10 { parts.push("...".to_string()); }
    parts.extend(before.iter().rev().take(10).rev().map(|s| s.to_string()));
    parts.extend(matched.iter().map(|s| s.to_string()));
    parts.extend(after.iter().take(10).map(|s| s.to_string()));
    if after.len() > 10 { parts.push("...".to_string()); }
    parts.join(" ").trim().to_string()
}

fn make_result(item: &MdFile, title: &str, file_name: &str, relative_path: &str) -> WorkspaceSearchResult {
    WorkspaceSearchResult {
        tab_id: item.tab_id.clone(),
        tab_label: item.tab_label.clone(),
        fs_path: item.fs_path.clone(),
        title: title.to_string(),
        file_name: file_name.to_string(),
        relative_path: relative_path.to_string(),
        parts: item.parts.clone(),
        extension: item.extension.clone(),
        document_kind: doc_kind_string(&item.document_kind),
        excerpt: None,
        match_index: None,
        match_ordinal: None,
        match_length: None,
        line_number: None,
    }
}

impl SearchIndex {
    pub(crate) fn get_entry(&self, file_path: &str) -> Option<SearchEntry> {
        if file_path.is_empty() || !Path::new(file_path).exists() || !can_search_file_contents(file_path) {
            return None;
        }
        let metadata = fs::metadata(file_path).ok()?;
        if metadata.len() > MAX_INDEXABLE_BYTES { return None; }
        let mtime_ms = metadata.modified().ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis()).unwrap_or(0);
        let size = metadata.len();
        if let Some(entry) = self.cache.read().get(file_path) {
            if entry.mtime_ms == mtime_ms && entry.size == size { return Some(entry.clone()); }
        }
        let raw = fs::read_to_string(file_path).ok()?;
        let entry = SearchEntry { mtime_ms, size, haystack: prepare_haystack(&raw), raw };
        self.cache.write().insert(file_path.to_string(), entry.clone());
        Some(entry)
    }

    pub fn prime(&self, items: &[MdFile]) {
        let paths = items.iter()
            .filter(|item| !item.fs_path.is_empty() && can_search_file_contents(&item.fs_path))
            .map(|item| item.fs_path.clone())
            .collect::<HashSet<_>>();
        for (index, path) in paths.iter().enumerate() {
            let _ = self.get_entry(path);
            if (index + 1) % PRIME_BATCH_SIZE == 0 { std::thread::yield_now(); }
        }
    }

    pub fn search(&self, query: &str, items: &[MdFile], limit: usize) -> Vec<WorkspaceSearchResult> {
        let norm_query = if query.len() < 2 { return vec![] } else { normalize_for_search(query) };
        if norm_query.is_empty() { return vec![]; }
        let mut scored = Vec::new();
        for item in items {
            if should_skip_search_item(item) { continue; }
            let file_name = if item.file_name.is_empty() {
                Path::new(&item.fs_path).file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_default()
            } else { item.file_name.clone() };
            let relative_path = if item.relative_path.is_empty() { file_name.clone() } else { item.relative_path.clone() };
            let title = if item.title.is_empty() { strip_known_extension(&file_name) } else { item.title.clone() };
            let base_score = score_item_name(&title, &file_name, &relative_path, &norm_query);
            if can_search_file_contents(&item.fs_path) {
                if let Some(entry) = self.get_entry(&item.fs_path) {
                    let mut next_index = 0;
                    let mut found_any = false;
                    for ordinal in 0..MAX_SYNC_MATCHES_PER_FILE {
                        let Some(match_result) = entry.haystack.index_of_normalized(&norm_query, next_index) else { break };
                        found_any = true;
                        let mut result = make_result(item, &title, &file_name, &relative_path);
                        result.excerpt = Some(make_search_excerpt(&entry.raw, match_result.hit.index, match_result.hit.match_length));
                        result.match_index = Some(match_result.hit.index);
                        result.match_ordinal = Some(ordinal);
                        result.match_length = Some(match_result.hit.match_length);
                        result.line_number = Some(entry.raw[..match_result.hit.index].split('\n').count());
                        scored.push(ScoredResult { result, score: base_score as f64 + 3.0 - (ordinal.min(20) as f64) / 100.0 });
                        next_index = match_result.next_norm_index;
                    }
                    if found_any { continue; }
                }
            }
            if base_score > 0 {
                scored.push(ScoredResult { result: make_result(item, &title, &file_name, &relative_path), score: base_score as f64 });
            }
        }
        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(limit).map(|item| item.result).collect()
    }
}
