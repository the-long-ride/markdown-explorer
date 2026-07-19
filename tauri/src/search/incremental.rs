use super::*;

impl SearchIndex {
    pub fn search_incremental(
        &self,
        query: &str,
        items: Vec<MdFile>,
        options: IncrementalOptions,
    ) -> IncrementalSummary {
        let norm_query = normalize_for_search(query);
        if norm_query.is_empty() || query.len() < 2 {
            return IncrementalSummary {
                total: 0,
                truncated: false,
                cancelled: false,
            };
        }

        let mut batch = Vec::with_capacity(options.batch_size);
        let mut total = 0;
        let mut cancelled = false;
        let mut truncated = false;

        for (index, item) in items.iter().enumerate() {
            if (options.should_cancel)() {
                cancelled = true;
                break;
            }
            if index > 0 && index % options.yield_every.max(1) == 0 {
                std::thread::yield_now();
            }
            if should_skip_search_item(item) {
                continue;
            }

            let file_name = if item.file_name.is_empty() {
                Path::new(&item.fs_path)
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_default()
            } else {
                item.file_name.clone()
            };
            let relative_path = if item.relative_path.is_empty() {
                file_name.clone()
            } else {
                item.relative_path.clone()
            };
            let title = if item.title.is_empty() {
                strip_known_extension(&file_name)
            } else {
                item.title.clone()
            };
            let base_score = score_item_name(&title, &file_name, &relative_path, &norm_query);
            let mut found_any = false;

            if can_search_file_contents(&item.fs_path) {
                if let Some(entry) = self.get_entry(&item.fs_path) {
                    let mut next_norm_index = 0;
                    for ordinal in 0..options.max_matches_per_file {
                        let Some(result) = entry
                            .haystack
                            .index_of_normalized(&norm_query, next_norm_index)
                        else {
                            break;
                        };
                        found_any = true;
                        let mut result_item = make_result(item, &title, &file_name, &relative_path);
                        result_item.excerpt = Some(make_search_excerpt(
                            &entry.raw,
                            result.hit.index,
                            result.hit.match_length,
                        ));
                        result_item.match_index = Some(result.hit.index);
                        result_item.match_ordinal = Some(ordinal);
                        result_item.match_length = Some(result.hit.match_length);
                        result_item.line_number =
                            Some(entry.raw[..result.hit.index].split('\n').count());
                        batch.push(ScoredResult {
                            result: result_item,
                            score: base_score as f64 + 3.0 - (ordinal.min(20) as f64) / 100.0,
                        });
                        total += 1;
                        next_norm_index = result.next_norm_index;
                        if total >= options.max_results {
                            truncated = true;
                            break;
                        }
                        if batch.len() >= options.batch_size.max(1) {
                            flush_batch(&mut batch, &options.on_batch);
                        }
                    }
                }
            }

            if !found_any && base_score > 0 && total < options.max_results {
                batch.push(ScoredResult {
                    result: make_result(item, &title, &file_name, &relative_path),
                    score: base_score as f64,
                });
                total += 1;
                if total >= options.max_results {
                    truncated = true;
                }
            }
            if truncated {
                break;
            }
            if batch.len() >= options.batch_size.max(1) {
                flush_batch(&mut batch, &options.on_batch);
            }
        }

        flush_batch(&mut batch, &options.on_batch);
        IncrementalSummary {
            total,
            truncated,
            cancelled,
        }
    }
}

fn flush_batch(batch: &mut Vec<ScoredResult>, on_batch: &dyn Fn(Vec<WorkspaceSearchResult>)) {
    if batch.is_empty() {
        return;
    }
    batch.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
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
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
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
            tab_id: None,
            tab_label: None,
        }
    }

    #[test]
    fn incremental_flushes_batches() {
        let root = temp_dir("incremental-batch");
        write(&root.join("guide-one.md"), "# Guide One");
        write(&root.join("guide-two.md"), "# Guide Two");
        let items = vec![
            make_item(&root.join("guide-one.md"), "Guide One"),
            make_item(&root.join("guide-two.md"), "Guide Two"),
        ];
        let batches = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let received = std::sync::Arc::clone(&batches);
        let idx = SearchIndex::default();
        let summary = idx.search_incremental(
            "guide",
            items,
            IncrementalOptions {
                batch_size: 1,
                on_batch: Box::new(move |batch| received.lock().unwrap().push(batch)),
                ..Default::default()
            },
        );

        assert_eq!(summary.total, 2);
        assert_eq!(batches.lock().unwrap().len(), 2);
    }

    #[test]
    fn incremental_truncates_at_max_results() {
        let root = temp_dir("incremental-truncate");
        write(&root.join("guide-one.md"), "# Guide One");
        write(&root.join("guide-two.md"), "# Guide Two");
        let items = vec![
            make_item(&root.join("guide-one.md"), "Guide One"),
            make_item(&root.join("guide-two.md"), "Guide Two"),
        ];
        let idx = SearchIndex::default();
        let summary = idx.search_incremental(
            "guide",
            items,
            IncrementalOptions {
                max_results: 1,
                ..Default::default()
            },
        );

        assert_eq!(summary.total, 1);
        assert!(summary.truncated);
    }

    #[test]
    fn incremental_honors_cancellation_before_work() {
        let root = temp_dir("incremental-cancel");
        let items = vec![make_item(&root.join("guide.md"), "Guide")];
        let idx = SearchIndex::default();
        let summary = idx.search_incremental(
            "guide",
            items,
            IncrementalOptions {
                should_cancel: Box::new(|| true),
                ..Default::default()
            },
        );

        assert_eq!(summary.total, 0);
        assert!(summary.cancelled);
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
        write(
            &guide,
            "# Performance Guide\n\nStartup performance matters here.",
        );
        write(
            &notes,
            "# Notes\n\nThis file also mentions performance tuning.",
        );

        let items = vec![
            make_item(&notes, "Notes"),
            make_item(&guide, "Performance Guide"),
        ];
        let idx = SearchIndex::default();
        let results = idx.search("performance", &items, 10000);

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].fs_path, guide.to_string_lossy());
        assert_eq!(results[1].fs_path, guide.to_string_lossy());
        assert_eq!(results[2].fs_path, notes.to_string_lossy());
        assert!(results[0].excerpt.as_ref().unwrap().contains("performance"));
    }

    #[test]
    fn search_preserves_tab_metadata_for_cross_tab_results() {
        let root = temp_dir("search-tab-meta");
        let guide = root.join("guide.md");
        write(&guide, "# Guide\n\nJump target content.");

        let mut item = make_item(&guide, "Guide");
        item.tab_id = Some("tab-1".to_string());
        item.tab_label = Some("Docs".to_string());

        let idx = SearchIndex::default();
        let results = idx.search("target", &[item], 10000);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].tab_id.as_deref(), Some("tab-1"));
        assert_eq!(results[0].tab_label.as_deref(), Some("Docs"));
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
        assert!(tr_results[0]
            .excerpt
            .as_ref()
            .unwrap()
            .contains("\u{0130}stanbul"));

        let de_results = idx.search("strasse", &items, 10000);
        assert_eq!(de_results.len(), 1);
        assert!(de_results[0]
            .excerpt
            .as_ref()
            .unwrap()
            .contains("stra\u{00DF}e"));
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
}
