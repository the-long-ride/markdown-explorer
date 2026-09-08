const ZOOM_LEVEL_MIN = -2.5, ZOOM_LEVEL_MAX = 2, ZOOM_LEVEL_STEP = 0.2;
const { registerRuntimeCommandHandlers } = require("./runtime-command-handlers");
const { registerRuntimeWorkspaceHandlers } = require("./runtime-workspace-handlers");
const { documentWriteCapabilityFor, saveWorkspaceDocument } = require("../workspace/document-write");

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
    workspaceOperationId: null,
    workspaceTabId: null,
  };

  const getWorkspaceOperationMetadata = () => ({
    ...(runtimeState.workspaceOperationId ? { workspaceOperationId: runtimeState.workspaceOperationId } : {}),
    ...(runtimeState.workspaceTabId ? { workspaceTabId: runtimeState.workspaceTabId } : {}),
  });
  const sendScopedHostMessage = (message) => {
    const scopedMessage = message?.command === "renderContent"
      ? { ...message, documentWrite: documentWriteCapabilityFor(message.filePath, fs) }
      : message;
    sendHostMessage({
      ...getWorkspaceOperationMetadata(),
      ...scopedMessage,
    });
  };
  const sendScopedLoading = (label, detail) => sendLoading(label, detail, getWorkspaceOperationMetadata());

  const workspaceHandlers = registerRuntimeWorkspaceHandlers({
    state: runtimeState,
    deps,
    pathApi,
    fs,
    getMainWindow,
    sendHostMessage: sendScopedHostMessage,
    getHostInfo,
    sendLoading: sendScopedLoading,
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
    sendWelcome,
    readWorkspaceTextResource,
    cancelWorkspaceScan,
    cancelAllWorkspaceScans
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

  function resetAppZoom() {
    const win = getMainWindow();
    if (!win) return;
    win.webContents.setZoomLevel(0);
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
    sendHostMessage: sendScopedHostMessage,
    getHostInfo,
    sendLoading: sendScopedLoading,
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
    resetAppZoom,
    ZOOM_LEVEL_STEP,
    isAccessDeniedError,
    decodeNavigationPath,
    stripNavigationFragment,
    isRootRelativeWorkspaceHref,
    isSameOrInsidePath,
    cancelWorkspaceScan,
    cancelAllWorkspaceScans,
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
    handleLoadSearchPreview,
    handleIndexWorkspaceSearchItems,
    handleLoadWorkspaceSearchIndexes,
    handleConfirmOpenPath,
    handleOpenRecent,
    handleDeleteRecentWorkspace,
    handleReplaceRecentWorkspaces,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleNavigate,
    handleRefresh,
    handleSetDocumentConversion,
    handleListDesktopFonts,
    handleImportDesktopFonts,
    handleRemoveImportedDesktopFont,
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace,
    handleCancelWorkspaceScan,
    handleCancelAllWorkspaceScans
  } = commandHandlers;
  const gitHistoryHandlers = require("../git/document-history").createGitHistoryMessageHandlers({ getWorkspacePath: () => runtimeState.workspacePath, sendHostMessage: sendScopedHostMessage });

  async function handleSaveDocument(message = {}) {
    const filePath = typeof message.filePath === 'string' ? message.filePath : '';
    const result = await saveWorkspaceDocument({
      workspacePath: runtimeState.workspacePath,
      filePath,
      source: message.source,
      expectedRevision: message.expectedRevision ?? null,
      force: message.force === true,
      fsApi: fs,
      pathApi,
    });
    sendScopedHostMessage({
      command: 'saveDocumentResult',
      requestId: typeof message.requestId === 'string' ? message.requestId : '',
      filePath,
      ...result,
    });
  }

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
      sendScopedLoading(loadingLabel);
    }

    if (preserveCurrentContent) {
      const completed = await sendWorkspaceFilesChanged();
      if (!completed) return;
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

    const completed = await sendWorkspaceData();
    if (!completed) return;

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
    handleLoadSearchPreview,
    handleIndexWorkspaceSearchItems,
    handleLoadWorkspaceSearchIndexes,
    handleConfirmOpenPath,
    handleOpenRecent,
    handleDeleteRecentWorkspace,
    handleReplaceRecentWorkspaces,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleNavigate,
    handleRefresh,
    handleSetDocumentConversion,
    handleListDesktopFonts,
    handleImportDesktopFonts,
    handleRemoveImportedDesktopFont,
    handleSaveDocument,
    ...gitHistoryHandlers,
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace,
    handleCancelWorkspaceScan,
    handleCancelAllWorkspaceScans,
    readWorkspaceTextResource,
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