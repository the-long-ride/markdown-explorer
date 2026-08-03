const { createRuntimeCommandSearchHandlers } = require("./runtime-command-search-handlers");
const { registerRuntimeUpdateHandlers } = require("./runtime-update-handlers");

function registerRuntimeCommandHandlers(context) {
  const { state, deps, pathApi, fs, dialog, getMainWindow, sendHostMessage, getHostInfo, sendLoading, sendRecentWorkspacesChanged, recentWorkspacesStore, createStartupReadyAck, deferWorkspaceLoad, ensureHeavyModules, scanWorkspaceData, perf, appQuit, isSupportedFilePathLite, isExtraDocumentFilePathLite, getOpenDialogFiltersLite, ensureSearchIndex, ensureCrossTabSearchWorker, getWorkspacePathStatus, sendWorkspaceUnavailable, bindWorkspaceWatch, sendWorkspaceData, sendInitialContent, sendContent, sendWelcome, refreshActiveWorkspace, resolveNavigationPath, setAppZoomLevel, ZOOM_LEVEL_STEP, isAccessDeniedError, decodeNavigationPath, stripNavigationFragment, isRootRelativeWorkspaceHref, isSameOrInsidePath, cancelWorkspaceScan, cancelAllWorkspaceScans } = context;

  function applyWorkspaceOperation(message = {}) {
    if (typeof message.workspaceOperationId === 'string') {
      state.workspaceOperationId = message.workspaceOperationId;
    }
    if (typeof message.workspaceTabId === 'string') {
      state.workspaceTabId = message.workspaceTabId;
    }
  }

  async function handleReady(msg = {}) {
    if (typeof msg.documentConversionEnabled === "boolean") {
      state.documentConversionEnabled = msg.documentConversionEnabled;
    }

    if (state.readyHandled) return;
    state.readyHandled = true;
    perf.mark("host:ready");
    const recents = recentWorkspacesStore.load();
    const ackMsg = createStartupReadyAck({
      workspacePath: state.workspacePath,
      recentWorkspaces: recents,
      documentConversionEnabled: state.documentConversionEnabled,
      hostInfo: getHostInfo(),
    });
    const workspaceOperationMetadata = msg.workspaceOperationMetadata || {};
    sendHostMessage({ ...ackMsg, ...workspaceOperationMetadata });
    perf.mark("host:ready-ack");
    perf.measure("host ready to readyAck", "host:ready", "host:ready-ack");
    perf.printSummary();
    deps.updateManager?.sendCurrentState();

    if (state.workspacePath) {
      deferWorkspaceLoad({
        ensureHeavyModules,
        bindWorkspaceWatch,
        sendLoading,
        sendWorkspaceData,
        sendInitialContent,
        sendUpdateState: () => deps.updateManager?.sendCurrentState(),
        onError: (err) => console.error("Failed to load startup workspace:", err),
      });
    }
  }

  function handleOpenFolder(openFirstFile = false, operation = {}) {
    applyWorkspaceOperation(operation);
    ensureHeavyModules();
    const folders = dialog.showOpenDialogSync(getMainWindow(), {
      properties: ["openDirectory"],
    });
    if (!folders || folders.length === 0) {
      sendHostMessage({
        command: "workspaceOpenCancelled",
        workspaceOperationId: operation.workspaceOperationId,
        workspaceTabId: operation.workspaceTabId,
      });
      state.workspaceOperationId = null;
      state.workspaceTabId = null;
      return;
    }

    const selectedFolder = folders[0];
    if (operation.replaceRecentWorkspacePath && operation.replaceRecentWorkspacePath !== selectedFolder) {
      recentWorkspacesStore.remove(operation.replaceRecentWorkspacePath);
    }
    recentWorkspacesStore.save(selectedFolder);
    sendRecentWorkspacesChanged();
    state.workspacePath = selectedFolder;
    state.currentFile = null;
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    sendWorkspaceData().then((completed) => completed && sendInitialContent(openFirstFile));
  }

  function handleOpenFile(operation = {}) {
    applyWorkspaceOperation(operation);
    ensureHeavyModules();
    const files = dialog.showOpenDialogSync(getMainWindow(), {
      properties: ["openFile"],
      filters: getOpenDialogFiltersLite(state.documentConversionEnabled),
    });
    if (files && files.length > 0) {
      const selectedFile = files[0];
      const folder = pathApi.dirname(selectedFile);
      recentWorkspacesStore.save(folder);
      sendRecentWorkspacesChanged();
      state.workspacePath = folder;
      state.currentFile = selectedFile;
      bindWorkspaceWatch();
      sendLoading(
        isExtraDocumentFilePathLite(selectedFile) ? "Preparing document preview..." : "Loading docs...",
      );
      sendWorkspaceData().then((completed) => completed && sendContent());
    }
  }

  function handleOpenPath(filePath, openFirstFile = false, operation = {}) {
    applyWorkspaceOperation(operation);
    ensureHeavyModules();
    const status = getWorkspacePathStatus(filePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(filePath, status.reason);
      return;
    }

    const stat = status.stat;
    const isFile = stat.isFile();
    if (isFile) {
      if (!isSupportedFilePathLite(filePath, state.documentConversionEnabled)) {
        dialog.showMessageBoxSync(getMainWindow(), {
          type: "warning",
          buttons: ["OK"],
          title: "Unsupported File Type",
          message: state.documentConversionEnabled
            ? "Markdown Explorer cannot preview this file type."
            : "Turn on document conversion in Markdown Explorer settings to preview DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
          detail: filePath,
        });
        return;
      }
      state.workspacePath = pathApi.dirname(filePath);
      state.currentFile = filePath;
    } else {
      state.workspacePath = filePath;
      state.currentFile = null;
    }

    recentWorkspacesStore.save(state.workspacePath);
    sendRecentWorkspacesChanged();
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    sendWorkspaceData().then((completed) => completed && sendInitialContent(openFirstFile && !isFile));
  }

  function handleActivateWorkspace(wsPath, filePath, openFirstFile = false, operation = {}) {
    applyWorkspaceOperation(operation);
    const status = getWorkspacePathStatus(wsPath);
    if (!status.ok) {
      sendWorkspaceUnavailable(wsPath, status.reason);
      return;
    }

    state.workspacePath = wsPath;
    state.currentFile =
      filePath &&
      fs.existsSync(filePath) &&
      isSupportedFilePathLite(filePath, state.documentConversionEnabled)
        ? filePath
        : null;
    recentWorkspacesStore.save(state.workspacePath);
    sendRecentWorkspacesChanged();
    deferWorkspaceLoad({
      ensureHeavyModules,
      bindWorkspaceWatch,
      sendLoading,
      sendWorkspaceData,
      sendInitialContent,
      openFirstFile,
      onError: (err) => console.error("Failed to activate workspace:", err),
    });
  }

  const { handleSearchAcrossWorkspaces, handleSearchWorkspace, handleLoadSearchPreview,
    handleIndexWorkspaceSearchItems, handleLoadWorkspaceSearchIndexes } =
    createRuntimeCommandSearchHandlers({ state, fs, ensureHeavyModules, ensureSearchIndex,
      ensureCrossTabSearchWorker, scanWorkspaceData, sendHostMessage });

  async function handleConfirmOpenPath(filePath) {
    if (!fs.existsSync(filePath)) return;
    if (!state.workspacePath) {
      handleOpenPath(filePath);
      return;
    }
    const stat = fs.statSync(filePath);
    const isFile = stat.isFile();
    if (isFile) {
      if (!isSupportedFilePathLite(filePath, state.documentConversionEnabled)) {
        dialog.showMessageBoxSync(getMainWindow(), {
          type: "warning",
          buttons: ["OK"],
          title: "Unsupported File Type",
          message: state.documentConversionEnabled
            ? "Markdown Explorer cannot preview this file type."
            : "Turn on document conversion in Markdown Explorer settings to preview DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
          detail: filePath,
        });
        return;
      }
    }

    const targetFolder = isFile ? pathApi.dirname(filePath) : filePath;
    const targetName = pathApi.basename(targetFolder) || targetFolder;
    const currentName = state.workspacePath
      ? (pathApi.basename(state.workspacePath) || state.workspacePath)
      : "current workspace";
    const { response } = await dialog.showMessageBox(getMainWindow(), {
      type: "question",
      buttons: ["Switch", "Cancel"],
      title: "Switch Workspace",
      message: `Switch to "${targetName}"?`,
      detail: `Current workspace: ${currentName}\nNew path: ${filePath}`,
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      handleOpenPath(filePath);
    }
  }

  function handleOpenRecent(folderPath, openFirstFile = false, operation = {}) {
    applyWorkspaceOperation(operation);
    ensureHeavyModules();
    const status = getWorkspacePathStatus(folderPath);
    if (!status.ok) {
      sendWorkspaceUnavailable(folderPath, status.reason);
      return;
    }

    recentWorkspacesStore.save(folderPath);
    sendRecentWorkspacesChanged();
    state.workspacePath = folderPath;
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    if (status.stat.isFile()) {
      state.currentFile = folderPath;
      sendWorkspaceData().then((completed) => completed && sendInitialContent(false));
    } else {
      state.currentFile = null;
      sendWorkspaceData().then((completed) => completed && sendInitialContent(openFirstFile));
    }
  }

  function handleDeleteRecentWorkspace(folderPath) {
    try {
      recentWorkspacesStore.remove(folderPath);
    } catch (err) {
      console.error("Failed to delete recent workspace:", err);
    }
    sendRecentWorkspacesChanged();
  }

  function handleReplaceRecentWorkspaces(recentWorkspaces) {
    try {
      recentWorkspacesStore.replace(recentWorkspaces);
    } catch (err) {
      console.error("Failed to replace recent workspaces:", err);
    }
    sendRecentWorkspacesChanged();
  }

  function handleZoomIn() {
    const win = getMainWindow();
    if (!win) return;
    const currentZoom = win.webContents.getZoomLevel();
    setAppZoomLevel(currentZoom + ZOOM_LEVEL_STEP);
  }

  function handleZoomOut() {
    const win = getMainWindow();
    if (!win) return;
    const currentZoom = win.webContents.getZoomLevel();
    setAppZoomLevel(currentZoom - ZOOM_LEVEL_STEP);
  }

  async function handleNavigate(filePath) {
    ensureHeavyModules();
    if (!filePath) {
      state.currentFile = null;
      await sendWelcome();
      return;
    }

    filePath = resolveNavigationPath(filePath);

    if (
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile() &&
      isSupportedFilePathLite(filePath, state.documentConversionEnabled)
    ) {
      state.currentFile = filePath;
      await sendContent();
    } else {
      sendHostMessage({
        command: "navNotFound",
        href: filePath,
      });
    }
  }

  async function handleRefresh() {
    await refreshActiveWorkspace({ showLoading: true });
  }

  async function handleSetDocumentConversion(enabled) {
    ensureHeavyModules();
    const nextEnabled = enabled === true;
    if (state.documentConversionEnabled === nextEnabled) return;
    state.documentConversionEnabled = nextEnabled;

    if (!state.workspacePath) return;

    sendLoading(nextEnabled ? "Finding supported documents..." : "Refreshing Markdown files...");
    const completed = await sendWorkspaceData();
    if (!completed) return;

    if (state.currentFile && !isSupportedFilePathLite(state.currentFile, state.documentConversionEnabled)) {
      state.currentFile = null;
      await sendWelcome();
      return;
    }

    if (state.currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

  function handleCancelWorkspaceScan(workspaceOperationId) {
    cancelWorkspaceScan(workspaceOperationId);
  }

  function handleCancelAllWorkspaceScans() {
    cancelAllWorkspaceScans();
  }

  const {
    handleDownloadUpdate,
    handleScheduleDownloadedUpdate,
    handleRestartAndApplyUpdate,
    handleCloseWorkspace,
  } = registerRuntimeUpdateHandlers({ deps, appQuit, state, handleReady });



  return { handleReady, handleOpenFolder, handleOpenFile, handleOpenPath, handleActivateWorkspace, handleSearchAcrossWorkspaces, handleSearchWorkspace, handleLoadSearchPreview, handleIndexWorkspaceSearchItems, handleLoadWorkspaceSearchIndexes, handleConfirmOpenPath, handleOpenRecent, handleDeleteRecentWorkspace, handleReplaceRecentWorkspaces, handleZoomIn, handleZoomOut, handleNavigate, handleRefresh, handleSetDocumentConversion, handleDownloadUpdate, handleScheduleDownloadedUpdate, handleRestartAndApplyUpdate, handleCloseWorkspace, handleCancelWorkspaceScan, handleCancelAllWorkspaceScans };
}

module.exports = { registerRuntimeCommandHandlers };
