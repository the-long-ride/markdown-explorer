const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;
const { registerRuntimeCommandHandlers } = require("./runtime-command-handlers");
const { registerRuntimeWorkspaceHandlers } = require("./runtime-workspace-handlers");

const {
  isSupportedFilePathLite,
  isExtraDocumentFilePathLite,
  getFileTypeLabelLite,
  getOpenDialogFiltersLite,
  stripKnownExtensionLite,
  isAccessDeniedError,
  clampZoomLevel,
  normalizeZoomStep,
  stripNavigationFragment,
  decodeNavigationPath,
  isRootRelativeWorkspaceHref,
  isSameOrInsidePath
} = require("./runtime-utils");



function createDesktopRuntime(deps) {
  const {
    path: pathApi,
    fs,
    dialog,
    getMainWindow,
    sendHostMessage,
    getHostInfo,
    sendLoading,
    sendRecentWorkspacesChanged,
    recentWorkspacesStore,
    createStartupReadyAck,
    deferWorkspaceLoad,
    ensureHeavyModules,
    scanWorkspaceData,
    createSearchIndex,
    createSearchWorkerController,
    createWorkspaceWatchController,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    perf,
    DesktopScanner: DesktopScannerImpl,
    isWatchChangeRelevant,
    shouldNotifyCurrentFileChanged,
    appQuit,
  } = deps;

  const runtimeState = {
    workspacePath: null,
    currentFile: null,
    flatList: [],
    readyHandled: false,
    documentConversionEnabled: false,
    searchIndex: null,
    crossTabSearchWorker: null,
    workspaceWatch: null,
  };

  const workspaceHandlers = registerRuntimeWorkspaceHandlers({
    state: runtimeState,
    deps,
    pathApi,
    fs,
    getMainWindow,
    sendHostMessage,
    getHostInfo,
    sendLoading,
    sendRecentWorkspacesChanged,
    recentWorkspacesStore,
    scanWorkspaceData,
    createSearchIndex,
    createSearchWorkerController,
    isSupportedFilePathLite,
    isExtraDocumentFilePathLite,
    getFileTypeLabelLite,
    stripKnownExtensionLite,
    isAccessDeniedError,
    stripNavigationFragment,
    decodeNavigationPath,
    isRootRelativeWorkspaceHref,
    isSameOrInsidePath,
  });
  const {
    ensureSearchIndex,
    ensureCrossTabSearchWorker,
    getWorkspacePathStatus,
    sendWorkspaceUnavailable,
    getWorkspaceBaseDir,
    isCurrentFileStillAvailable,
    resolveNavigationPath,
    sendCurrentFileChanged,
    sendWorkspaceFilesChanged,
    sendWorkspaceData,
    sendInitialContent,
    sendContent,
    sendWelcome
  } = workspaceHandlers;

  function bindWorkspaceWatch() {
    if (!runtimeState.workspaceWatch) {
      runtimeState.workspaceWatch = createWorkspaceWatchController({
        fs,
        setTimeout: setTimeoutImpl,
        clearTimeout: clearTimeoutImpl,
        debounceMs: 120,
        onRefresh: (...args) => refreshActiveWorkspaceFromWatch(...args),
      });
    }
    runtimeState.workspaceWatch.watchWorkspace(getWorkspaceBaseDir());
  }

  async function refreshActiveWorkspaceFromWatch(_wsPath, change = null) {
    const changedPath = change?.fsPath || "";
    if (
      !isWatchChangeRelevant({
        changedPath,
        documentConversionEnabled: runtimeState.documentConversionEnabled,
      })
    ) {
      return;
    }

    await refreshActiveWorkspace({
      preserveCurrentContent: true,
      changedPath,
    });
  }

  function setAppZoomLevel(zoomLevel) {
    const win = getMainWindow();
    if (!win) return;
    const nextZoom = clampZoomLevel(normalizeZoomStep(zoomLevel, ZOOM_LEVEL_STEP), ZOOM_LEVEL_MIN, ZOOM_LEVEL_MAX);
    win.webContents.setZoomLevel(nextZoom);
  }

  function clampAppZoom() {
    const win = getMainWindow();
    if (!win) return;
    setAppZoomLevel(win.webContents.getZoomLevel());
  }

  const commandHandlers = registerRuntimeCommandHandlers({
    state: runtimeState,
    pathApi,
    fs,
    dialog,
    getMainWindow,
    sendHostMessage,
    getHostInfo,
    sendLoading,
    sendRecentWorkspacesChanged,
    recentWorkspacesStore,
    createStartupReadyAck,
    deferWorkspaceLoad,
    ensureHeavyModules,
    scanWorkspaceData,
    perf,
    appQuit,
    isSupportedFilePathLite,
    isExtraDocumentFilePathLite,
    getOpenDialogFiltersLite,
    ensureSearchIndex,
    ensureCrossTabSearchWorker,
    getWorkspacePathStatus,
    sendWorkspaceUnavailable,
    bindWorkspaceWatch,
    sendWorkspaceData,
    sendInitialContent,
    sendContent,
    sendWelcome,
    refreshActiveWorkspace,
    resolveNavigationPath,
    setAppZoomLevel,
    ZOOM_LEVEL_STEP,
    isAccessDeniedError,
    decodeNavigationPath,
    stripNavigationFragment,
    isRootRelativeWorkspaceHref,
    isSameOrInsidePath,
    deps,
  });
  const {
    handleReady,
    handleOpenFolder,
    handleOpenFile,
    handleOpenPath,
    handleActivateWorkspace,
    handleSearchAcrossWorkspaces,
    handleSearchWorkspace,
    handleIndexWorkspaceSearchItems,
    handleLoadWorkspaceSearchIndexes,
    handleConfirmOpenPath,
    handleOpenRecent,
    handleDeleteRecentWorkspace,
    handleReplaceRecentWorkspaces,
    handleZoomIn,
    handleZoomOut,
    handleNavigate,
    handleRefresh,
    handleSetDocumentConversion,
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace
  } = commandHandlers;

  async function refreshActiveWorkspace({
    showLoading = false,
    loadingLabel = "Refreshing workspace...",
    preserveCurrentContent = false,
    changedPath = "",
  } = {}) {
    if (!runtimeState.workspacePath) return;

    const status = getWorkspacePathStatus(runtimeState.workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(runtimeState.workspacePath, status.reason);
      return;
    }

    if (showLoading) {
      sendLoading(loadingLabel);
    }

    if (preserveCurrentContent) {
      await sendWorkspaceFilesChanged();
      const currentFileStillAvailable = isCurrentFileStillAvailable();
      if (
        shouldNotifyCurrentFileChanged({
          currentFile: runtimeState.currentFile,
          changedPath,
          currentFileStillAvailable,
        })
      ) {
        sendCurrentFileChanged();
      }
      return;
    }

    await sendWorkspaceData();

    if (!isCurrentFileStillAvailable()) {
      runtimeState.currentFile = null;
    }

    if (runtimeState.currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

  function dispose() {
    if (runtimeState.workspaceWatch) runtimeState.workspaceWatch.dispose();
    if (runtimeState.crossTabSearchWorker) runtimeState.crossTabSearchWorker.dispose();
  }

  const state = runtimeState;

  return {
    state,
    handleReady,
    handleOpenFolder,
    handleOpenFile,
    handleOpenPath,
    handleActivateWorkspace,
    handleSearchAcrossWorkspaces,
    handleSearchWorkspace,
    handleIndexWorkspaceSearchItems,
    handleLoadWorkspaceSearchIndexes,
    handleConfirmOpenPath,
    handleOpenRecent,
    handleDeleteRecentWorkspace,
    handleReplaceRecentWorkspaces,
    handleZoomIn,
    handleZoomOut,
    handleNavigate,
    handleRefresh,
    handleSetDocumentConversion,
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace,
    clampAppZoom,
    refreshActiveWorkspace,
    refreshActiveWorkspaceFromWatch,
    dispose,
  };
}

module.exports = {
  createDesktopRuntime,
  isSupportedFilePathLite,
  isExtraDocumentFilePathLite,
  getFileTypeLabelLite,
  getOpenDialogFiltersLite,
  stripKnownExtensionLite,
  isAccessDeniedError,
  clampZoomLevel,
  normalizeZoomStep,
  stripNavigationFragment,
  decodeNavigationPath,
  isRootRelativeWorkspaceHref,
  isSameOrInsidePath,
};
