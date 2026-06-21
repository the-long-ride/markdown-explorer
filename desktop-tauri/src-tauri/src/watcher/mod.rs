// ============================================================
// watcher/mod.rs — File system watcher with debounce
// Port of desktop/workspace-watch.js → Rust using notify
// ============================================================

use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

const DEBOUNCE_MS: u64 = 120;

#[allow(dead_code)]
pub struct WorkspaceWatcher {
    sender: Option<mpsc::Sender<()>>,
}

impl WorkspaceWatcher {
    pub fn new(root_path: PathBuf, on_refresh: impl Fn() + Send + 'static) -> Self {
        let (tx, _rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel::<()>();

        // Start the notify watcher in a separate thread
        let watch_path = root_path.clone();
        std::thread::spawn(move || {
            let (watch_tx, watch_rx) = mpsc::channel();
            let mut watcher = match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            let _ = watch_tx.send(());
                        }
                        _ => {}
                    }
                }
            }) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("Failed to create file watcher: {}", e);
                    return;
                }
            };

            if let Err(e) = watcher.watch(&watch_path, RecursiveMode::Recursive) {
                eprintln!("Failed to watch path: {}", e);
                return;
            }

            // Debounce loop
            let mut last_event = Instant::now();
            let mut pending = false;
            loop {
                match watch_rx.recv_timeout(Duration::from_millis(50)) {
                    Ok(()) => {
                        last_event = Instant::now();
                        pending = true;
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if pending && last_event.elapsed() >= Duration::from_millis(DEBOUNCE_MS) {
                            pending = false;
                            let _ = event_tx.send(());
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        // Refresh handler thread
        std::thread::spawn(move || {
            while event_rx.recv().is_ok() {
                on_refresh();
            }
        });

        WorkspaceWatcher { sender: Some(tx) }
    }

    /// Signal a stop (drop the sender)
    #[allow(dead_code)]
    pub fn stop(mut self) {
        drop(self.sender.take());
    }
}

impl Drop for WorkspaceWatcher {
    fn drop(&mut self) {
        // Sender is dropped, threads will terminate
    }
}
