const path = require("path");

function normalizeWatchFilename(filename) {
  if (Buffer.isBuffer(filename)) return filename.toString();
  return typeof filename === "string" ? filename : "";
}

function createWatchChange(workspacePath, eventType, filename) {
  const relativePath = normalizeWatchFilename(filename);
  return {
    eventType: typeof eventType === "string" ? eventType : "change",
    relativePath,
    fsPath: relativePath ? path.join(workspacePath, relativePath) : "",
  };
}

function mergeWatchChange(currentChange, nextChange) {
  if (!nextChange) return currentChange;
  if (!currentChange) return nextChange;
  if (currentChange.fsPath && currentChange.fsPath === nextChange.fsPath) return nextChange;
  return {
    eventType: "mixed",
    relativePath: "",
    fsPath: "",
  };
}

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
  let pendingChange = null;

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

    const change = pendingChange;
    pendingChange = null;
    refreshInFlight = true;
    try {
      await onRefresh(workspacePath, change);
    } finally {
      refreshInFlight = false;
      if (refreshQueued && generation === watchGeneration && workspacePath === currentWorkspacePath) {
        refreshQueued = false;
        scheduleRefresh(workspacePath, generation);
      }
    }
  }

  function scheduleRefresh(workspacePath = currentWorkspacePath, generation = watchGeneration, change = null) {
    pendingChange = mergeWatchChange(pendingChange, change);
    clearPendingTimer();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runRefresh(workspacePath, generation);
    }, debounceMs);
  }

  function bindWatcher(workspacePath, generation) {
    try {
      currentWatcher = fs.watch(workspacePath, { recursive: true }, (eventType, filename) => {
        scheduleRefresh(
          workspacePath,
          generation,
          createWatchChange(workspacePath, eventType, filename),
        );
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
    pendingChange = null;
    clearPendingTimer();
    closeCurrentWatcher();

    if (!currentWorkspacePath) return;
    bindWatcher(currentWorkspacePath, watchGeneration);
  }

  function dispose() {
    currentWorkspacePath = null;
    refreshQueued = false;
    pendingChange = null;
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
