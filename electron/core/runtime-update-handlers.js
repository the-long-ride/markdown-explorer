function registerRuntimeUpdateHandlers({ deps, appQuit, state, handleReady }) {
  async function handleDownloadUpdate(msg) {
    if (!deps.updateManager) return;
    await deps.updateManager.startDownload({
      version: String(msg?.version || ""),
      url: String(msg?.url || ""),
    });
  }

  async function handleScheduleDownloadedUpdate() {
    if (!deps.updateManager) return;
    await deps.updateManager.schedulePendingUpdate();
  }

  async function handleRestartAndApplyUpdate() {
    if (!deps.updateManager) return;
    await deps.updateManager.restartAndApplyUpdate();
    if (appQuit) appQuit();
  }

  function handleCloseWorkspace() {
    state.readyHandled = false;
    if (state.workspaceWatch) state.workspaceWatch.dispose();
    state.workspacePath = null;
    state.currentFile = null;
    handleReady();
  }
  return {
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace,
  };
}

module.exports = { registerRuntimeUpdateHandlers };
