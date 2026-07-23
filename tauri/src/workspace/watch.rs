use super::file_types::workspace_relative_path;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WatchChange {
    pub event_type: String,
    pub relative_path: String,
    pub fs_path: String,
}

pub fn create_watch_change(workspace_path: &Path, event_type: &str, filename: &str) -> WatchChange {
    let relative_path = filename.to_string();
    let fs_path = if relative_path.is_empty() {
        String::new()
    } else {
        workspace_path
            .join(&relative_path)
            .to_string_lossy()
            .to_string()
    };
    WatchChange {
        event_type: if event_type.is_empty() {
            "change".to_string()
        } else {
            event_type.to_string()
        },
        relative_path,
        fs_path,
    }
}

pub fn merge_watch_change(
    current: Option<WatchChange>,
    next: Option<WatchChange>,
) -> Option<WatchChange> {
    match (current, next) {
        (None, n) => n,
        (c, None) => c,
        (Some(c), Some(n)) => {
            if !c.fs_path.is_empty() && c.fs_path == n.fs_path {
                Some(n)
            } else {
                Some(WatchChange {
                    event_type: "mixed".to_string(),
                    relative_path: String::new(),
                    fs_path: String::new(),
                })
            }
        }
    }
}

const BASE_SUPPORTED_EXTENSIONS: &[&str] = &[".md", ".mdx", ".markdown", ".txt"];
const EXTRA_DOCUMENT_EXTENSIONS: &[&str] = &[
    ".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods",
    ".rtf",
];

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    ".vscode",
    "dist",
    "out",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    "vendor",
    "target",
    "bin",
    "obj",
    ".tauri",
];

fn is_ignored_watch_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    IGNORED_DIRS.iter().any(|dir| {
        normalized.contains(&format!("/{dir}/")) || normalized.ends_with(&format!("/{dir}"))
    })
}

fn normalize_path_key(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

pub fn is_supported_watch_path(file_path: &str, document_conversion_enabled: bool) -> bool {
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();

    if ext.is_empty() {
        return true;
    }
    if BASE_SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
        return true;
    }
    document_conversion_enabled && EXTRA_DOCUMENT_EXTENSIONS.contains(&ext.as_str())
}

pub fn is_watch_change_relevant(changed_path: &str, document_conversion_enabled: bool) -> bool {
    if changed_path.is_empty() {
        return true;
    }
    is_supported_watch_path(changed_path, document_conversion_enabled)
}

pub fn should_notify_current_file_changed(
    current_file: Option<&str>,
    changed_path: &str,
    current_file_still_available: bool,
) -> bool {
    match current_file {
        None => false,
        Some(current) => {
            if !current_file_still_available {
                return true;
            }
            if changed_path.is_empty() {
                return false;
            }
            normalize_path_key(current) == normalize_path_key(changed_path)
        }
    }
}

struct WatchState {
    current_workspace_path: Option<PathBuf>,
    current_workspace: Option<PathBuf>,
    watched_path: Option<PathBuf>,
    debounce_timer: Option<tokio::task::JoinHandle<()>>,
    watch_generation: u64,
    current_generation: u64,
    refresh_in_flight: bool,
    refresh_queued: bool,
    pending_change: Option<WatchChange>,
}

impl Default for WatchState {
    fn default() -> Self {
        Self {
            current_workspace_path: None,
            current_workspace: None,
            watched_path: None,
            debounce_timer: None,
            watch_generation: 0,
            current_generation: 0,
            refresh_in_flight: false,
            refresh_queued: false,
            pending_change: None,
        }
    }
}

pub struct WorkspaceWatchController {
    state: Arc<Mutex<WatchState>>,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl WorkspaceWatchController {
    pub fn new<F>(debounce_ms: u64, on_refresh: F) -> Self
    where
        F: Fn(PathBuf, Option<WatchChange>) + Send + Sync + 'static,
    {
        let state = Arc::new(Mutex::new(WatchState::default()));
        let watcher_state = state.clone();
        let watcher_debounce = debounce_ms;

        let (notify_tx, mut notify_rx) = mpsc::unbounded_channel::<(String, String)>();

        let notify_watcher: Option<RecommendedWatcher> =
            notify::recommended_watcher(move |res: Result<notify::Event, _>| {
                if let Ok(event) = res {
                    let full_path = event
                        .paths
                        .first()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if is_ignored_watch_path(&full_path) {
                        return;
                    }
                    let event_type = format!("{:?}", event.kind).to_lowercase();
                    let _ = notify_tx.send((event_type, full_path));
                }
            })
            .ok();

        let watcher = Arc::new(Mutex::new(notify_watcher));
        let watcher_for_task = watcher.clone();

        tokio::spawn(async move {
            let on_refresh = Arc::new(on_refresh);
            while let Some((event_type, full_path)) = notify_rx.recv().await {
                let (ws, gen) = {
                    let s = watcher_state.lock();
                    (s.current_workspace.clone(), s.watch_generation)
                };
                if let Some(ws) = ws {
                    let filename = workspace_relative_path(&ws, Path::new(&full_path));
                    let change = create_watch_change(&ws, &event_type, &filename);
                    schedule_refresh(
                        &watcher_state,
                        &on_refresh,
                        watcher_debounce,
                        ws,
                        gen,
                        Some(change),
                    );
                }
            }
        });

        let _ = watcher_for_task;

        Self { state, watcher }
    }

    pub fn watch_workspace(&self, workspace_path: Option<&Path>) {
        {
            let mut s = self.state.lock();
            s.watch_generation += 1;
            s.current_workspace_path = workspace_path.map(|p| p.to_path_buf());
            s.refresh_queued = false;
            s.pending_change = None;
            if let Some(handle) = s.debounce_timer.take() {
                handle.abort();
            }
        }

        let old_path = {
            let mut s = self.state.lock();
            s.watched_path.take()
        };

        {
            let mut w = self.watcher.lock();
            if let Some(ref mut watcher) = *w {
                if let Some(ref old) = old_path {
                    let _ = watcher.unwatch(old);
                }
            }
        }

        if let Some(path) = workspace_path {
            {
                let mut s = self.state.lock();
                s.current_workspace = Some(path.to_path_buf());
                s.current_generation = s.watch_generation;
                s.watched_path = Some(path.to_path_buf());
            }
            let mut w = self.watcher.lock();
            if let Some(ref mut watcher) = *w {
                let _ = watcher.watch(path, RecursiveMode::Recursive);
            }
        }
    }

    pub fn dispose(&self) {
        {
            let mut s = self.state.lock();
            s.current_workspace_path = None;
            s.current_workspace = None;
            s.refresh_queued = false;
            s.pending_change = None;
            if let Some(handle) = s.debounce_timer.take() {
                handle.abort();
            }
        }

        let old_path = {
            let mut s = self.state.lock();
            s.watched_path.take()
        };

        {
            let mut w = self.watcher.lock();
            if let Some(ref mut watcher) = *w {
                if let Some(ref old) = old_path {
                    let _ = watcher.unwatch(old);
                }
            }
            *w = None;
        }
    }
}

fn schedule_refresh<F>(
    state: &Arc<Mutex<WatchState>>,
    on_refresh: &Arc<F>,
    debounce_ms: u64,
    workspace: PathBuf,
    generation: u64,
    change: Option<WatchChange>,
) where
    F: Fn(PathBuf, Option<WatchChange>) + Send + Sync + 'static,
{
    {
        let mut s = state.lock();
        s.pending_change = merge_watch_change(s.pending_change.take(), change);
        s.current_workspace = Some(workspace.clone());
        s.current_generation = generation;
        if let Some(handle) = s.debounce_timer.take() {
            handle.abort();
        }
    }

    let state_clone = state.clone();
    let on_refresh_clone = on_refresh.clone();

    let handle = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(debounce_ms)).await;
        run_refresh(state_clone, on_refresh_clone, workspace, debounce_ms);
    });

    {
        let mut s = state.lock();
        s.debounce_timer = Some(handle);
    }
}

fn run_refresh<F>(
    state: Arc<Mutex<WatchState>>,
    on_refresh: Arc<F>,
    workspace: PathBuf,
    debounce_ms: u64,
) where
    F: Fn(PathBuf, Option<WatchChange>) + Send + Sync + 'static,
{
    let (ws, gen, current_ws, current_gen) = {
        let s = state.lock();
        (
            s.current_workspace.clone(),
            s.current_generation,
            s.current_workspace_path.clone(),
            s.watch_generation,
        )
    };

    if ws.is_none() || gen != current_gen || ws != current_ws {
        return;
    }

    let change = {
        let mut s = state.lock();
        if s.refresh_in_flight {
            s.refresh_queued = true;
            return;
        }
        s.refresh_in_flight = true;
        s.pending_change.take()
    };

    on_refresh(workspace.clone(), change);

    let should_requeue = {
        let mut s = state.lock();
        s.refresh_in_flight = false;
        s.refresh_queued
            && s.current_generation == s.watch_generation
            && s.current_workspace == s.current_workspace_path
    };

    if should_requeue {
        let mut s = state.lock();
        s.refresh_queued = false;
        let ws = s.current_workspace.clone().unwrap_or_default();
        let gen = s.current_generation;
        drop(s);
        schedule_refresh(&state, &on_refresh, debounce_ms, ws, gen, None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_watch_change_normalizes() {
        let ws = Path::new("/workspace");
        let change = create_watch_change(ws, "modify", "src/file.md");
        assert_eq!(change.event_type, "modify");
        assert_eq!(change.relative_path, "src/file.md");
        assert!(change.fs_path.contains("file.md"));
    }

    #[test]
    fn create_watch_change_empty_filename() {
        let ws = Path::new("/workspace");
        let change = create_watch_change(ws, "", "");
        assert_eq!(change.event_type, "change");
        assert!(change.fs_path.is_empty());
    }

    #[test]
    fn merge_same_path_keeps_newest() {
        let c1 = Some(WatchChange {
            event_type: "rename".into(),
            relative_path: "a.md".into(),
            fs_path: "/ws/a.md".into(),
        });
        let c2 = Some(WatchChange {
            event_type: "modify".into(),
            relative_path: "a.md".into(),
            fs_path: "/ws/a.md".into(),
        });
        let merged = merge_watch_change(c1, c2);
        assert_eq!(merged.unwrap().event_type, "modify");
    }

    #[test]
    fn merge_different_paths_becomes_mixed() {
        let c1 = Some(WatchChange {
            event_type: "rename".into(),
            relative_path: "a.md".into(),
            fs_path: "/ws/a.md".into(),
        });
        let c2 = Some(WatchChange {
            event_type: "modify".into(),
            relative_path: "b.md".into(),
            fs_path: "/ws/b.md".into(),
        });
        let merged = merge_watch_change(c1, c2);
        assert_eq!(merged.unwrap().event_type, "mixed");
    }

    #[test]
    fn is_watch_change_relevant_empty_path() {
        assert!(is_watch_change_relevant("", false));
    }

    #[test]
    fn is_watch_change_relevant_markdown() {
        assert!(is_watch_change_relevant("/ws/file.md", false));
        assert!(is_watch_change_relevant("/ws/file.txt", false));
    }

    #[test]
    fn is_watch_change_relevant_extra_docs_only_when_enabled() {
        assert!(!is_watch_change_relevant("/ws/file.docx", false));
        assert!(is_watch_change_relevant("/ws/file.docx", true));
    }

    #[test]
    fn is_watch_change_relevant_no_extension() {
        assert!(is_watch_change_relevant("/ws/noext", false));
    }

    #[test]
    fn should_notify_no_current_file() {
        assert!(!should_notify_current_file_changed(
            None,
            "/ws/file.md",
            true
        ));
    }

    #[test]
    fn should_notify_file_unavailable() {
        assert!(should_notify_current_file_changed(
            Some("/ws/file.md"),
            "/ws/other.md",
            false
        ));
    }

    #[test]
    fn should_notify_matching_path() {
        assert!(should_notify_current_file_changed(
            Some("/WS/File.md"),
            "/ws/file.md",
            true
        ));
    }

    #[test]
    fn should_not_notify_different_path() {
        assert!(!should_notify_current_file_changed(
            Some("/ws/file.md"),
            "/ws/other.md",
            true
        ));
    }

    #[test]
    fn should_not_notify_empty_changed_path() {
        assert!(!should_notify_current_file_changed(
            Some("/ws/file.md"),
            "",
            true
        ));
    }

    #[tokio::test]
    async fn watch_controller_creates() {
        let ctrl = WorkspaceWatchController::new(50, |_ws, _change| {});
        ctrl.dispose();
    }

    #[tokio::test]
    async fn watch_controller_watch_and_dispose() {
        let dir = tempfile::tempdir().unwrap();
        let ctrl = WorkspaceWatchController::new(50, move |_ws, _change| {});
        ctrl.watch_workspace(Some(dir.path()));
        tokio::time::sleep(Duration::from_millis(100)).await;
        ctrl.watch_workspace(None);
        tokio::time::sleep(Duration::from_millis(50)).await;
        ctrl.dispose();
    }

    #[tokio::test]
    async fn watch_controller_rewatches_new_directory() {
        let dir1 = tempfile::tempdir().unwrap();
        let dir2 = tempfile::tempdir().unwrap();
        let ctrl = WorkspaceWatchController::new(50, move |_ws, _change| {});
        ctrl.watch_workspace(Some(dir1.path()));
        tokio::time::sleep(Duration::from_millis(50)).await;
        ctrl.watch_workspace(Some(dir2.path()));
        tokio::time::sleep(Duration::from_millis(50)).await;
        ctrl.dispose();
    }

    #[tokio::test]
    async fn watch_controller_triggers_refresh_on_file_change() {
        use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        std::fs::write(&file_path, "# Test").unwrap();

        let called = Arc::new(AtomicBool::new(false));
        let called_clone = called.clone();

        let ctrl = WorkspaceWatchController::new(50, move |_ws, _change| {
            called_clone.store(true, AtomicOrdering::SeqCst);
        });

        ctrl.watch_workspace(Some(dir.path()));
        tokio::time::sleep(Duration::from_millis(200)).await;

        std::fs::write(&file_path, "# Modified").unwrap();

        let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
        while tokio::time::Instant::now() < deadline {
            if called.load(AtomicOrdering::SeqCst) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        ctrl.dispose();
    }

    #[tokio::test]
    async fn watch_controller_dispose_without_watch() {
        let ctrl = WorkspaceWatchController::new(50, move |_ws, _change| {});
        ctrl.dispose();
    }

    #[tokio::test]
    async fn watch_controller_unwatch_none_then_watch() {
        let dir = tempfile::tempdir().unwrap();
        let ctrl = WorkspaceWatchController::new(50, move |_ws, _change| {});
        ctrl.watch_workspace(None);
        tokio::time::sleep(Duration::from_millis(50)).await;
        ctrl.watch_workspace(Some(dir.path()));
        tokio::time::sleep(Duration::from_millis(50)).await;
        ctrl.dispose();
    }

    #[test]
    fn is_ignored_watch_path_filters_target() {
        assert!(is_ignored_watch_path(
            "/workspace/tauri/target/debug/app.exe"
        ));
        assert!(is_ignored_watch_path("/workspace/target"));
        assert!(is_ignored_watch_path("/workspace/target/"));
        assert!(is_ignored_watch_path(
            "C:\\workspace\\tauri\\target\\debug\\deps\\lib.rs"
        ));
    }

    #[test]
    fn is_ignored_watch_path_filters_node_modules() {
        assert!(is_ignored_watch_path(
            "/workspace/node_modules/react/index.js"
        ));
        assert!(is_ignored_watch_path(
            "/workspace/ui/node_modules/.pnpm/node_modules/foo/index.js"
        ));
    }

    #[test]
    fn is_ignored_watch_path_filters_git() {
        assert!(is_ignored_watch_path("/workspace/.git/HEAD"));
        assert!(is_ignored_watch_path("/workspace/.git/refs/heads/main"));
    }

    #[test]
    fn is_ignored_watch_path_filters_all_ignored_dirs() {
        for dir in &[
            ".vscode", "dist", "out", "build", "coverage", ".next", ".nuxt", ".turbo", ".cache",
            "vendor", "bin", "obj", ".tauri",
        ] {
            assert!(
                is_ignored_watch_path(&format!("/workspace/{dir}/some_file")),
                "failed for {dir}"
            );
        }
    }

    #[test]
    fn is_ignored_watch_path_allows_source_files() {
        assert!(!is_ignored_watch_path("/workspace/docs/readme.md"));
        assert!(!is_ignored_watch_path("/workspace/src/main.rs"));
        assert!(!is_ignored_watch_path("/workspace/electron/main.js"));
        assert!(!is_ignored_watch_path("/workspace/tauri/src/lib.rs"));
        assert!(!is_ignored_watch_path("/workspace/test/test-code.md"));
    }

    #[test]
    fn is_ignored_watch_path_backslash_normalization() {
        assert!(is_ignored_watch_path(
            "C:\\Users\\dev\\project\\node_modules\\foo\\index.js"
        ));
        assert!(is_ignored_watch_path("C:\\project\\target\\debug\\app.exe"));
        assert!(!is_ignored_watch_path("C:\\project\\docs\\readme.md"));
    }

    #[test]
    fn is_ignored_watch_path_does_not_match_partial_names() {
        assert!(!is_ignored_watch_path("/workspace/my_target/build.md"));
        assert!(!is_ignored_watch_path("/workspace/coverage-report.md"));
        assert!(!is_ignored_watch_path("/workspace/binary_file.md"));
    }
}
