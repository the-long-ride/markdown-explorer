const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;

function isSupportedFilePathLite(filePath, docConvEnabled) {
  if (!filePath) return false;
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  if ([".md", ".mdx", ".markdown", ".txt"].includes(ext)) return true;
  if (docConvEnabled && [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext)) return true;
  return false;
}

function isExtraDocumentFilePathLite(filePath) {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext);
}

function getFileTypeLabelLite(filePath) {
  const dotIndex = filePath.lastIndexOf(".");
  const ext = dotIndex === -1 ? filePath.toLowerCase() : filePath.slice(dotIndex + 1).toLowerCase();
  const labels = { doc: "Word", docx: "Word", pdf: "PDF", html: "HTML", xls: "Excel", xlsx: "Excel", xlm: "Excel", pptx: "PowerPoint", odt: "OpenDocument Text", odp: "OpenDocument Presentation", ods: "OpenDocument Spreadsheet", rtf: "Rich Text" };
  return labels[ext] || ext.toUpperCase();
}

function getOpenDialogFiltersLite(docConvEnabled) {
  const filters = [{ name: "Markdown", extensions: ["md", "mdx", "markdown"] }];
  if (docConvEnabled) filters.push(
    { name: "Documents", extensions: ["doc", "docx", "pdf", "html", "xls", "xlsx", "xlm", "pptx", "odt", "odp", "ods", "rtf"] },
    { name: "All Files", extensions: ["*"] },
  );
  return filters;
}

function stripKnownExtensionLite(filename) {
  return filename.replace(/\.(md|mdx|markdown|txt|doc|docx|pdf|html|xls|xlsx|xlm|pptx|odt|odp|ods|rtf)$/i, "");
}

function isAccessDeniedError(err) {
  return err && (err.code === "EACCES" || err.code === "EPERM");
}

function clampZoomLevel(zoomLevel, min, max) {
  return Math.min(max, Math.max(min, zoomLevel));
}

function normalizeZoomStep(zoomLevel, step) {
  return Math.round(zoomLevel / step) * step;
}

function stripNavigationFragment(filePath) {
  const hashIndex = filePath.indexOf("#");
  return hashIndex === -1 ? filePath : filePath.slice(0, hashIndex);
}

function decodeNavigationPath(filePath) {
  try {
    return decodeURIComponent(filePath);
  } catch {
    return filePath;
  }
}

function isRootRelativeWorkspaceHref(filePath) {
  return (
    filePath.startsWith("/") &&
    !filePath.startsWith("//") &&
    !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(filePath)
  );
}

function isSameOrInsidePath(parentPath, childPath, pathApi) {
  const relative = pathApi.relative(pathApi.resolve(parentPath), pathApi.resolve(childPath));
  return relative === "" || (!!relative && !relative.startsWith("..") && !pathApi.isAbsolute(relative));
}

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

  let workspacePath = null;
  let currentFile = null;
  let flatList = [];
  let readyHandled = false;
  let documentConversionEnabled = false;
  let searchIndex = null;
  let crossTabSearchWorker = null;
  let workspaceWatch = null;

  function ensureSearchIndex() {
    if (!searchIndex) searchIndex = createSearchIndex();
    return searchIndex;
  }

  function ensureCrossTabSearchWorker() {
    if (crossTabSearchWorker) return crossTabSearchWorker;
    crossTabSearchWorker = createSearchWorkerController({
      onMessage(message) {
        const win = getMainWindow();
        if (!win || win.isDestroyed()) return;
        if (message.type === "batch") {
          sendHostMessage({
            command: "crossTabSearchResults",
            requestId: message.requestId,
            results: message.results,
            done: false,
          });
          return;
        }
        if (message.type === "done" || message.type === "error") {
          sendHostMessage({
            command: "crossTabSearchResults",
            requestId: message.requestId,
            results: [],
            done: true,
            total: message.total || 0,
            truncated: Boolean(message.truncated),
            cancelled: Boolean(message.cancelled),
            error: message.type === "error" ? message.message : undefined,
          });
        }
      },
    });
    return crossTabSearchWorker;
  }

  function getWorkspacePathStatus(wsPath) {
    if (!wsPath || typeof wsPath !== "string") {
      return { ok: false, reason: "missing" };
    }
    try {
      fs.accessSync(wsPath, fs.constants.R_OK);
      const stat = fs.statSync(wsPath);
      return { ok: true, stat };
    } catch (err) {
      return {
        ok: false,
        reason: isAccessDeniedError(err) ? "locked" : "missing",
      };
    }
  }

  function sendWorkspaceUnavailable(wsPath, reason = "missing") {
    if (workspaceWatch) workspaceWatch.dispose();
    workspacePath = null;
    currentFile = null;
    flatList = [];
    sendHostMessage({
      command: "workspaceUnavailable",
      workspacePath: wsPath,
      workspaceName: pathApi.basename(wsPath || "") || wsPath || "Workspace",
      reason,
      recentWorkspaces: recentWorkspacesStore.load(),
      ...getHostInfo(),
    });
  }

  function getWorkspaceBaseDir() {
    if (!workspacePath || !fs.existsSync(workspacePath)) return null;
    return fs.statSync(workspacePath).isFile()
      ? pathApi.dirname(workspacePath)
      : workspacePath;
  }

  function isCurrentFileStillAvailable() {
    if (!currentFile) return false;
    const status = getWorkspacePathStatus(currentFile);
    if (!status.ok || !status.stat.isFile()) return false;
    if (!isSupportedFilePathLite(currentFile, documentConversionEnabled)) return false;
    return flatList.some((file) => file.fsPath === currentFile);
  }

  function resolveNavigationPath(filePath) {
    const requestedPath = decodeNavigationPath(stripNavigationFragment(String(filePath)));
    if (!requestedPath && currentFile) return currentFile;

    const baseDir = getWorkspaceBaseDir();
    const currentDir = currentFile ? pathApi.dirname(currentFile) : baseDir;

    if (baseDir && pathApi.isAbsolute(requestedPath) && isSameOrInsidePath(baseDir, requestedPath, pathApi)) {
      return requestedPath;
    }

    if (baseDir && isRootRelativeWorkspaceHref(requestedPath)) {
      return pathApi.resolve(baseDir, `.${requestedPath}`);
    }

    if (!pathApi.isAbsolute(requestedPath) && currentDir) {
      return pathApi.resolve(currentDir, requestedPath);
    }

    return requestedPath;
  }

  function sendCurrentFileChanged() {
    if (!currentFile) return;
    sendHostMessage({
      command: "currentFileChanged",
      filePath: currentFile,
    });
  }

  async function sendWorkspaceFilesChanged() {
    if (!workspacePath) return;
    const status = getWorkspacePathStatus(workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(workspacePath, status.reason);
      return;
    }

    const { tree, flat } = await scanWorkspaceData(workspacePath);
    flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    sendHostMessage({
      command: "workspaceFilesChanged",
      fileList: flat,
      tree,
      workspaceName: pathApi.basename(workspacePath),
      workspacePath,
      documentConversionEnabled,
    });
  }

  async function sendWorkspaceData() {
    if (!workspacePath) return;
    const status = getWorkspacePathStatus(workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(workspacePath, status.reason);
      return;
    }

    const { tree, flat } = await scanWorkspaceData(workspacePath);
    flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    const workspaceName = pathApi.basename(workspacePath);
    const recents = recentWorkspacesStore.load();

    sendHostMessage({
      command: "readyAck",
      fileList: flat,
      tree,
      theme: "dark",
      themeStyle: "default",
      defaultExpanded: true,
      workspaceName,
      workspacePath,
      recentWorkspaces: recents,
      documentConversionEnabled,
      ...getHostInfo(),
    });
  }

  async function sendInitialContent(openFirstFile = false) {
    if (openFirstFile && !currentFile && flatList.length > 0) {
      currentFile = flatList[0].fsPath;
    }
    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

  async function sendContent() {
    if (!currentFile || !workspacePath) return;
    if (!isSupportedFilePathLite(currentFile, documentConversionEnabled)) {
      currentFile = null;
      await sendWelcome();
      return;
    }

    let raw = "";
    let previewInfo = null;
    try {
      if (isExtraDocumentFilePathLite(currentFile)) {
        sendLoading(
          "Preparing document preview...",
          `Preparing ${getFileTypeLabelLite(currentFile)} preview locally.`,
        );
      }
      const result = await deps.documentConverter.readMarkdown(currentFile);
      raw = result.markdown;
      previewInfo = result.previewInfo;
    } catch (err) {
      raw = deps.documentConverter.createFailureMarkdown(currentFile, err);
      previewInfo = isExtraDocumentFilePathLite(currentFile)
        ? {
            kind: "converted",
            sourceExtension: pathApi.extname(currentFile).toLowerCase(),
            sourceLabel: getFileTypeLabelLite(currentFile),
            qualityWarning: "Markdown Explorer could not convert this file. The details are shown below.",
          }
        : null;
    }

    const isWorkspaceFile = fs.statSync(workspacePath).isFile();
    const baseDir = isWorkspaceFile ? pathApi.dirname(workspacePath) : workspacePath;
    const fileInfo = flatList.find((f) => f.fsPath === currentFile) || {
      relativePath: pathApi.relative(baseDir, currentFile),
      title: stripKnownExtensionLite(pathApi.basename(currentFile)),
    };

    sendHostMessage({
      command: "renderContent",
      html: "",
      markdownSource: raw,
      frontmatter: {},
      toc: [],
      filePath: currentFile,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: flatList,
      previewInfo,
    });
  }

  async function sendWelcome() {
    sendHostMessage({
      command: "renderContent",
      html: "",
      markdownSource: "",
      frontmatter: {},
      toc: [],
      filePath: "",
      relativePath: "Welcome Page",
      title: "Welcome",
      fileList: flatList,
      previewInfo: null,
    });
  }

  function bindWorkspaceWatch() {
    if (!workspaceWatch) {
      workspaceWatch = createWorkspaceWatchController({
        fs,
        setTimeout: setTimeoutImpl,
        clearTimeout: clearTimeoutImpl,
        debounceMs: 120,
        onRefresh: (...args) => refreshActiveWorkspaceFromWatch(...args),
      });
    }
    workspaceWatch.watchWorkspace(getWorkspaceBaseDir());
  }

  async function refreshActiveWorkspaceFromWatch(_wsPath, change = null) {
    const changedPath = change?.fsPath || "";
    if (
      !isWatchChangeRelevant({
        changedPath,
        documentConversionEnabled,
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

  async function handleReady(msg = {}) {
    if (typeof msg.documentConversionEnabled === "boolean") {
      documentConversionEnabled = msg.documentConversionEnabled;
    }

    if (readyHandled) return;
    readyHandled = true;
    perf.mark("host:ready");
    const recents = recentWorkspacesStore.load();
    const ackMsg = createStartupReadyAck({
      workspacePath,
      recentWorkspaces: recents,
      documentConversionEnabled,
      hostInfo: getHostInfo(),
    });
    sendHostMessage(ackMsg);
    perf.mark("host:ready-ack");
    perf.measure("host ready to readyAck", "host:ready", "host:ready-ack");
    perf.printSummary();
    deps.updateManager?.sendCurrentState();

    if (workspacePath) {
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

  function handleOpenFolder(openFirstFile = false) {
    ensureHeavyModules();
    const folders = dialog.showOpenDialogSync(getMainWindow(), {
      properties: ["openDirectory"],
    });
    if (folders && folders.length > 0) {
      const selectedFolder = folders[0];
      recentWorkspacesStore.save(selectedFolder);
      workspacePath = selectedFolder;
      currentFile = null;
      bindWorkspaceWatch();
      sendLoading("Loading workspace...");
      sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
    }
  }

  function handleOpenFile() {
    ensureHeavyModules();
    const files = dialog.showOpenDialogSync(getMainWindow(), {
      properties: ["openFile"],
      filters: getOpenDialogFiltersLite(documentConversionEnabled),
    });
    if (files && files.length > 0) {
      const selectedFile = files[0];
      const folder = pathApi.dirname(selectedFile);
      recentWorkspacesStore.save(folder);
      workspacePath = folder;
      currentFile = selectedFile;
      bindWorkspaceWatch();
      sendLoading(
        isExtraDocumentFilePathLite(selectedFile) ? "Preparing document preview..." : "Loading docs...",
      );
      sendWorkspaceData().then(() => sendContent());
    }
  }

  function handleOpenPath(filePath, openFirstFile = false) {
    ensureHeavyModules();
    const status = getWorkspacePathStatus(filePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(filePath, status.reason);
      return;
    }

    const stat = status.stat;
    const isFile = stat.isFile();
    if (isFile) {
      if (!isSupportedFilePathLite(filePath, documentConversionEnabled)) {
        dialog.showMessageBoxSync(getMainWindow(), {
          type: "warning",
          buttons: ["OK"],
          title: "Unsupported File Type",
          message: documentConversionEnabled
            ? "Markdown Explorer cannot preview this file type."
            : "Turn on document conversion in Markdown Explorer settings to preview DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
          detail: filePath,
        });
        return;
      }
      workspacePath = pathApi.dirname(filePath);
      currentFile = filePath;
    } else {
      workspacePath = filePath;
      currentFile = null;
    }

    recentWorkspacesStore.save(workspacePath);
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    sendWorkspaceData().then(() => sendInitialContent(openFirstFile && !isFile));
  }

  function handleActivateWorkspace(wsPath, filePath, openFirstFile = false) {
    const status = getWorkspacePathStatus(wsPath);
    if (!status.ok) {
      sendWorkspaceUnavailable(wsPath, status.reason);
      return;
    }

    workspacePath = wsPath;
    currentFile =
      filePath &&
      fs.existsSync(filePath) &&
      isSupportedFilePathLite(filePath, documentConversionEnabled)
        ? filePath
        : null;
    recentWorkspacesStore.save(workspacePath);
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

  function handleSearchAcrossWorkspaces(msg) {
    ensureHeavyModules();
    ensureCrossTabSearchWorker().search({
      requestId: msg.requestId,
      query: String(msg.query || "").trim().toLowerCase(),
    });
  }

  function handleSearchWorkspace(msg) {
    ensureHeavyModules();
    const idx = ensureSearchIndex();
    const query = String(msg.query || "").trim().toLowerCase();
    const requestId = msg.requestId;
    const items = Array.isArray(msg.items) && msg.items.length > 0 ? msg.items : flatList;
    sendHostMessage({
      command: "workspaceSearchResults",
      requestId,
      results: idx.search(query, items, 10000),
    });
  }

  function handleIndexWorkspaceSearchItems(msg) {
    ensureHeavyModules();
    ensureCrossTabSearchWorker().setItems(Array.isArray(msg.items) ? msg.items : []);
  }

  function handleLoadWorkspaceSearchIndexes(msg) {
    ensureHeavyModules();
    const tabRequests = Array.isArray(msg.tabs) ? msg.tabs : [];
    if (tabRequests.length === 0) return;

    let index = 0;

    async function processNext() {
      if (index >= tabRequests.length) return;

      const tab = tabRequests[index];
      const tabId = String(tab?.tabId || "");
      const wsPath = String(tab?.workspacePath || "");

      if (tabId && wsPath) {
        if (fs.existsSync(wsPath)) {
          try {
            const { tree, flat } = await scanWorkspaceData(wsPath);
            const idx = ensureSearchIndex();
            idx.prime(flat);
            sendHostMessage({
              command: "workspaceSearchIndexLoaded",
              tabs: [{
                tabId,
                workspacePath: wsPath,
                fileList: flat,
                tree,
              }],
            });
          } catch (err) {
            sendHostMessage({
              command: "workspaceSearchIndexLoaded",
              tabs: [{
                tabId,
                workspacePath: wsPath,
                fileList: [],
                tree: null,
              }],
            });
          }
        } else {
          sendHostMessage({
            command: "workspaceSearchIndexLoaded",
            tabs: [{
              tabId,
              workspacePath: wsPath,
              fileList: [],
              tree: null,
            }],
          });
        }
      }

      index += 1;
      setTimeout(processNext, 150);
    }

    setTimeout(processNext, 50);
  }

  async function handleConfirmOpenPath(filePath) {
    if (!fs.existsSync(filePath)) return;
    if (!workspacePath) {
      handleOpenPath(filePath);
      return;
    }
    const stat = fs.statSync(filePath);
    const isFile = stat.isFile();
    if (isFile) {
      if (!isSupportedFilePathLite(filePath, documentConversionEnabled)) {
        dialog.showMessageBoxSync(getMainWindow(), {
          type: "warning",
          buttons: ["OK"],
          title: "Unsupported File Type",
          message: documentConversionEnabled
            ? "Markdown Explorer cannot preview this file type."
            : "Turn on document conversion in Markdown Explorer settings to preview DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
          detail: filePath,
        });
        return;
      }
    }

    const targetFolder = isFile ? pathApi.dirname(filePath) : filePath;
    const targetName = pathApi.basename(targetFolder) || targetFolder;
    const currentName = workspacePath
      ? (pathApi.basename(workspacePath) || workspacePath)
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

  function handleOpenRecent(folderPath, openFirstFile = false) {
    ensureHeavyModules();
    const status = getWorkspacePathStatus(folderPath);
    if (!status.ok) {
      sendWorkspaceUnavailable(folderPath, status.reason);
      return;
    }

    recentWorkspacesStore.save(folderPath);
    workspacePath = folderPath;
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    if (status.stat.isFile()) {
      currentFile = folderPath;
      sendWorkspaceData().then(() => sendInitialContent(false));
    } else {
      currentFile = null;
      sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
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
      currentFile = null;
      await sendWelcome();
      return;
    }

    filePath = resolveNavigationPath(filePath);

    if (
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile() &&
      isSupportedFilePathLite(filePath, documentConversionEnabled)
    ) {
      currentFile = filePath;
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
    if (documentConversionEnabled === nextEnabled) return;
    documentConversionEnabled = nextEnabled;

    if (!workspacePath) return;

    sendLoading(nextEnabled ? "Finding supported documents..." : "Refreshing Markdown files...");
    await sendWorkspaceData();

    if (currentFile && !isSupportedFilePathLite(currentFile, documentConversionEnabled)) {
      currentFile = null;
      await sendWelcome();
      return;
    }

    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

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
    readyHandled = false;
    if (workspaceWatch) workspaceWatch.dispose();
    workspacePath = null;
    currentFile = null;
    handleReady();
  }

  async function refreshActiveWorkspace({
    showLoading = false,
    loadingLabel = "Refreshing workspace...",
    preserveCurrentContent = false,
    changedPath = "",
  } = {}) {
    if (!workspacePath) return;

    const status = getWorkspacePathStatus(workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(workspacePath, status.reason);
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
          currentFile,
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
      currentFile = null;
    }

    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

  function dispose() {
    if (workspaceWatch) workspaceWatch.dispose();
    if (crossTabSearchWorker) crossTabSearchWorker.dispose();
  }

  const state = {
    get workspacePath() { return workspacePath; },
    set workspacePath(v) { workspacePath = v; },
    get currentFile() { return currentFile; },
    set currentFile(v) { currentFile = v; },
    get flatList() { return flatList; },
    set flatList(v) { flatList = v; },
    get readyHandled() { return readyHandled; },
    set readyHandled(v) { readyHandled = v; },
    get documentConversionEnabled() { return documentConversionEnabled; },
    set documentConversionEnabled(v) { documentConversionEnabled = v; },
    get searchIndex() { return searchIndex; },
    set searchIndex(v) { searchIndex = v; },
    get crossTabSearchWorker() { return crossTabSearchWorker; },
    set crossTabSearchWorker(v) { crossTabSearchWorker = v; },
    get workspaceWatch() { return workspaceWatch; },
    set workspaceWatch(v) { workspaceWatch = v; },
  };

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
