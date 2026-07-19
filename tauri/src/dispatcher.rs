#![allow(dead_code)]

use crate::app_state::{AppState, FullscreenTransition, RuntimeState};
use crate::host_message;
use crate::runtime::navigation;
use crate::runtime::refresh::{is_watch_change_relevant, should_notify_current_file_changed};
use crate::search::index::SearchIndex;
use crate::search::worker::{create_search_worker, SearchWorkerMessage};
use crate::workspace::file_types::{extension, is_markdown_file_path, strip_known_extension};
use crate::workspace::open::{
    choose_workspace_and_file, get_workspace_path_status, WorkspaceUnavailableReason,
};
use crate::workspace::recents::{RecentWorkspaceInput, RecentWorkspacesStore};
use crate::workspace::scanner::{scan, scan_with_progress, DocumentKind, MdFile, ScanOptions};
use crate::workspace::watch::{WatchChange, WorkspaceWatchController};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Listener, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_opener::OpenerExt;

pub struct Dispatcher {
    pub app: AppHandle,
    pub state: AppState,
}

fn md_file_from_search_payload(item: &Value) -> Option<MdFile> {
    let fs_path = item.get("fsPath").and_then(Value::as_str)?.to_string();
    let file_name = item
        .get("fileName")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            Path::new(&fs_path)
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
        })
        .unwrap_or_default();
    let relative_path = item
        .get("relativePath")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| file_name.clone());
    let title = item
        .get("title")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| strip_known_extension(&file_name));
    let parts = relative_path
        .split(['/', '\\'])
        .filter(|part| !part.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    Some(MdFile {
        fs_path: fs_path.clone(),
        relative_path,
        parts,
        file_name,
        title,
        extension: extension(&fs_path),
        document_kind: if is_markdown_file_path(&fs_path) {
            DocumentKind::Markdown
        } else {
            DocumentKind::Document
        },
        tab_id: item
            .get("tabId")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        tab_label: item
            .get("tabLabel")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    })
}

fn resolve_search_items(items: Option<Value>, flat_list: &[MdFile]) -> Vec<MdFile> {
    match items {
        Some(ref value) if value.is_array() => serde_json::from_value::<Vec<MdFile>>(value.clone())
            .unwrap_or_else(|_| {
                let flat_by_path = flat_list
                    .iter()
                    .map(|file| (file.fs_path.as_str(), file))
                    .collect::<std::collections::HashMap<_, _>>();
                value
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| {
                                let payload = md_file_from_search_payload(item)?;
                                let mut resolved = flat_by_path
                                    .get(payload.fs_path.as_str())
                                    .map(|file| (*file).clone())
                                    .unwrap_or_else(|| payload.clone());
                                resolved.tab_id = payload.tab_id;
                                resolved.tab_label = payload.tab_label;
                                Some(resolved)
                            })
                            .collect()
                    })
                    .unwrap_or_default()
            }),
        _ => flat_list.to_vec(),
    }
}

mod commands;
mod handlers;
#[path = "dispatcher/navigation.rs"]
mod navigation_handlers;
mod ready;
mod refresh;
mod search;
mod settings;

// Command parity remains visible here while implementation lives in focused
// modules: "ready" =>, "navigate" => { msg.get("path") }, "openFolder" =>,
// "openFile" =>, "openPath" =>, "activateWorkspace" => { openFirstFile: msg.get("openFirstFile"); send_initial_content(open_first_file) },
// "searchAcrossWorkspaces" =>, "searchWorkspace" =>, "indexWorkspaceSearchItems" =>,
// "loadWorkspaceSearchIndexes" =>, "confirmOpenPath" =>, "openRecentWorkspace" =>,
// "deleteRecentWorkspace" =>, "replaceRecentWorkspaces" =>, "closeWorkspace" =>,
// "zoom-out" =>, "openInEditor" =>, "copyCode" =>, "openExternal" =>,
// "refresh" =>, "setDocumentConversion" =>, "downloadUpdate" =>,
// "scheduleDownloadedUpdate" =>, "restartAndApplyUpdate" =>, "window-minimize" =>,
// "window-maximize" => { window.set_fullscreen(false); window.is_fullscreen(); host_message::emit_fullscreen_changed(&self.app, false); window.is_maximized() },
// "window-close" =>, "updateAppearance" =>, "toggle-fullscreen" => {
//   run_on_main_thread; FullscreenTransition::AwaitingMaximize;
//   FullscreenTransition::AwaitingUnmaximize; window.maximize(); window.unmaximize();
//   window.set_fullscreen(false); FullscreenTransition::Idle;
// }
// "zoom-in" =>

impl Dispatcher {
    pub fn mount(app: &AppHandle, state: AppState) {
        let app_clone = app.clone();
        let state_clone = state.clone();
        app.listen("webview-message", move |event| {
            let payload: Value = serde_json::from_str(event.payload()).unwrap_or(Value::Null);
            let app = app_clone.clone();
            let state = state_clone.clone();
            tauri::async_runtime::spawn(async move {
                let dispatcher = Dispatcher { app, state };
                if let Err(e) = dispatcher.handle(payload).await {
                    eprintln!("[dispatcher] handle error: {e}");
                }
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_mdfile_full_deserialization() {
        let val = json!([{
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "parts": ["file.md"],
            "fileName": "file.md",
            "title": "My Title",
            "extension": ".md",
            "documentKind": "markdown"
        }]);
        let items: Result<Vec<MdFile>, _> = serde_json::from_value(val);
        assert!(items.is_ok());
        assert_eq!(items.unwrap()[0].title, "My Title");
    }

    #[test]
    fn test_mdfile_full_deserialization_preserves_tab_metadata() {
        let val = json!([{
            "tabId": "tab-1",
            "tabLabel": "Workspace A",
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "parts": ["file.md"],
            "fileName": "file.md",
            "title": "My Title",
            "extension": ".md",
            "documentKind": "markdown"
        }]);

        let items: Vec<MdFile> = serde_json::from_value(val).unwrap();

        assert_eq!(items[0].tab_id.as_deref(), Some("tab-1"));
        assert_eq!(items[0].tab_label.as_deref(), Some("Workspace A"));
    }

    #[test]
    fn test_mdfile_partial_deserialization_fallback_extraction() {
        // Simulates the lightweight search payload sent by the UI
        let val = json!([{
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "fileName": "file.md",
            "title": "My Title"
        }]);

        // Attempting to deserialize as full MdFile fails because of missing required fields
        let full_deser: Result<Vec<MdFile>, _> = serde_json::from_value(val.clone());
        assert!(full_deser.is_err());

        // The fallback extraction retrieves the paths
        let paths: std::collections::HashSet<String> = val
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.get("fsPath").and_then(Value::as_str))
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default();

        assert_eq!(paths.len(), 1);
        assert!(paths.contains("/path/to/file.md"));
    }

    #[test]
    fn test_resolve_search_items_falls_back_for_partial_cross_tab_payload() {
        let val = json!([{
            "tabId": "tab-1",
            "tabLabel": "Workspace A",
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "fileName": "file.md",
            "title": "My Title"
        }]);
        let flat_list = vec![MdFile {
            fs_path: "/path/to/file.md".into(),
            relative_path: "file.md".into(),
            parts: vec!["file.md".into()],
            file_name: "file.md".into(),
            title: "My Title".into(),
            extension: Some(".md".into()),
            document_kind: crate::workspace::scanner::DocumentKind::Markdown,
        }];

        let items = resolve_search_items(Some(val), &flat_list);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].fs_path, "/path/to/file.md");
        assert_eq!(items[0].tab_id.as_deref(), Some("tab-1"));
        assert_eq!(items[0].tab_label.as_deref(), Some("Workspace A"));
    }

    #[test]
    fn test_resolve_search_items_builds_partial_item_not_in_active_flat_list() {
        let val = json!([{
            "tabId": "tab-2",
            "tabLabel": "Workspace B",
            "fsPath": "/other-workspace/guide.md",
            "relativePath": "docs/guide.md",
            "fileName": "guide.md",
            "title": "Guide"
        }]);

        let items = resolve_search_items(Some(val), &[]);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].fs_path, "/other-workspace/guide.md");
        assert_eq!(items[0].relative_path, "docs/guide.md");
        assert_eq!(items[0].parts, vec!["docs", "guide.md"]);
        assert_eq!(items[0].extension, ".md");
        assert_eq!(items[0].document_kind, DocumentKind::Markdown);
        assert_eq!(items[0].tab_id.as_deref(), Some("tab-2"));
        assert_eq!(items[0].tab_label.as_deref(), Some("Workspace B"));
    }

    #[test]
    fn test_resolve_search_items_builds_minimal_payload_like_electron() {
        let val = json!([{
            "fsPath": "/other-workspace/notes.txt"
        }]);

        let items = resolve_search_items(Some(val), &[]);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].fs_path, "/other-workspace/notes.txt");
        assert_eq!(items[0].file_name, "notes.txt");
        assert_eq!(items[0].relative_path, "notes.txt");
        assert_eq!(items[0].title, "notes");
        assert_eq!(items[0].parts, vec!["notes.txt"]);
        assert_eq!(items[0].extension, ".txt");
        assert_eq!(items[0].document_kind, DocumentKind::Document);
    }

    #[test]
    fn test_resolve_search_items_keeps_full_mdfile_payload() {
        let val = json!([{
            "fsPath": "/path/to/file.md",
            "relativePath": "file.md",
            "parts": ["file.md"],
            "fileName": "file.md",
            "title": "My Title",
            "extension": ".md",
            "documentKind": "markdown"
        }]);
        let flat_list = vec![MdFile {
            fs_path: "/path/to/file.md".into(),
            relative_path: "file.md".into(),
            parts: vec!["file.md".into()],
            file_name: "file.md".into(),
            title: "My Title".into(),
            extension: Some(".md".into()),
            document_kind: crate::workspace::scanner::DocumentKind::Markdown,
        }];

        let items = resolve_search_items(Some(val), &flat_list);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "My Title");
    }
}
