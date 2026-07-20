use super::*;

const WORKSPACE_SCAN_REVEAL_DELAY: Duration = Duration::from_secs(3);
const WORKSPACE_SCAN_BATCH_SIZE: usize = 32;

fn workspace_name(workspace_path: &Path) -> String {
    workspace_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| workspace_path.to_string_lossy().to_string())
}

fn store_workspace_scan_result(
    state: &AppState,
    workspace_path: &Path,
    scan_generation: u64,
    flat: Vec<MdFile>,
) -> bool {
    let mut inner = state.inner.write();
    if inner.workspace_path.as_deref() != Some(workspace_path)
        || inner.workspace_scan_generation != scan_generation
    {
        return false;
    }
    inner.flat_list = flat;
    true
}

fn publish_incremental_workspace_snapshot(
    app: &AppHandle,
    state: &AppState,
    workspace_path: &Path,
    scan_generation: u64,
    discovered: &Arc<Mutex<Vec<MdFile>>>,
    last_published_count: &AtomicUsize,
) -> bool {
    let document_conversion_enabled = {
        let inner = state.inner.read();
        if inner.workspace_path.as_deref() != Some(workspace_path)
            || inner.workspace_scan_generation != scan_generation
        {
            return false;
        }
        inner.document_conversion_enabled
    };
    let mut flat = discovered
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    if flat.is_empty() {
        return false;
    }
    flat.sort_by(|a, b| a.fs_path.cmp(&b.fs_path));
    let count = flat.len();
    let mut previous = last_published_count.load(Ordering::Acquire);
    loop {
        if count <= previous {
            return false;
        }
        match last_published_count.compare_exchange(
            previous,
            count,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => break,
            Err(actual) => previous = actual,
        }
    }
    let tree = build_tree(&flat);
    host_message::emit_workspace_files_changed(
        app,
        json!(flat),
        json!(tree),
        &workspace_name(workspace_path),
        &workspace_path.to_string_lossy(),
        document_conversion_enabled,
    );
    true
}

impl Dispatcher {
    pub(super) fn send_workspace_data(&self) {
        let workspace_path = self.state.inner.read().workspace_path.clone();
        let Some(workspace_path) = workspace_path else {
            return;
        };
        let status = get_workspace_path_status(&workspace_path);
        if !status.ok {
            self.send_workspace_unavailable(
                &workspace_path,
                status.reason.unwrap_or(WorkspaceUnavailableReason::Missing),
            );
            return;
        }

        let (document_conversion_enabled, scan_generation) = {
            let mut inner = self.state.inner.write();
            inner.workspace_scan_generation = inner.workspace_scan_generation.wrapping_add(1);
            (
                inner.document_conversion_enabled,
                inner.workspace_scan_generation,
            )
        };
        let app = self.app.clone();
        let state = self.state.clone();
        let discovered = Arc::new(Mutex::new(Vec::<MdFile>::new()));
        let threshold_elapsed = Arc::new(AtomicBool::new(false));
        let revealed = Arc::new(AtomicBool::new(false));
        let last_published_count = Arc::new(AtomicUsize::new(0));
        host_message::emit_workspace_scan_progress(&app, 0, true);

        let reveal_app = app.clone();
        let reveal_state = state.clone();
        let reveal_workspace_path = workspace_path.clone();
        let reveal_discovered = discovered.clone();
        let reveal_threshold_elapsed = threshold_elapsed.clone();
        let reveal_revealed = revealed.clone();
        let reveal_last_published_count = last_published_count.clone();
        std::thread::spawn(move || {
            std::thread::sleep(WORKSPACE_SCAN_REVEAL_DELAY);
            reveal_threshold_elapsed.store(true, Ordering::Release);
            let scan_is_active = {
                let inner = reveal_state.inner.read();
                inner.workspace_path.as_ref() == Some(&reveal_workspace_path)
                    && inner.workspace_scan_generation == scan_generation
                    && !matches!(inner.runtime_state, RuntimeState::Ready)
            };
            let has_files = !reveal_discovered
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .is_empty();
            if scan_is_active
                && has_files
                && reveal_revealed
                    .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                    .is_ok()
            {
                publish_incremental_workspace_snapshot(
                    &reveal_app,
                    &reveal_state,
                    &reveal_workspace_path,
                    scan_generation,
                    &reveal_discovered,
                    &reveal_last_published_count,
                );
            }
        });

        std::thread::spawn(move || {
            let progress_app = app.clone();
            let progress_state = state.clone();
            let progress_workspace_path = workspace_path.clone();
            let callback_app = app.clone();
            let callback_state = state.clone();
            let callback_workspace_path = workspace_path.clone();
            let callback_discovered = discovered.clone();
            let callback_threshold_elapsed = threshold_elapsed.clone();
            let callback_revealed = revealed.clone();
            let callback_last_published_count = last_published_count.clone();
            let result = scan_with_callbacks(
                &workspace_path,
                ScanOptions {
                    document_conversion_enabled,
                },
                move |scanned_files| {
                    let inner = progress_state.inner.read();
                    if inner.workspace_path.as_deref() == Some(&progress_workspace_path)
                        && inner.workspace_scan_generation == scan_generation
                    {
                        host_message::emit_workspace_scan_progress(
                            &progress_app,
                            scanned_files,
                            true,
                        );
                    }
                },
                move |file, scanned_files| {
                    {
                        let inner = callback_state.inner.read();
                        if inner.workspace_path.as_deref() != Some(&callback_workspace_path)
                            || inner.workspace_scan_generation != scan_generation
                        {
                            return;
                        }
                    }
                    callback_discovered
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .push(file.clone());
                    let first_reveal = callback_threshold_elapsed.load(Ordering::Acquire)
                        && callback_revealed
                            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                            .is_ok();
                    let batch_refresh = callback_revealed.load(Ordering::Acquire)
                        && scanned_files % WORKSPACE_SCAN_BATCH_SIZE == 0;
                    if first_reveal || batch_refresh {
                        publish_incremental_workspace_snapshot(
                            &callback_app,
                            &callback_state,
                            &callback_workspace_path,
                            scan_generation,
                            &callback_discovered,
                            &callback_last_published_count,
                        );
                    }
                },
            );
            let result = match result {
                Ok(result) => result,
                Err(err) => {
                    eprintln!("Failed to scan workspace: {err}");
                    let inner = state.inner.read();
                    if inner.workspace_path.as_deref() == Some(&workspace_path)
                        && inner.workspace_scan_generation == scan_generation
                    {
                        host_message::emit_workspace_scan_progress(&app, 0, false);
                    }
                    return;
                }
            };

            let flat = result.flat.clone();
            if !store_workspace_scan_result(&state, &workspace_path, scan_generation, flat.clone())
            {
                return;
            }
            let dispatcher = Dispatcher {
                app: app.clone(),
                state: state.clone(),
            };
            dispatcher.ensure_search_index().prime(&flat);
            state.inner.write().runtime_state = RuntimeState::Ready;
            host_message::emit_workspace_files_changed(
                &app,
                json!(flat),
                json!(result.tree),
                &workspace_name(&workspace_path),
                &workspace_path.to_string_lossy(),
                document_conversion_enabled,
            );
            host_message::emit_workspace_scan_progress(&app, result.flat.len(), false);
            dispatcher.send_initial_content(true);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_current_scan_without_retaining_the_state_lock() {
        let state = AppState::new();
        let workspace_path = PathBuf::from("workspace");
        {
            let mut inner = state.inner.write();
            inner.workspace_path = Some(workspace_path.clone());
            inner.runtime_state = RuntimeState::Initializing;
            inner.workspace_scan_generation = 1;
        }
        assert!(store_workspace_scan_result(
            &state,
            &workspace_path,
            1,
            Vec::new()
        ));
        assert!(state.inner.try_read().is_some());
    }

    #[test]
    fn rejects_stale_same_path_scan() {
        let state = AppState::new();
        let workspace_path = PathBuf::from("workspace");
        {
            let mut inner = state.inner.write();
            inner.workspace_path = Some(workspace_path.clone());
            inner.workspace_scan_generation = 2;
        }
        assert!(!store_workspace_scan_result(
            &state,
            &workspace_path,
            1,
            Vec::new()
        ));
    }
}
