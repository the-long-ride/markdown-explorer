use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspace {
    pub name: String,
    pub path: String,
    pub last_opened: u64,
}

#[derive(Debug, Clone)]
pub struct RecentWorkspacesStore {
    file_path: PathBuf,
}

impl RecentWorkspacesStore {
    pub fn new(app_config_dir: PathBuf) -> Self {
        Self { file_path: app_config_dir.join("recent-workspaces.json") }
    }

    pub fn from_file(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    pub fn load(&self) -> Vec<RecentWorkspace> {
        match fs::read_to_string(&self.file_path) {
            Ok(raw) => serde_json::from_str::<Vec<RecentWorkspace>>(&raw).unwrap_or_default(),
            Err(_) => vec![],
        }
    }

    pub fn save(&self, folder_path: &Path) {
        let mut list = self.load();
        let norm = normalize_path(folder_path);
        list.retain(|workspace| normalize_path(Path::new(&workspace.path)) != norm);
        let path_string = folder_path.to_string_lossy().to_string();
        list.insert(0, RecentWorkspace {
            name: folder_path.file_name().map(|n| n.to_string_lossy().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| path_string.clone()),
            path: path_string,
            last_opened: now_ms(),
        });
        list.truncate(100);
        self.write(&list);
    }

    pub fn remove(&self, folder_path: &Path) {
        let norm = normalize_path(folder_path);
        let mut list = self.load();
        list.retain(|workspace| normalize_path(Path::new(&workspace.path)) != norm);
        self.write(&list);
    }

    pub fn replace(&self, workspaces: Vec<RecentWorkspaceInput>) {
        let mut seen = HashSet::new();
        let mut clean = Vec::new();
        for workspace in workspaces {
            let path = workspace.path.trim().to_string();
            if path.is_empty() {
                continue;
            }
            let norm = normalize_path(Path::new(&path));
            if !seen.insert(norm) {
                continue;
            }
            let name = workspace.name.unwrap_or_default().trim().to_string();
            let fallback_name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| path.clone());
            clean.push(RecentWorkspace {
                name: if name.is_empty() { fallback_name } else { name },
                path,
                last_opened: workspace.last_opened.unwrap_or_else(now_ms),
            });
            if clean.len() == 100 {
                break;
            }
        }
        self.write(&clean);
    }

    fn write(&self, list: &[RecentWorkspace]) {
        if let Some(parent) = self.file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(err) = fs::write(&self.file_path, serde_json::to_string_pretty(list).unwrap_or_else(|_| "[]".into())) {
            eprintln!("Failed to save recent workspaces: {err}");
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceInput {
    pub path: String,
    pub name: Option<String>,
    pub last_opened: Option<u64>,
}

fn normalize_path(path: &Path) -> String {
    path.components().collect::<PathBuf>().to_string_lossy().to_string()
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(prefix: &str) -> PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("{prefix}-{stamp}/recent-workspaces.json"))
    }

    #[test]
    fn save_keeps_newest_first_and_deduplicates_by_normalized_path() {
        let file = temp_file("tauri-recents-save");
        let store = RecentWorkspacesStore::from_file(file);
        let dir = std::env::temp_dir().join("Docs");
        store.save(&dir);
        store.save(&dir.join("."));
        let list = store.load();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn replace_sanitizes_entries_and_removes_duplicates() {
        let file = temp_file("tauri-recents-replace");
        let store = RecentWorkspacesStore::from_file(file);
        let one = std::env::temp_dir().join("one").to_string_lossy().to_string();
        let two = std::env::temp_dir().join("two").to_string_lossy().to_string();
        store.replace(vec![
            RecentWorkspaceInput { path: " ".into(), name: Some("ignored".into()), last_opened: None },
            RecentWorkspaceInput { path: one.clone(), name: Some(" One ".into()), last_opened: None },
            RecentWorkspaceInput { path: one, name: Some("Duplicate".into()), last_opened: None },
            RecentWorkspaceInput { path: two, name: None, last_opened: Some(123) },
        ]);
        let list = store.load();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].name, "One");
        assert_eq!(list[1].last_opened, 123);
    }

    #[test]
    fn load_returns_empty_for_invalid_json() {
        let file = temp_file("tauri-recents-invalid");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "not json").unwrap();
        let store = RecentWorkspacesStore::from_file(file);
        assert_eq!(store.load(), Vec::<RecentWorkspace>::new());
    }

    #[test]
    fn remove_deletes_by_normalized_path() {
        let file = temp_file("tauri-recents-remove");
        let store = RecentWorkspacesStore::from_file(file);
        let alpha = std::env::temp_dir().join("alpha");
        let beta = std::env::temp_dir().join("beta");
        store.save(&alpha);
        store.save(&beta);
        store.remove(&alpha);
        let list = store.load();
        assert_eq!(list.len(), 1);
        assert!(list[0].path.ends_with("beta"));
    }

    #[test]
    fn replace_limits_to_100_entries() {
        let file = temp_file("tauri-recents-limit");
        let store = RecentWorkspacesStore::from_file(file);
        let entries = (0..120)
            .map(|i| RecentWorkspaceInput { path: format!("C:/ws-{i}"), name: Some(format!("ws-{i}")), last_opened: None })
            .collect();
        store.replace(entries);
        assert_eq!(store.load().len(), 100);
    }
}