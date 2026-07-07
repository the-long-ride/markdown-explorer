use unicode_normalization::UnicodeNormalization;

pub fn normalize_for_search(text: &str) -> String {
    text.nfc()
        .collect::<String>()
        .to_uppercase()
        .to_lowercase()
        .replace('\u{0307}', "")
}

#[derive(Debug, Clone)]
pub struct SearchMatch {
    pub index: usize,
    pub match_length: usize,
}

#[derive(Debug, Clone)]
pub struct NormalizedSearchResult {
    pub hit: SearchMatch,
    pub next_norm_index: usize,
}

#[derive(Debug, Clone)]
pub struct PreparedHaystack {
    pub normalized_text: String,
    to_original: Option<Vec<usize>>,
    original: String,
}

fn char_to_byte_offset(s: &str, char_idx: usize) -> usize {
    s.char_indices()
        .nth(char_idx)
        .map(|(i, _)| i)
        .unwrap_or_else(|| s.len())
}

fn compute_orig_end(to_original: &[usize], n_norm: usize, original_len: usize, norm_end: usize) -> usize {
    if norm_end >= n_norm {
        return original_len;
    }
    let prev = norm_end.checked_sub(1).and_then(|i| to_original.get(i).copied()).unwrap_or(0);
    let mut k = norm_end;
    while k < n_norm {
        let val = to_original.get(k).copied().unwrap_or(0);
        if val != prev {
            break;
        }
        k += 1;
    }
    if k < n_norm {
        to_original.get(k).copied().unwrap_or(original_len)
    } else {
        original_len
    }
}

fn map_span(
    to_original: &Option<Vec<usize>>,
    original: &str,
    normalized_text: &str,
    norm_idx: usize,
    norm_len: usize,
) -> (usize, usize) {
    match to_original {
        None => {
            let orig_idx = char_to_byte_offset(original, norm_idx);
            let orig_end = char_to_byte_offset(original, norm_idx + norm_len);
            (orig_idx, orig_end.saturating_sub(orig_idx))
        }
        Some(map) => {
            let orig_idx = map.get(norm_idx).copied().unwrap_or(norm_idx);
            let norm_end = norm_idx + norm_len;
            let n_norm = normalized_text.chars().count();
            let orig_end = compute_orig_end(map, n_norm, original.len(), norm_end);
            (orig_idx, orig_end.saturating_sub(orig_idx))
        }
    }
}

fn build_norm_map(original: &str) -> PreparedHaystack {
    let normalized_text = normalize_for_search(original);
    let n_norm = normalized_text.chars().count();
    let n_orig = original.chars().count();

    if n_norm == n_orig {
        return PreparedHaystack {
            normalized_text,
            to_original: None,
            original: original.to_string(),
        };
    }

    let mut to_original = vec![0usize; n_norm];
    let mut accumulated = String::new();
    let mut last_norm_len = 0usize;

    for (orig_byte_pos, orig_char) in original.char_indices() {
        accumulated.push(orig_char);
        let current_norm = normalize_for_search(&accumulated);
        let current_norm_len = current_norm.chars().count();
        for k in last_norm_len..current_norm_len.min(n_norm) {
            to_original[k] = orig_byte_pos;
        }
        last_norm_len = current_norm_len;
    }

    PreparedHaystack {
        normalized_text,
        to_original: Some(to_original),
        original: original.to_string(),
    }
}

fn find_subsequence(haystack: &[char], needle: &[char], from: usize) -> Option<usize> {
    if needle.is_empty() || from >= haystack.len() {
        return None;
    }
    if needle.len() > haystack.len() - from {
        return None;
    }
    haystack[from..]
        .windows(needle.len())
        .position(|w| w == needle)
        .map(|p| p + from)
}

pub fn prepare_haystack(text: &str) -> PreparedHaystack {
    build_norm_map(text)
}

impl PreparedHaystack {
    pub fn index_of(&self, needle: &str, norm_from_index: usize) -> Option<SearchMatch> {
        let norm_needle = normalize_for_search(needle);
        if norm_needle.is_empty() {
            return None;
        }
        self.index_of_normalized(&norm_needle, norm_from_index)
            .map(|r| r.hit)
    }

    pub fn index_of_normalized(&self, norm_needle: &str, norm_from_index: usize) -> Option<NormalizedSearchResult> {
        let norm_chars: Vec<char> = self.normalized_text.chars().collect();
        let needle_chars: Vec<char> = norm_needle.chars().collect();

        if needle_chars.is_empty() {
            return None;
        }

        let norm_idx = find_subsequence(&norm_chars, &needle_chars, norm_from_index)?;
        let norm_len = needle_chars.len();

        let (orig_idx, orig_len) = map_span(&self.to_original, &self.original, &self.normalized_text, norm_idx, norm_len);

        Some(NormalizedSearchResult {
            hit: SearchMatch {
                index: orig_idx,
                match_length: orig_len,
            },
            next_norm_index: norm_idx + norm_len,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_combining_dot_above() {
        assert_eq!(normalize_for_search("\u{0130}stanbul"), "istanbul");
    }

    #[test]
    fn normalize_sharp_s_to_ss() {
        assert!(normalize_for_search("Stra\u{00DF}e").contains("strasse"));
    }

    #[test]
    fn normalize_nfc_composes() {
        assert!(normalize_for_search("cafe\u{0301}").contains("caf\u{00E9}"));
    }

    #[test]
    fn normalize_ascii_unchanged() {
        assert_eq!(normalize_for_search("Hello World"), "hello world");
    }

    #[test]
    fn normalize_empty() {
        assert_eq!(normalize_for_search(""), "");
    }

    #[test]
    fn identity_map_when_lengths_equal() {
        let h = prepare_haystack("hello");
        assert!(h.to_original.is_none());
        assert_eq!(h.normalized_text, "hello");
    }

    #[test]
    fn non_identity_map_for_sharp_s() {
        let h = prepare_haystack("Stra\u{00DF}e");
        assert!(h.to_original.is_some());
        assert_eq!(h.normalized_text, "strasse");
    }

    #[test]
    fn index_of_empty_needle_returns_none() {
        let h = prepare_haystack("hello world");
        assert!(h.index_of("", 0).is_none());
    }

    #[test]
    fn index_of_finds_match() {
        let h = prepare_haystack("hello world");
        let r = h.index_of("world", 0).unwrap();
        assert_eq!(r.index, 6);
        assert_eq!(r.match_length, 5);
    }

    #[test]
    fn index_of_no_match_returns_none() {
        let h = prepare_haystack("hello world");
        assert!(h.index_of("xyz", 0).is_none());
    }

    #[test]
    fn index_of_respects_from_index() {
        let h = prepare_haystack("hello hello");
        let first = h.index_of("hello", 0).unwrap();
        let second = h.index_of("hello", first.index + first.match_length).unwrap();
        assert!(second.index > first.index);
    }

    #[test]
    fn index_of_turkish_dotted_i() {
        let h = prepare_haystack("Welcome to \u{0130}stanbul");
        let r = h.index_of("istanbul", 0).unwrap();
        assert_eq!(r.index, 11);
        assert_eq!(r.match_length, 9);
        assert_eq!(&h.original[r.index..r.index + r.match_length], "\u{0130}stanbul");
    }

    #[test]
    fn index_of_german_sharp_s() {
        let h = prepare_haystack("Die Hauptstra\u{00DF}e ist lang");
        let r = h.index_of("strasse", 0);
        assert!(r.is_some());
    }

    #[test]
    fn index_of_normalized_returns_next_norm_index() {
        let h = prepare_haystack("hello hello");
        let r = h.index_of_normalized("hello", 0).unwrap();
        assert_eq!(r.hit.index, 0);
        assert_eq!(r.hit.match_length, 5);
        assert_eq!(r.next_norm_index, 5);
    }

    #[test]
    fn index_of_normalized_finds_subsequent() {
        let h = prepare_haystack("hello hello");
        let first = h.index_of_normalized("hello", 0).unwrap();
        let second = h.index_of_normalized("hello", first.next_norm_index).unwrap();
        assert_eq!(second.hit.index, 6);
    }

    #[test]
    fn repeated_match_count() {
        let h = prepare_haystack("abc abc abc");
        let mut norm_idx = 0;
        let mut count = 0;
        while let Some(r) = h.index_of_normalized("abc", norm_idx) {
            count += 1;
            norm_idx = r.next_norm_index;
        }
        assert_eq!(count, 3);
    }

    #[test]
    fn nfc_nfd_equivalence() {
        let h1 = prepare_haystack("caf\u{00E9}");
        assert!(h1.index_of("caf\u{00E9}", 0).is_some());

        let h2 = prepare_haystack("cafe\u{0301}");
        assert!(h2.index_of("caf\u{00E9}", 0).is_some());
    }

    #[test]
    fn empty_text_returns_none() {
        let h = prepare_haystack("");
        assert!(h.index_of("test", 0).is_none());
        assert!(h.index_of_normalized("test", 0).is_none());
    }

    #[test]
    fn sharp_s_match_returns_correct_substring() {
        let h = prepare_haystack("Stra\u{00DF}e");
        let r = h.index_of("strasse", 0).unwrap();
        assert_eq!(&h.original[r.index..r.index + r.match_length], "Stra\u{00DF}e");
    }

    #[test]
    fn from_index_past_end_returns_none() {
        let h = prepare_haystack("hello");
        assert!(h.index_of_normalized("hello", 100).is_none());
    }

    #[test]
    fn from_index_beyond_match_returns_none() {
        let h = prepare_haystack("Stra\u{00DF}e");
        assert!(h.index_of_normalized("strasse", 7).is_none());
    }

    #[test]
    fn needle_normalizing_to_empty_returns_none() {
        let h = prepare_haystack("hello");
        assert!(h.index_of("\u{0307}", 0).is_none());
    }
}
