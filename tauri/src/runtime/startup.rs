use crate::workspace::recents::RecentWorkspace;
use serde_json::{json, Value};
use std::path::Path;

pub fn create_startup_ready_ack(
    workspace_path: Option<&Path>,
    recent_workspaces: Vec<RecentWorkspace>,
    document_conversion_enabled: bool,
    host_platform: &str,
    host_arch: &str,
    is_maximized: bool,
    app_version: &str,
) -> Value {
    let workspace_name = workspace_path
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let workspace_path_str = workspace_path.map(|p| p.to_string_lossy().to_string());

    let mut payload = json!({
        "command": "readyAck",
        "fileList": [],
        "tree": null,
        "theme": "dark",
        "themeStyle": "default",
        "defaultExpanded": true,
        "workspaceName": workspace_name,
        "recentWorkspaces": recent_workspaces,
        "documentConversionEnabled": document_conversion_enabled,
        "appRuntime": "tauri",
        "appVersion": app_version,
        "hostPlatform": host_platform,
        "hostArch": host_arch,
        "isMaximized": is_maximized,
    });

    if let Some(ref ws) = workspace_path_str {
        payload["workspacePath"] = json!(ws);
    }

    payload
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn ready_ack_with_workspace() {
        let recents = vec![RecentWorkspace {
            name: "Workspace A".to_string(),
            path: "/ws/a".to_string(),
            last_opened: 1000,
        }];
        let result = create_startup_ready_ack(
            Some(Path::new("/ws/project")),
            recents,
            true,
            "win32",
            "x64",
            false,
            "1.2.3-test",
        );
        assert_eq!(result["command"], "readyAck");
        assert_eq!(result["appRuntime"], "tauri");
        assert_eq!(result["appVersion"], "1.2.3-test");
        assert_eq!(result["workspaceName"], "project");
        assert!(result["workspacePath"].is_string());
        assert_eq!(result["documentConversionEnabled"], true);
        assert_eq!(result["hostPlatform"], "win32");
        assert_eq!(result["hostArch"], "x64");
        assert_eq!(result["isMaximized"], false);
        assert!(result["recentWorkspaces"].is_array());
    }

    #[test]
    fn ready_ack_without_workspace() {
        let result =
            create_startup_ready_ack(None, vec![], false, "linux", "arm64", true, "1.2.3-test");
        assert_eq!(result["workspaceName"], "");
        assert_eq!(result["appVersion"], "1.2.3-test");
        assert!(result.get("workspacePath").is_none());
        assert!(!result["workspacePath"].is_string());
        assert_eq!(result["documentConversionEnabled"], false);
        assert_eq!(result["isMaximized"], true);
        assert_eq!(result["hostPlatform"], "linux");
    }

    #[test]
    fn ready_ack_has_theme_and_tree() {
        let result =
            create_startup_ready_ack(None, vec![], true, "win32", "x64", false, "1.2.3-test");
        assert_eq!(result["theme"], "dark");
        assert_eq!(result["themeStyle"], "default");
        assert_eq!(result["defaultExpanded"], true);
        assert!(result["fileList"].is_array());
    }

    #[test]
    fn ready_ack_workspace_name_from_path() {
        let result = create_startup_ready_ack(
            Some(Path::new("/some/deep/path/my-project")),
            vec![],
            false,
            "darwin",
            "arm64",
            false,
            "1.2.3-test",
        );
        assert_eq!(result["workspaceName"], "my-project");
    }

    #[test]
    fn ready_ack_recent_workspaces_serialized() {
        let recents = vec![
            RecentWorkspace {
                name: "A".to_string(),
                path: "/ws/a".to_string(),
                last_opened: 1000,
            },
            RecentWorkspace {
                name: "B".to_string(),
                path: "/ws/b".to_string(),
                last_opened: 2000,
            },
        ];
        let result =
            create_startup_ready_ack(None, recents, false, "win32", "x64", false, "1.2.3-test");
        let arr = result["recentWorkspaces"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["name"], "A");
        assert_eq!(arr[1]["path"], "/ws/b");
    }
}
