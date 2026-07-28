pub fn normalize(markdown: &str) -> String {
    let normalized = markdown.replace("\r\n", "\n").replace('\r', "\n");
    let mut output = String::with_capacity(normalized.len());
    let mut blank_lines = 0usize;

    for line in normalized.lines() {
        let clean = line.trim_end();
        if clean.is_empty() {
            blank_lines += 1;
            if blank_lines <= 2 && !output.is_empty() {
                output.push('\n');
            }
        } else {
            blank_lines = 0;
            output.push_str(clean);
            output.push('\n');
        }
    }

    output.trim().to_string()
}

pub fn escape_table_cell(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('|', "\\|")
        .replace("\r\n", "<br>")
        .replace('\r', "<br>")
        .replace('\n', "<br>")
        .trim()
        .to_string()
}

pub fn escape_inline(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('*', "\\*")
        .replace('_', "\\_")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_caps_repeated_blank_lines_and_crlf() {
        assert_eq!(normalize("A\r\n\r\n\r\n\r\nB  \r\n"), "A\n\n\nB");
    }

    #[test]
    fn table_cells_escape_pipes_and_line_breaks() {
        assert_eq!(escape_table_cell("A|B\nC"), "A\\|B<br>C");
    }
}
