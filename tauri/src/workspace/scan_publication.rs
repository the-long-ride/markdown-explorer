use crate::app_state::AppState;
use crate::workspace::scanner::MdFile;
use std::path::Path;

const WORKSPACE_SCAN_MAX_BATCH_SIZE: usize = 1024;

pub(crate) fn next_incremental_publish_count<const BATCH_SIZE: usize>(
    last_published_count: usize,
) -> usize {
    if last_published_count < BATCH_SIZE {
        return BATCH_SIZE;
    }

    let ratio = last_published_count / BATCH_SIZE;
    let growth_steps = usize::BITS - 1 - ratio.leading_zeros();
    let batch_size = BATCH_SIZE
        .saturating_mul(1usize << growth_steps)
        .min(WORKSPACE_SCAN_MAX_BATCH_SIZE);
    last_published_count.saturating_add(batch_size)
}

pub(crate) fn workspace_name(workspace_path: &Path) -> String {
    workspace_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| workspace_path.to_string_lossy().to_string())
}

pub(crate) fn store_workspace_scan_result(
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::RuntimeState;
    use std::path::PathBuf;

    #[test]
    fn grows_incremental_publish_batches_to_the_maximum() {
        let counts = [0, 32, 64, 128, 256, 512, 1024, 2048];
        let next_counts = counts.map(next_incremental_publish_count::<32>);
        assert_eq!(next_counts, [32, 64, 128, 256, 512, 1024, 2048, 3072]);
    }

    #[test]
    fn display_name_uses_last_component_or_whole_path() {
        assert_eq!(workspace_name(Path::new("parent/notes")), "notes");
        assert_eq!(workspace_name(Path::new("/")), "/");
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
