const path = require("path");

function createStartupReadyAck({
  workspacePath,
  recentWorkspaces,
  documentConversionEnabled,
  hostInfo,
}) {
  return {
    command: "readyAck",
    fileList: [],
    tree: null,
    theme: "dark",
    themeStyle: "default",
    defaultExpanded: true,
    workspaceName: workspacePath ? path.basename(workspacePath) : "",
    workspacePath: workspacePath || undefined,
    recentWorkspaces,
    documentConversionEnabled,
    ...hostInfo,
  };
}

function deferWorkspaceLoad({
  schedule = setTimeout,
  ensureHeavyModules,
  bindWorkspaceWatch,
  sendLoading,
  sendWorkspaceData,
  sendInitialContent,
  openFirstFile = false,
  sendUpdateState,
  onError,
}) {
  schedule(async () => {
    try {
      sendLoading("Loading workspace...");
      ensureHeavyModules();
      bindWorkspaceWatch();
      await sendWorkspaceData();
      await sendInitialContent(openFirstFile);
      sendUpdateState?.();
    } catch (err) {
      onError?.(err);
    }
  }, 0);
}

module.exports = {
  createStartupReadyAck,
  deferWorkspaceLoad,
};
