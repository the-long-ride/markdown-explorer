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
    workspaceName: path.basename(workspacePath || ""),
    workspacePath: workspacePath || undefined,
    recentWorkspaces,
    documentConversionEnabled,
    ...hostInfo,
  };
}

async function runDeferredLoad({
  ensureHeavyModules,
  bindWorkspaceWatch,
  sendLoading,
  sendWorkspaceData,
  sendInitialContent,
  openFirstFile = false,
  sendUpdateState,
  onError,
}) {
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
    await runDeferredLoad({
      ensureHeavyModules,
      bindWorkspaceWatch,
      sendLoading,
      sendWorkspaceData,
      sendInitialContent,
      openFirstFile,
      sendUpdateState,
      onError,
    });
  }, 0);
}

module.exports = {
  createStartupReadyAck,
  deferWorkspaceLoad,
  runDeferredLoad,
};
