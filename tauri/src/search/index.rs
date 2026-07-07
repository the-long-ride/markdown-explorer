use crate::search::unicode::{normalize_for_search, prepare_haystack, PreparedHaystack};
use crate::workspace::file_types::{is_markdown_file_path, strip_known_extension, extension, EXTRA_DOCUMENT_EXTENSIONS};
use crate::workspace::scanner::{DocumentKind, MdFile};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::Arc;

const MAX_INDEXABLE_BYTES: u64 = 2 * 1024 * 1024;
const PRIME_BATCH_SIZE: usize = 5;
const MAX_SYNC_MATCHES_PER_FILE: usize = 10000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
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
    if item.fs_path.is_empty() || !Path::new(&item.fs_path).exists() {
        return true;
    }
    !is_known_supported_file_path(&item.fs_path)
}

fn score_item_name(title: &str, file_name: &str, relative_path: &str, norm_query: &str) -> i32 {
    let title_score = if normalize_for_search(title).contains(norm_query) { 5 } else { 0 };
    let file_name_score = if normalize_for_search(file_name).contains(norm_query) { 4 } else { 0 };
    let path_score = if normalize_for_search(relative_path).contains(norm_query) { 2 } else { 0 };
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
    let before_text: String = text[..index.min(text.len())]
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let match_text: String = text[index.min(text.len())..end]
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let after_text: String = text[end..]
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    let before_words: Vec<&str> = if before_text.is_empty() { vec![] } else { before_text.split(' ').collect() };
    let after_words: Vec<&str> = if after_text.is_empty() { vec![] } else { after_text.split(' ').collect() };

    let mut parts: Vec<String> = Vec::new();
    if before_words.len() > 10 { parts.push("...".to_string()); }
    parts.extend(before_words.iter().rev().take(10).rev().map(|s| s.to_string()));
    if !match_text.is_empty() { parts.push(match_text); }
    parts.extend(after_words.iter().take(10).map(|s| s.to_string()));
    if after_words.len() > 10 { parts.push("...".to_string()); }

    parts.join(" ").trim().to_string()
}

fn make_result(item: &MdFile, title: &str, file_name: &str, relative_path: &str) -> WorkspaceSearchResult {
    WorkspaceSearchResult {
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
        if metadata.len() > MAX_INDEXABLE_BYTES {
            return None;
        }
        let mtime_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let size = metadata.len();

        {
            let cache = self.cache.read();
            if let Some(entry) = cache.get(file_path) {
                if entry.mtime_ms == mtime_ms && entry.size == size {
                    return Some(entry.clone());
                }
            }
        }

        let raw = fs::read_to_string(file_path).ok()?;
        let haystack = prepare_haystack(&raw);
        let entry = SearchEntry { mtime_ms, size, raw, haystack };
        {
            let mut cache = self.cache.write();
            cache.insert(file_path.to_string(), entry.clone());
        }
        Some(entry)
    }

    pub fn prime(&self, items: &[MdFile]) {
        let paths: Vec<String> = items
            .iter()
            .filter(|item| !item.fs_path.is_empty() && can_search_file_contents(&item.fs_path))
            .map(|item| item.fs_path.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let mut count = 0;
        for path in &paths {
            let _ = self.get_entry(path);
            count += 1;
            if count % PRIME_BATCH_SIZE == 0 {
                std::thread::yield_now();
            }
        }
    }

    pub fn search(&self, query: &str, items: &[MdFile], limit: usize) -> Vec<WorkspaceSearchResult> {
        let norm_query = if query.len() < 2 { return vec![]; } else { normalize_for_search(query) };
        if norm_query.is_empty() { return vec![]; }

        let mut scored: Vec<ScoredResult> = Vec::new();

        for item in items {
            if should_skip_search_item(item) { continue; }

            let file_name = if item.file_name.is_empty() {
                Path::new(&item.fs_path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
            } else {
                item.file_name.clone()
            };
            let relative_path = if item.relative_path.is_empty() { file_name.clone() } else { item.relative_path.clone() };
            let title = if item.title.is_empty() { strip_known_extension(&file_name) } else { item.title.clone() };
            let base_score = score_item_name(&title, &file_name, &relative_path, &norm_query);

            if can_search_file_contents(&item.fs_path) {
                if let Some(entry) = self.get_entry(&item.fs_path) {
                    let raw = &entry.raw;
                    let mut next_norm_index = 0;
                    let mut ordinal = 0;
                    let mut found_any = false;

                    while ordinal < MAX_SYNC_MATCHES_PER_FILE {
                        let result = match entry.haystack.index_of_normalized(&norm_query, next_norm_index) {
                            Some(r) => r,
                            None => break,
                        };
                        found_any = true;
                        let line_number = raw[..result.hit.index].split('\n').count();
                        let excerpt = make_search_excerpt(raw, result.hit.index, result.hit.match_length);
                        let score = base_score as f64 + 3.0 - (ordinal.min(20) as f64) / 100.0;

                        let mut result_item = make_result(item, &title, &file_name, &relative_path);
                        result_item.excerpt = Some(excerpt);
                        result_item.match_index = Some(result.hit.index);
                        result_item.match_ordinal = Some(ordinal);
                        result_item.match_length = Some(result.hit.match_length);
                        result_item.line_number = Some(line_number);

                        scored.push(ScoredResult { result: result_item, score });

                        ordinal += 1;
                        next_norm_index = result.next_norm_index;
                    }

                    if found_any { continue; }
                }
            }

            if base_score > 0 {
                let result_item = make_result(item, &title, &file_name, &relative_path);
                scored.push(ScoredResult { result: result_item, score: base_score as f64 });
            }
        }

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(limit).map(|s| s.result).collect()
    }

    pub async fn search_incremental(
        &self,
        query: &str,
        items: Vec<MdFile>,
        options: IncrementalOptions,
    ) -> IncrementalSummary {
        let norm_query = if query.len() < 2 {
            return IncrementalSummary { total: 0, truncated: false, cancelled: false };
        } else {
            normalize_for_search(query)
        };
        if norm_query.is_empty() {
            return IncrementalSummary { total: 0, truncated: false, cancelled: false };
        }

        let mut batch: Vec<ScoredResult> = Vec::new();
        let mut total = 0;
        let mut work_since_yield = 0;
        let mut truncated = false;

        for item in &items {
            if (options.should_cancel)() {
                flush_batch(&mut batch, &options.on_batch);
                return IncrementalSummary { total, truncated, cancelled: true };
            }
            if should_skip_search_item(item) { continue; }

            let file_name = if item.file_name.is_empty() {
                Path::new(&item.fs_path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
            } else {
                item.file_name.clone()
            };
            let relative_path = if item.relative_path.is_empty() { file_name.clone() } else { item.relative_path.clone() };
            let title = if item.title.is_empty() { strip_known_extension(&file_name) } else { item.title.clone() };
            let base_score = score_item_name(&title, &file_name, &relative_path, &norm_query);
            let mut match_count = 0;

            if can_search_file_contents(&item.fs_path) {
                if let Some(entry) = self.get_entry(&item.fs_path) {
                    let raw = &entry.raw;
                    let mut next_norm_index = 0;
                    let mut ordinal = 0;
                    let mut line_number = 1;
                    let mut line_cursor = 0;

                    while match_count < options.max_matches_per_file {
                        let result = match entry.haystack.index_of_normalized(&norm_query, next_norm_index) {
                            Some(r) => r,
                            None => break,
                        };

                        let mut next_line_break = raw[line_cursor..].find('\n').map(|p| p + line_cursor);
                        while let Some(nlb) = next_line_break {
                            if nlb < result.hit.index {
                                line_number += 1;
                                line_cursor = nlb + 1;
                                next_line_break = raw[line_cursor..].find('\n').map(|p| p + line_cursor);
                            } else {
                                break;
                            }
                        }

                        let excerpt = make_search_excerpt(raw, result.hit.index, result.hit.match_length);
                        let score = base_score as f64 + 3.0 - (ordinal.min(20) as f64) / 100.0;

                        let mut result_item = make_result(item, &title, &file_name, &relative_path);
                        result_item.excerpt = Some(excerpt);
                        result_item.match_index = Some(result.hit.index);
                        result_item.match_ordinal = Some(ordinal);
                        result_item.match_length = Some(result.hit.match_length);
                        result_item.line_number = Some(line_number);

                        if total >= options.max_results {
                            truncated = true;
                            flush_batch(&mut batch, &options.on_batch);
                            return IncrementalSummary { total, truncated, cancelled: false };
                        }

                        batch.push(ScoredResult { result: result_item, score });
                        total += 1;
                        if batch.len() >= options.batch_size {
                            flush_batch(&mut batch, &options.on_batch);
                        }

                        match_count += 1;
                        ordinal += 1;
                        next_norm_index = result.next_norm_index;

                        work_since_yield += 1;
                        if work_since_yield >= options.yield_every {
                            work_since_yield = 0;
                            tokio::task::yield_now().await;
                            if (options.should_cancel)() {
                                flush_batch(&mut batch, &options.on_batch);
                                return IncrementalSummary { total, truncated, cancelled: true };
                            }
                        }
                    }

                    if match_count >= options.max_matches_per_file {
                        truncated = true;
                    }
                }
            }

            if match_count == 0 && base_score > 0 {
                if total >= options.max_results {
                    truncated = true;
                    flush_batch(&mut batch, &options.on_batch);
                    return IncrementalSummary { total, truncated, cancelled: false };
                }
                let result_item = make_result(item, &title, &file_name, &relative_path);
                batch.push(ScoredResult { result: result_item, score: base_score as f64 });
                total += 1;
                if batch.len() >= options.batch_size {
                    flush_batch(&mut batch, &options.on_batch);
                }
            }

            work_since_yield += 1;
            if work_since_yield >= options.yield_every {
                work_since_yield = 0;
                tokio::task::yield_now().await;
                if (options.should_cancel)() {
                    flush_batch(&mut batch, &options.on_batch);
                    return IncrementalSummary { total, truncated, cancelled: true };
                }
            }
        }

        flush_batch(&mut batch, &options.on_batch);
        IncrementalSummary { total, truncated, cancelled: false }
    }
}

fn flush_batch(batch: &mut Vec<ScoredResult>, on_batch: &dyn Fn(Vec<WorkspaceSearchResult>)) {
    if batch.is_empty() { return; }
    batch.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    let drained: Vec<_> = batch.drain(..).map(|s| s.result).collect();
    on_batch(drained);
}

pub struct IncrementalOptions {
    pub batch_size: usize,
    pub max_results: usize,
    pub max_matches_per_file: usize,
    pub yield_every: usize,
    pub should_cancel: Box<dyn Fn() -> bool + Send + Sync>,
    pub on_batch: Box<dyn Fn(Vec<WorkspaceSearchResult>) + Send + Sync>,
}

impl Default for IncrementalOptions {
    fn default() -> Self {
        Self {
            batch_size: 100,
            max_results: 2000,
            max_matches_per_file: 200,
            yield_every: 25,
            should_cancel: Box::new(|| false),
            on_batch: Box::new(|_| {}),
        }
    }
}

#[derive(Debug)]
pub struct IncrementalSummary {
    pub total: usize,
    pub truncated: bool,
    pub cancelled: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &std::path::Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn make_item(path: &std::path::Path, title: &str) -> MdFile {
        MdFile {
            fs_path: path.to_string_lossy().to_string(),
            relative_path: path.file_name().unwrap().to_string_lossy().to_string(),
            parts: vec![path.file_name().unwrap().to_string_lossy().to_string()],
            file_name: path.file_name().unwrap().to_string_lossy().to_string(),
            title: title.to_string(),
            extension: extension(path.to_string_lossy().as_ref()),
            document_kind: DocumentKind::Markdown,
        }
    }

    #[test]
    fn short_query_returns_empty() {
        let idx = SearchIndex::default();
        let results = idx.search("a", &[], 10000);
        assert!(results.is_empty());
    }

    #[test]
    fn search_finds_title_and_content_matches() {
        let root = temp_dir("search-idx");
        let guide = root.join("guide.md");
        let notes = root.join("notes.md");
        write(&guide, "# Performance Guide\n\nStartup performance matters here.");
        write(&notes, "# Notes\n\nThis file also mentions performance tuning.");

        let items = vec![make_item(&notes, "Notes"), make_item(&guide, "Performance Guide")];
        let idx = SearchIndex::default();
        let results = idx.search("performance", &items, 10000);

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].fs_path, guide.to_string_lossy());
        assert_eq!(results[1].fs_path, guide.to_string_lossy());
        assert_eq!(results[2].fs_path, notes.to_string_lossy());
        assert!(results[0].excerpt.as_ref().unwrap().contains("performance"));
    }

    #[test]
    fn search_skips_oversized_files() {
        let root = temp_dir("search-large");
        let file = root.join("large.md");
        let content = format!("# Big File\n\n{}", "lorem ipsum ".repeat(300000));
        write(&file, &content);

        let items = vec![make_item(&file, "Big File")];
        let idx = SearchIndex::default();
        let results = idx.search("needle", &items, 10000);
        assert!(results.is_empty());
    }

    #[test]
    fn search_handles_turkish_and_german() {
        let root = temp_dir("search-multi");
        let tr = root.join("turkish.md");
        let de = root.join("german.md");
        write(&tr, "Welcome to \u{0130}stanbul.");
        write(&de, "Die Hauptstra\u{00DF}e ist lang.");

        let items = vec![make_item(&tr, "Turkish"), make_item(&de, "German")];
        let idx = SearchIndex::default();

        let tr_results = idx.search("istanbul", &items, 10000);
        assert_eq!(tr_results.len(), 1);
        assert!(tr_results[0].excerpt.as_ref().unwrap().contains("\u{0130}stanbul"));

        let de_results = idx.search("strasse", &items, 10000);
        assert_eq!(de_results.len(), 1);
        assert!(de_results[0].excerpt.as_ref().unwrap().contains("stra\u{00DF}e"));
    }

    #[test]
    fn can_search_file_contents_markdown_and_txt_only() {
        assert!(can_search_file_contents("readme.md"));
        assert!(can_search_file_contents("notes.txt"));
        assert!(!can_search_file_contents("report.docx"));
    }

    #[test]
    fn excerpt_truncates_long_text() {
        let words: Vec<String> = (0..50).map(|i| format!("word{i}")).collect();
        let text = format!("{} match {}", words.join(" "), words.join(" "));
        let excerpt = make_search_excerpt(&text, text.find("match").unwrap(), 5);
        assert!(excerpt.starts_with("..."));
        assert!(excerpt.ends_with("..."));
    }

    #[test]
    fn nfc_nfd_search_equivalence() {
        let root = temp_dir("search-norm");
        let nfc = root.join("nfc.md");
        let nfd = root.join("nfd.md");
        write(&nfc, "I love caf\u{00E9}s.");
        write(&nfd, "Let's go to the cafe\u{0301}.");

        let items = vec![make_item(&nfc, "NFC"), make_item(&nfd, "NFD")];
        let idx = SearchIndex::default();

        let results = idx.search("caf\u{00E9}", &items, 10000);
        assert_eq!(results.len(), 2);
    }
}
