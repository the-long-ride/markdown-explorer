#![allow(dead_code)]

use parking_lot::RwLock;
use std::sync::Arc;

#[derive(Clone, Default)]
pub struct AppState {
    pub inner: Arc<RwLock<AppStateInner>>,
}

#[derive(Default)]
pub struct AppStateInner {
    pub workspace_path: Option<std::path::PathBuf>,
    pub external_open_path: Option<std::path::PathBuf>,
    pub current_file: Option<std::path::PathBuf>,
    pub recents: Vec<crate::workspace::recents::RecentWorkspace>,
    pub flat_list: Vec<crate::workspace::scanner::MdFile>,
    pub search_index: Option<crate::search::index::SearchIndex>,
    pub search_worker: Option<crate::search::worker::SearchWorkerHandle>,
    pub watch_controller: Option<crate::workspace::watch::WorkspaceWatchController>,
    pub runtime_state: RuntimeState,
    pub workspace_scan_generation: u64,
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
