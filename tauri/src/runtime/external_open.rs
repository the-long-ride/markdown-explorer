use std::path::{Path, PathBuf};

pub fn parse_external_open_path(argv: &[String]) -> Option<PathBuf> {
    argv.iter().skip(1).find_map(|value| {
        if value.starts_with('-') {
            return None;
        }
        let path = Path::new(value);
        if path.is_dir() || (path.is_file() && matches!(path.extension().and_then(|ext| ext.to_str()), Some(ext) if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("mdx"))) {
            Some(path.to_path_buf())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn accepts_markdown_file_and_folder_but_ignores_flags() {
        let dir = std::env::temp_dir().join("markdown-explorer-external-open");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("guide.mdx");
        fs::write(&file, "# Guide").unwrap();
        assert_eq!(parse_external_open_path(&vec!["app".into(), "--squirrel-firstrun".into(), file.to_string_lossy().into_owned()]), Some(file));
        assert_eq!(parse_external_open_path(&vec!["app".into(), dir.to_string_lossy().into_owned()]), Some(dir.clone()));
        let _ = fs::remove_dir_all(dir);
    }
}
