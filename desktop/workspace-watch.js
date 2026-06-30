const path = require("path");

function normalizeWatchFilename(filename) {
  return Buffer.isBuffer(filename) ? filename.toString()
    : typeof filename === "string" ? filename
    : "";
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
  return !nextChange ? currentChange
    : !currentChange ? nextChange
    : (currentChange.fsPath && currentChange.fsPath === nextChange.fsPath) ? nextChange
    : { eventType: "mixed", relativePath: "", fsPath: "" };
}

function clearPendingTimerFn(debounceTimer, clearTimeoutImpl) {
  if (debounceTimer.value) {
    clearTimeoutImpl(debounceTimer.value);
    debounceTimer.value = null;
  }
}

function closeCurrentWatcherFn(currentWatcher, onWatchError) {
  try {
    currentWatcher.value?.close?.();
  } catch (error) {
    onWatchError(error);
  }
  currentWatcher.value = null;
}

async function runRefreshFn(state, onRefresh) {
  if (!state.workspacePath.value || state.generation.value !== state.watchGeneration.value || state.workspacePath.value !== state.currentWorkspacePath.value) {
    return;
  }
  if (state.refreshInFlight.value) {
    state.refreshQueued.value = true;
    return;
  }

  const change = state.pendingChange.value;
  state.pendingChange.value = null;
  state.refreshInFlight.value = true;
  try {
    await onRefresh(state.workspacePath.value, change);
  } finally {
    state.refreshInFlight.value = false;
    if (state.refreshQueued.value && state.generation.value === state.watchGeneration.value && state.workspacePath.value === state.currentWorkspacePath.value) {
      state.refreshQueued.value = false;
      scheduleRefreshFn(state, onRefresh, null);
    }
  }
}

function scheduleRefreshFn(state, onRefresh, change) {
  state.pendingChange.value = mergeWatchChange(state.pendingChange.value, change);
  clearPendingTimerFn(state.debounceTimer, state.clearTimeoutImpl);
  state.debounceTimer.value = state.setTimeoutImpl(() => {
    state.debounceTimer.value = null;
    void runRefreshFn(state, onRefresh);
  }, state.debounceMs);
}

function bindWatcherFn(state, onRefresh) {
  try {
    state.currentWatcher.value = state.fs.watch(state.workspacePath.value, { recursive: true }, (eventType, filename) => {
      scheduleRefreshFn(
        state,
        onRefresh,
        createWatchChange(state.workspacePath.value, eventType, filename),
      );
    });
  } catch (error) {
    state.currentWatcher.value = null;
    state.onWatchError(error);
  }
}

function createWorkspaceWatchController({
  fs,
  setTimeout,
  clearTimeout,
  debounceMs = 120,
  onRefresh,
  onWatchError = (error) => console.error("Workspace watch failed:", error),
}) {
  const state = {
    currentWorkspacePath: { value: null },
    currentWatcher: { value: null },
    debounceTimer: { value: null },
    watchGeneration: { value: 0 },
    refreshInFlight: { value: false },
    refreshQueued: { value: false },
    pendingChange: { value: null },
    workspacePath: { value: null },
    generation: { value: 0 },
    debounceMs,
    fs,
    setTimeoutImpl: setTimeout,
    clearTimeoutImpl: clearTimeout,
    onWatchError,
  };

  function clearPendingTimer() {
    clearPendingTimerFn(state.debounceTimer, state.clearTimeoutImpl);
  }

  function closeCurrentWatcher() {
    closeCurrentWatcherFn(state.currentWatcher, state.onWatchError);
  }

  function scheduleRefresh(workspacePath = state.currentWorkspacePath.value, generation = state.watchGeneration.value, change = null) {
    state.workspacePath.value = workspacePath;
    state.generation.value = generation;
    scheduleRefreshFn(state, onRefresh, change);
  }

  function bindWatcher(workspacePath, generation) {
    state.workspacePath.value = workspacePath;
    state.generation.value = generation;
    bindWatcherFn(state, onRefresh);
  }

  function watchWorkspace(workspacePath) {
    state.watchGeneration.value += 1;
    state.currentWorkspacePath.value = workspacePath || null;
    state.refreshQueued.value = false;
    state.pendingChange.value = null;
    clearPendingTimer();
    closeCurrentWatcher();

    if (state.currentWorkspacePath.value) {
      bindWatcher(state.currentWorkspacePath.value, state.watchGeneration.value);
    }
  }

  function dispose() {
    state.currentWorkspacePath.value = null;
    state.refreshQueued.value = false;
    state.pendingChange.value = null;
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
  clearPendingTimerFn,
  closeCurrentWatcherFn,
  runRefreshFn,
  scheduleRefreshFn,
  bindWatcherFn,
  normalizeWatchFilename,
  createWatchChange,
  mergeWatchChange,
};
