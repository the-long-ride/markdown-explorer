use super::{markdown::normalize, ConversionError, ConversionOutput, ConversionQuality};
use std::path::Path;

const HIDDEN_TAGS: [&str; 4] = ["script", "style", "noscript", "template"];

pub fn convert(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let html = std::fs::read_to_string(path)?;
    Ok(ConversionOutput {
        markdown: convert_html(&html),
        quality: ConversionQuality::Standard,
    })
}

fn convert_html(html: &str) -> String {
    normalize(&html2markdown::convert(&strip_hidden_elements(html)))
}

fn strip_hidden_elements(html: &str) -> String {
    let lower = html.to_ascii_lowercase();
    let mut output = String::with_capacity(html.len());
    let mut cursor = 0usize;

    while cursor < html.len() {
        let next = HIDDEN_TAGS
            .iter()
            .filter_map(|tag| find_open_tag(&lower, cursor, tag).map(|start| (start, *tag)))
            .min_by_key(|(start, _)| *start);
        let Some((start, tag)) = next else {
            output.push_str(&html[cursor..]);
            break;
        };
        output.push_str(&html[cursor..start]);
        let close = format!("</{tag}>");
        if let Some(close_offset) = lower[start..].find(&close) {
            cursor = start + close_offset + close.len();
        } else {
            break;
        }
    }

    output
}

fn find_open_tag(html: &str, from: usize, tag: &str) -> Option<usize> {
    let needle = format!("<{tag}");
    let mut search_from = from;

    while let Some(offset) = html[search_from..].find(&needle) {
        let start = search_from + offset;
        let boundary = html.as_bytes().get(start + needle.len()).copied();
        if matches!(
            boundary,
            Some(b'>') | Some(b'/') | Some(b' ') | Some(b'\t') | Some(b'\r') | Some(b'\n')
        ) {
            return Some(start);
        }
        search_from = start + needle.len();
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn omits_hidden_content_and_keeps_document_structure() {
        let markdown = convert_html(
            r#"<style>.bad{}</style><h1>Title</h1><script>alert(1)</script><ul><li>One</li></ul><a href="https://example.com">Link</a><pre><code>let x = 1;</code></pre>"#,
        );
        assert!(markdown.contains("# Title"));
        assert!(markdown.contains("One"));
        assert!(markdown.contains("https://example.com"));
        assert!(markdown.contains("let x = 1"));
        assert!(!markdown.contains("alert(1)"));
        assert!(!markdown.contains(".bad"));
    }

    #[test]
    fn hidden_element_matching_is_case_insensitive() {
        assert_eq!(strip_hidden_elements("A<SCRIPT>x</SCRIPT>B"), "AB");
    }

    #[test]
    fn hidden_element_matching_requires_a_tag_name_boundary() {
        assert_eq!(
            strip_hidden_elements("<scripture>Keep</scripture><script>Drop</script>"),
            "<scripture>Keep</scripture>"
        );
    }
}
