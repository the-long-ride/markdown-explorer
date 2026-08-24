#![allow(dead_code)]

use parking_lot::RwLock;
use std::collections::HashSet;
use std::sync::{
    atomic::AtomicBool,
    Arc, Mutex,
};

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<AppStateInner>>,
    pub pending_update: Arc<Mutex<Option<crate::update::manager::PendingUpdate>>>,
    pub update_apply_in_progress: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            inner: Arc::new(RwLock::new(AppStateInner::default())),
            pending_update: Arc::new(Mutex::new(None)),
            update_apply_in_progress: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Default)]
pub struct AppStateInner {
    pub workspace_path: Option<std::path::PathBuf>,
    pub external_open_request: Option<crate::runtime::external_open::ExternalOpenRequest>,
    pub current_file: Option<std::path::PathBuf>,
    pub recents: Vec<crate::workspace::recents::RecentWorkspace>,
    pub flat_list: Vec<crate::workspace::scanner::MdFile>,
    pub search_index: Option<crate::search::index::SearchIndex>,
    pub search_worker: Option<crate::search::worker::SearchWorkerHandle>,
    pub search_preview_paths: HashSet<String>,
    pub watch_controller: Option<crate::workspace::watch::WorkspaceWatchController>,
    pub runtime_state: RuntimeState,
    pub workspace_scan_generation: u64,
    pub workspace_operation_id: Option<String>,
    pub workspace_tab_id: Option<String>,
    pub ready_handled: bool,
    pub document_conversion_enabled: bool,
    pub fullscreen_transition: FullscreenTransition,
    pub update_state: crate::update::UpdateState,
    pub zoom_level: f64,
    pub perf: crate::perf::PerfTimer,
    pub converter: crate::render::document_converter::DocumentConverter,
}

#[derive(Default, Clone, Copy, Debug, PartialEq, Eq)]
pub enum FullscreenTransition {
    #[default]
    Idle,
    AwaitingMaximize,
    AwaitingUnmaximize,
}

#[derive(Default, Clone, Copy, Debug)]
pub enum RuntimeState {
    #[default]
    Idle,
    Initializing,
    Ready,
    Reloading,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }
}
