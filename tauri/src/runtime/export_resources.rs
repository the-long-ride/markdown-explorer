use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExportResourceInfo {
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportResourceRead {
    pub relative_path: String,
    pub mime_type: String,
    pub data_base64: String,
}

pub fn list_workspace_resources(_workspace_path: &Path) -> Result<Vec<ExportResourceInfo>, String> {
    todo!("implement workspace resource listing")
}

pub fn read_workspace_resource(
    _workspace_path: &Path,
    _document_path: Option<&str>,
    _resource_path: &str,
) -> Result<ExportResourceRead, &'static str> {
    todo!("implement workspace resource reading")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write(root: &Path, relative: &str, bytes: &[u8]) -> std::path::PathBuf {
        let target = root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&target, bytes).unwrap();
        target
    }

    #[test]
    fn lists_regular_files_recursively_and_omits_git() {
        let dir = tempdir().unwrap();
        write(dir.path(), "README.md", b"# Docs");
        write(dir.path(), "assets/logo.png", &[1, 2, 3]);
        write(dir.path(), "examples/demo.json", br#"{"ok":true}"#);
        write(dir.path(), ".git/config", b"[core]");

        let resources = list_workspace_resources(dir.path()).unwrap();
        let paths = resources
            .iter()
            .map(|item| item.relative_path.as_str())
            .collect::<Vec<_>>();
        assert_eq!(paths, vec!["README.md", "assets/logo.png", "examples/demo.json"]);
        assert_eq!(
            resources
                .iter()
                .find(|item| item.relative_path == "assets/logo.png")
                .unwrap()
                .size,
            3
        );
    }

    #[test]
    fn reads_document_relative_binary_resource() {
        let dir = tempdir().unwrap();
        let document = write(dir.path(), "docs/readme.md", b"# Readme");
        write(dir.path(), "assets/logo.png", &[1, 2, 3, 255]);

        let result = read_workspace_resource(
            dir.path(),
            document.to_str(),
            "../assets/logo.png",
        )
        .unwrap();

        assert_eq!(result.relative_path, "assets/logo.png");
        assert_eq!(result.mime_type, "image/png");
        assert_eq!(result.data_base64, "AQID/w==");
    }

    #[test]
    fn rejects_paths_outside_workspace() {
        let workspace = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let outside_file = write(outside.path(), "secret.txt", b"secret");
        let document = write(workspace.path(), "docs/readme.md", b"# Readme");

        assert_eq!(
            read_workspace_resource(
                workspace.path(),
                document.to_str(),
                outside_file.to_str().unwrap(),
            )
            .unwrap_err(),
            "outside-workspace"
        );
    }

    #[test]
    fn returns_missing_for_contained_missing_resource() {
        let dir = tempdir().unwrap();
        assert_eq!(
            read_workspace_resource(dir.path(), None, "assets/missing.svg").unwrap_err(),
            "missing"
        );
    }
}
