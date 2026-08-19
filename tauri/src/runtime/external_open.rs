use std::path::{Path, PathBuf};

const OPEN_WITH_FOLDER_FLAG: &str = "--open-with-folder";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ExternalOpenRequest {
    File { file_path: PathBuf },
    Folder { folder_path: PathBuf },
    FileWithParentWorkspace { file_path: PathBuf, folder_path: PathBuf },
}

impl ExternalOpenRequest {
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            Self::File { file_path } => serde_json::json!({
                "mode": "file",
                "filePath": file_path.to_string_lossy(),
            }),
            Self::Folder { folder_path } => serde_json::json!({
                "mode": "folder",
                "folderPath": folder_path.to_string_lossy(),
            }),
            Self::FileWithParentWorkspace { file_path, folder_path } => serde_json::json!({
                "mode": "file-with-parent-workspace",
                "filePath": file_path.to_string_lossy(),
                "folderPath": folder_path.to_string_lossy(),
            }),
        }
    }

    pub fn primary_path(&self) -> &Path {
        match self {
            Self::File { file_path } | Self::FileWithParentWorkspace { file_path, .. } => file_path,
            Self::Folder { folder_path } => folder_path,
        }
    }
}

fn is_markdown_file(path: &Path) -> bool {
    path.is_file()
        && matches!(path.extension().and_then(|ext| ext.to_str()), Some(ext) if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("mdx"))
}

pub fn request_for_path(path: &Path) -> Option<ExternalOpenRequest> {
    if path.is_dir() {
        return Some(ExternalOpenRequest::Folder { folder_path: path.to_path_buf() });
    }
    if is_markdown_file(path) {
        return Some(ExternalOpenRequest::File { file_path: path.to_path_buf() });
    }
    None
}

pub fn parse_external_open_request(argv: &[String]) -> Option<ExternalOpenRequest> {
    let args = argv.iter().skip(1).collect::<Vec<_>>();
    if let Some(index) = args.iter().position(|value| value.as_str() == OPEN_WITH_FOLDER_FLAG) {
        let file_path = Path::new(args.get(index + 1)?.as_str());
        if !is_markdown_file(file_path) {
            return None;
        }
        return Some(ExternalOpenRequest::FileWithParentWorkspace {
            file_path: file_path.to_path_buf(),
            folder_path: file_path.parent()?.to_path_buf(),
        });
    }

    args.into_iter().find_map(|value| {
        if value.starts_with('-') {
            return None;
        }
        request_for_path(Path::new(value))
    })
}

pub fn parse_external_open_path(argv: &[String]) -> Option<PathBuf> {
    parse_external_open_request(argv).map(|request| request.primary_path().to_path_buf())
}

pub fn emit_external_open_request(app: &tauri::AppHandle, request: &ExternalOpenRequest) {
    let mut extra = serde_json::Map::new();
    extra.insert("request".into(), request.to_json());
    crate::host_message::emit(app, "externalOpenRequest", extra);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_plain_file_folder_and_parent_workspace_modes() {
        let dir = std::env::temp_dir().join("markdown-explorer-external-open");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("guide.mdx");
        let text = dir.join("notes.txt");
        fs::write(&file, "# Guide").unwrap();
        fs::write(&text, "notes").unwrap();

        assert_eq!(
            parse_external_open_request(&[
                "app".into(),
                "--squirrel-firstrun".into(),
                file.to_string_lossy().into_owned(),
            ]),
            Some(ExternalOpenRequest::File { file_path: file.clone() })
        );
        assert_eq!(
            parse_external_open_request(&["app".into(), dir.to_string_lossy().into_owned()]),
            Some(ExternalOpenRequest::Folder { folder_path: dir.clone() })
        );
        assert_eq!(
            parse_external_open_request(&[
                "app".into(),
                OPEN_WITH_FOLDER_FLAG.into(),
                file.to_string_lossy().into_owned(),
            ]),
            Some(ExternalOpenRequest::FileWithParentWorkspace {
                file_path: file.clone(),
                folder_path: dir.clone(),
            })
        );
        assert_eq!(
            parse_external_open_request(&[
                "app".into(),
                OPEN_WITH_FOLDER_FLAG.into(),
                text.to_string_lossy().into_owned(),
            ]),
            None
        );
        let _ = fs::remove_dir_all(dir);
    }
}
