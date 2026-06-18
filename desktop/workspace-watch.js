function createWorkspaceWatchController({
  fs,
  setTimeout,
  clearTimeout,
  debounceMs = 120,
  onRefresh,
  onWatchError = (error) => console.error("Workspace watch failed:", error),
}) {
  let currentWorkspacePath = null;
  let currentWatcher = null;
  let debounceTimer = null;
  let watchGeneration = 0;
  let refreshInFlight = false;
  let refreshQueued = false;

  function clearPendingTimer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function closeCurrentWatcher() {
    try {
      currentWatcher?.close?.();
    } catch (error) {
      onWatchError(error);
    }
    currentWatcher = null;
  }

  async function runRefresh(workspacePath, generation) {
    if (!workspacePath || generation !== watchGeneration || workspacePath !== currentWorkspacePath) {
      return;
    }
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;
    try {
      await onRefresh(workspacePath);
    } finally {
      refreshInFlight = false;
      if (refreshQueued && generation === watchGeneration && workspacePath === currentWorkspacePath) {
        refreshQueued = false;
        scheduleRefresh(workspacePath, generation);
      }
    }
  }

  function scheduleRefresh(workspacePath = currentWorkspacePath, generation = watchGeneration) {
    clearPendingTimer();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runRefresh(workspacePath, generation);
    }, debounceMs);
  }

  function bindWatcher(workspacePath, generation) {
    try {
      currentWatcher = fs.watch(workspacePath, { recursive: true }, () => {
        scheduleRefresh(workspacePath, generation);
      });
    } catch (error) {
      currentWatcher = null;
      onWatchError(error);
    }
  }

  function watchWorkspace(workspacePath) {
    watchGeneration += 1;
    currentWorkspacePath = workspacePath || null;
    refreshQueued = false;
    clearPendingTimer();
    closeCurrentWatcher();

    if (!currentWorkspacePath) return;
    bindWatcher(currentWorkspacePath, watchGeneration);
  }

  function dispose() {
    currentWorkspacePath = null;
    refreshQueued = false;
    clearPendingTimer();
    closeCurrentWatcher();
  }

  return {
    watchWorkspace,
    scheduleRefresh,
    dispose,
  };
}

module.exports = {
  createWorkspaceWatchController,
};
