// ============================================================
// recents/mod.rs — Recent workspaces store
// Port of desktop/recents.js → Rust using serde_json
// ============================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const RECENTS_FILE: &str = "recents.json";
const MAX_RECENTS: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspace {
    pub name: String,
    pub path: String,
    pub last_opened: Option<u64>,
}

pub struct RecentWorkspacesStore {
    data_dir: PathBuf,
    items: Vec<RecentWorkspace>,
}

impl RecentWorkspacesStore {
    pub fn new(data_dir: PathBuf) -> Self {
        let mut store = RecentWorkspacesStore {
            data_dir,
            items: vec![],
        };
        store.load();
        store
    }

    fn file_path(&self) -> PathBuf {
        self.data_dir.join(RECENTS_FILE)
    }

    fn load(&mut self) {
        let path = self.file_path();
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(parsed) = serde_json::from_str::<Vec<RecentWorkspace>>(&content) {
                self.items = parsed;
            }
        }
    }

    fn save(&self) {
        let path = self.file_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&self.items) {
            let _ = fs::write(&path, json);
        }
    }

    pub fn get_all(&self) -> &[RecentWorkspace] {
        &self.items
    }

    pub fn add(&mut self, workspace: RecentWorkspace) {
        // Normalize path for comparison
        let normalized = workspace.path.replace('\\', "/").to_lowercase();

        // Remove existing entry with the same path
        self.items.retain(|w| {
            w.path.replace('\\', "/").to_lowercase() != normalized
        });

        // Insert at the front (newest first)
        self.items.insert(0, workspace);

        // Trim to max size
        self.items.truncate(MAX_RECENTS);

        self.save();
    }

    pub fn remove(&mut self, workspace_path: &str) {
        let normalized = workspace_path.replace('\\', "/").to_lowercase();
        self.items.retain(|w| {
            w.path.replace('\\', "/").to_lowercase() != normalized
        });
        self.save();
    }

    pub fn update_last_opened(&mut self, workspace_path: &str) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let normalized = workspace_path.replace('\\', "/").to_lowercase();
        if let Some(item) = self.items.iter_mut().find(|w| {
            w.path.replace('\\', "/").to_lowercase() == normalized
        }) {
            item.last_opened = Some(now);
            self.save();
        }
    }
    pub fn replace_all(&mut self, workspaces: &[RecentWorkspace]) {
        self.items = workspaces.to_vec();
        self.items.truncate(MAX_RECENTS);
        self.save();
    }
}
