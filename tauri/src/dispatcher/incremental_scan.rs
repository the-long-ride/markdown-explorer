use super::*;
use crate::host_message::WorkspaceOperationMetadata;

const WORKSPACE_SCAN_REVEAL_DELAY: Duration = Duration::from_secs(3);
const WORKSPACE_SCAN_BATCH_SIZE: usize = 32;
const WORKSPACE_SCAN_MAX_BATCH_SIZE: usize = 1024;

fn next_incremental_publish_count(last_published_count: usize) -> usize {
    if last_published_count < WORKSPACE_SCAN_BATCH_SIZE {
        return WORKSPACE_SCAN_BATCH_SIZE;
    }

    let ratio = last_published_count / WORKSPACE_SCAN_BATCH_SIZE;
    let growth_steps = usize::BITS - 1 - ratio.leading_zeros();
    let batch_size = WORKSPACE_SCAN_BATCH_SIZE
        .saturating_mul(1usize << growth_steps)
        .min(WORKSPACE_SCAN_MAX_BATCH_SIZE);
    last_published_count.saturating_add(batch_size)
}

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
    operation: Option<&WorkspaceOperationMetadata>,
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
    host_message::emit_workspace_files_changed_scoped(
        app,
        json!(flat),
        json!(tree),
        &workspace_name(workspace_path),
        &workspace_path.to_string_lossy(),
        document_conversion_enabled,
        operation,
    );
    true
}

impl Dispatcher {
    pub(super) fn send_workspace_data(&self, open_first_file: bool) {
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

        let (document_conversion_enabled, scan_generation, operation) = {
            let mut inner = self.state.inner.write();
            inner.workspace_scan_generation = inner.workspace_scan_generation.wrapping_add(1);
            let operation = WorkspaceOperationMetadata::from_parts(
                inner.workspace_operation_id.as_deref(),
                inner.workspace_tab_id.as_deref(),
            );
            (
                inner.document_conversion_enabled,
                inner.workspace_scan_generation,
                operation,
            )
        };
        let app = self.app.clone();
        let state = self.state.clone();
        let discovered = Arc::new(Mutex::new(Vec::<MdFile>::new()));
        let threshold_elapsed = Arc::new(AtomicBool::new(false));
        let revealed = Arc::new(AtomicBool::new(false));
        let last_published_count = Arc::new(AtomicUsize::new(0));
        host_message::emit_workspace_scan_progress_scoped(&app, 0, true, operation.as_ref());

        let reveal_app = app.clone();
        let reveal_state = state.clone();
        let reveal_workspace_path = workspace_path.clone();
        let reveal_discovered = discovered.clone();
        let reveal_threshold_elapsed = threshold_elapsed.clone();
        let reveal_revealed = revealed.clone();
        let reveal_last_published_count = last_published_count.clone();
        let reveal_operation = operation.clone();
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
                    reveal_operation.as_ref(),
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
            let progress_operation = operation.clone();
            let callback_operation = operation.clone();
            let cancel_state = state.clone();
            let cancel_workspace_path = workspace_path.clone();
            let result = scan_with_callbacks_and_cancel(
                &workspace_path,
                ScanOptions {
                    document_conversion_enabled,
                },
                move |scanned_files| {
                    let is_current = {
                        let inner = progress_state.inner.read();
                        inner.workspace_path.as_deref() == Some(&progress_workspace_path)
                            && inner.workspace_scan_generation == scan_generation
                    };
                    if is_current {
                        host_message::emit_workspace_scan_progress_scoped(
                            &progress_app,
                            scanned_files,
                            true,
                            progress_operation.as_ref(),
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
                    let next_publish_count = next_incremental_publish_count(
                        callback_last_published_count.load(Ordering::Acquire),
                    );
                    let batch_refresh = callback_revealed.load(Ordering::Acquire)
                        && scanned_files >= next_publish_count;
                    if first_reveal || batch_refresh {
                        publish_incremental_workspace_snapshot(
                            &callback_app,
                            &callback_state,
                            &callback_workspace_path,
                            scan_generation,
                            &callback_discovered,
                            &callback_last_published_count,
                            callback_operation.as_ref(),
                        );
                    }
                },
                move || {
                    let inner = cancel_state.inner.read();
                    inner.workspace_path.as_deref() != Some(&cancel_workspace_path)
                        || inner.workspace_scan_generation != scan_generation
                },
            );
            let result = match result {
                Ok(result) => result,
                Err(err) => {
                    eprintln!("Failed to scan workspace: {err}");
                    let is_current = {
                        let inner = state.inner.read();
                        inner.workspace_path.as_deref() == Some(&workspace_path)
                            && inner.workspace_scan_generation == scan_generation
                    };
                    if is_current {
                        host_message::emit_workspace_scan_progress_scoped(
                            &app,
                            0,
                            false,
                            operation.as_ref(),
                        );
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
            host_message::emit_workspace_files_changed_scoped(
                &app,
                json!(flat),
                json!(result.tree),
                &workspace_name(&workspace_path),
                &workspace_path.to_string_lossy(),
                document_conversion_enabled,
                operation.as_ref(),
            );
            host_message::emit_workspace_scan_progress_scoped(
                &app,
                result.flat.len(),
                false,
                operation.as_ref(),
            );
            dispatcher.send_initial_content_for_scan(
                open_first_file,
                &workspace_path,
                scan_generation,
                operation.as_ref(),
            );
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grows_incremental_publish_batches_to_the_maximum() {
        let counts = [0, 32, 64, 128, 256, 512, 1024, 2048];
        let next_counts = counts.map(next_incremental_publish_count);
        assert_eq!(next_counts, [32, 64, 128, 256, 512, 1024, 2048, 3072]);
    }

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
