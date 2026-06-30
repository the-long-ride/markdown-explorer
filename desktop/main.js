require('v8-compile-cache');

const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  clipboard,
  Menu,
  shell,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");

const perf = require("./perf-timer");
const { createMainWindow } = require("./window");
const { createDebugTools } = require("./debug-tools");
const { createRecentWorkspacesStore } = require("./recents");
const { configureYouTubeEmbedHeaders } = require("./youtube-headers");
const {
  createStartupReadyAck,
  deferWorkspaceLoad,
} = require("./startup-workspace");

const appDir = app.isPackaged
  ? __dirname
  : path.join(__dirname, "..");

perf.mark("main:required");

let mainWindow = null;
let activeWorkspace = null;
let currentFile = null;
let flatList = [];
let readyHandled = false;
let documentConversionEnabled = false;

// Deferred heavy modules — loaded lazily to speed up cold start.
// The window appears before these parse + initialize.
let DesktopScanner = null;
let searchIndex = null;
let updateManager = null;
let documentConverter = null;
let workspaceWatch = null;

const debugTools = createDebugTools(app);
const recentWorkspacesStore = createRecentWorkspacesStore(app);
const {
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
} = require("./workspace-refresh");

function ensureHeavyModules() {
  if (DesktopScanner) return;
  DesktopScanner = require("./scanner");
  const { createDocumentConverter, getFileTypeLabel, getOpenDialogFilters, isExtraDocumentFilePath, isSupportedFilePath, stripKnownExtension } = require("./document-converter");
  const { createSearchIndex } = require("./search-index");
  const { createWorkspaceWatchController } = require("./workspace-watch");

  documentConverter = createDocumentConverter();
  searchIndex = createSearchIndex();
  workspaceWatch = createWorkspaceWatchController({
    fs,
    setTimeout,
    clearTimeout,
    debounceMs: 120,
    onRefresh: refreshActiveWorkspaceFromWatch,
  });
}

// Expose require-time constants from document-converter without loading the full module.
// These are just string checks — no heavy parsing needed.
function isSupportedFilePathLite(filePath, docConvEnabled) {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  if ([".md", ".mdx", ".markdown", ".txt"].includes(ext)) return true;
  if (docConvEnabled && [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext)) return true;
  return false;
}

function isExtraDocumentFilePathLite(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext);
}

function getFileTypeLabelLite(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
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

// Electron zoom level maps roughly to factor = 1.2 ^ level.
// This range gives about 63% to 144%, enough zoom-out for dense views while keeping zoom-in guarded.
const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;

// Remove default window menu bar
Menu.setApplicationMenu(null);

// ── Chromium startup tuning for desktop app ────────────────────────────────
// Must be set before app.whenReady() to take effect.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-networking');

function getHostPlatform() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return "unknown";
}

function getHostInfo() {
  return {
    appVersion: app.getVersion(),
    appRuntime: "desktop",
    hostPlatform: getHostPlatform(),
    hostArch: process.arch,
    isMaximized: mainWindow ? mainWindow.isMaximized() : false,
  };
}

function sendLoading(label, detail) {
  mainWindow?.webContents.send("host-message", {
    command: "setLoading",
    label,
    detail,
  });
}

function sendRecentWorkspacesChanged() {
  mainWindow?.webContents.send("host-message", {
    command: "recentWorkspacesChanged",
    recentWorkspaces: recentWorkspacesStore.load(),
  });
}

function sendHostMessage(message) {
  mainWindow?.webContents.send("host-message", message);
}

function isAccessDeniedError(err) {
  return err && (err.code === "EACCES" || err.code === "EPERM");
}

function getWorkspacePathStatus(workspacePath) {
  if (!workspacePath || typeof workspacePath !== "string") {
    return { ok: false, reason: "missing" };
  }

  try {
    fs.accessSync(workspacePath, fs.constants.R_OK);
    const stat = fs.statSync(workspacePath);
    return { ok: true, stat };
  } catch (err) {
    return {
      ok: false,
      reason: isAccessDeniedError(err) ? "locked" : "missing",
    };
  }
}

function sendWorkspaceUnavailable(workspacePath, reason = "missing") {
  if (workspaceWatch) workspaceWatch.dispose();
  activeWorkspace = null;
  currentFile = null;
  flatList = [];

  mainWindow?.webContents.send("host-message", {
    command: "workspaceUnavailable",
    workspacePath,
    workspaceName: path.basename(workspacePath || "") || workspacePath || "Workspace",
    reason,
    recentWorkspaces: recentWorkspacesStore.load(),
    ...getHostInfo(),
  });
}

function createWindow() {
  mainWindow = createMainWindow({ appDir, debugTools, clampAppZoom });
  perf.mark("window:created");
}
let tray = null;

app.whenReady().then(() => {
  perf.mark("electron:ready");
  perf.measure("main require to electron ready", "main:required", "electron:ready");
  configureYouTubeEmbedHeaders(session);

  // Pre-warm the GPU process so the real window paints faster.
  // Create a tiny hidden window to force Chromium to initialize the GPU.
  const hidden = new (require("electron").BrowserWindow)({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    paintWhenInitiallyHidden: false,
  });
  hidden.loadURL("about:blank");
  hidden.once("ready-to-show", () => {
    hidden.close();
    createWindow();
  });
  // Timeout: if GPU init takes >1s, just show the real window anyway.
  const gpuTimeout = setTimeout(() => {
    if (!hidden.isDestroyed()) {
      hidden.close();
      createWindow();
    }
  }, 1000);
  hidden.once("closed", () => clearTimeout(gpuTimeout));
  // Defer tray + update manager — not needed for first visible frame
  setImmediate(() => {
    const { createAppTray } = require("./tray");
    const { registerIpcHandlers } = require('./ipc-handlers');
    tray = createAppTray(appDir, () => mainWindow);
    const { createUpdateManager } = require("./update-manager");
    updateManager = createUpdateManager({
      app,
      execPath: process.execPath,
      relaunchArgs: process.argv.slice(1),
      sendToWindow: sendHostMessage,
    });
    registerIpcHandlers({
      ipcMain,
      clipboard,
      fs,
      shell,
      getMainWindow: () => mainWindow,
      handlers: {
        ready: handleReady,
        openFolder: handleOpenFolder,
        openFile: handleOpenFile,
        openPath: handleOpenPath,
        activateWorkspace: handleActivateWorkspace,
        searchAcrossWorkspaces: handleSearchAcrossWorkspaces,
        searchWorkspace: handleSearchWorkspace,
        indexWorkspaceSearchItems: handleIndexWorkspaceSearchItems,
        loadWorkspaceSearchIndexes: handleLoadWorkspaceSearchIndexes,
        confirmOpenPath: handleConfirmOpenPath,
        openRecent: handleOpenRecent,
        deleteRecentWorkspace: handleDeleteRecentWorkspace,
        replaceRecentWorkspaces: handleReplaceRecentWorkspaces,
        closeWorkspace: handleCloseWorkspace,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        navigate: handleNavigate,
        refresh: handleRefresh,
        setDocumentConversion: handleSetDocumentConversion,
        downloadUpdate: handleDownloadUpdate,
        scheduleDownloadedUpdate: handleScheduleDownloadedUpdate,
        restartAndApplyUpdate: handleRestartAndApplyUpdate,
      },
    });
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (workspaceWatch) workspaceWatch.dispose();
  if (!updateManager) return;
  void updateManager.applyPendingUpdateOnQuit();
});

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleReady(msg = {}) {
  if (typeof msg.documentConversionEnabled === "boolean") {
    documentConversionEnabled = msg.documentConversionEnabled;
  }

  if (readyHandled) return;
  readyHandled = true;
  perf.mark("host:ready");
  const recents = recentWorkspacesStore.load();
  const ackMsg = createStartupReadyAck({
    workspacePath: activeWorkspace,
    recentWorkspaces: recents,
    documentConversionEnabled,
    hostInfo: getHostInfo(),
  });
  mainWindow.webContents.send("host-message", ackMsg);
  perf.mark("host:ready-ack");
  perf.measure("host ready to readyAck", "host:ready", "host:ready-ack");
  perf.printSummary();
  updateManager?.sendCurrentState();

  if (activeWorkspace) {
    deferWorkspaceLoad({
      ensureHeavyModules,
      bindWorkspaceWatch,
      sendLoading,
      sendWorkspaceData,
      sendInitialContent,
      sendUpdateState: () => updateManager?.sendCurrentState(),
      onError: (err) => console.error("Failed to load startup workspace:", err),
    });
  }
}

function handleOpenFolder(openFirstFile = false) {
  ensureHeavyModules();
  const folders = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openDirectory"],
  });
  if (folders && folders.length > 0) {
    const selectedFolder = folders[0];
    recentWorkspacesStore.save(selectedFolder);
    activeWorkspace = selectedFolder;
    currentFile = null;
    bindWorkspaceWatch();
    sendLoading("Loading workspace...");
    sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
  }
}

function handleOpenFile() {
  ensureHeavyModules();
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openFile"],
    filters: getOpenDialogFiltersLite(documentConversionEnabled),
  });
  if (files && files.length > 0) {
    const selectedFile = files[0];
    const folder = path.dirname(selectedFile);
    recentWorkspacesStore.save(folder);
    activeWorkspace = folder;
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
      dialog.showMessageBoxSync(mainWindow, {
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
    activeWorkspace = path.dirname(filePath);
    currentFile = filePath;
  } else {
    activeWorkspace = filePath;
    currentFile = null;
  }

  recentWorkspacesStore.save(activeWorkspace);
  bindWorkspaceWatch();
  sendLoading("Loading workspace...");
  sendWorkspaceData().then(() => sendInitialContent(openFirstFile && !isFile));
}

function handleActivateWorkspace(workspacePath, filePath, openFirstFile = false) {
  const status = getWorkspacePathStatus(workspacePath);
  if (!status.ok) {
    sendWorkspaceUnavailable(workspacePath, status.reason);
    return;
  }

  activeWorkspace = workspacePath;
  currentFile =
    filePath &&
    fs.existsSync(filePath) &&
    isSupportedFilePathLite(filePath, documentConversionEnabled)
      ? filePath
      : null;
  recentWorkspacesStore.save(activeWorkspace);
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
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) ? msg.items : [];
  mainWindow.webContents.send("host-message", {
    command: "crossTabSearchResults",
    requestId,
    results: searchIndex.search(query, items, 10000),
  });
}

function handleSearchWorkspace(msg) {
  ensureHeavyModules();
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) && msg.items.length > 0 ? msg.items : flatList;
  mainWindow.webContents.send("host-message", {
    command: "workspaceSearchResults",
    requestId,
    results: searchIndex.search(query, items, 10000),
  });
}

function handleIndexWorkspaceSearchItems(msg) {
  ensureHeavyModules();
  const items = Array.isArray(msg.items) ? msg.items : [];
  setTimeout(() => searchIndex.prime(items), 0);
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
    const workspacePath = String(tab?.workspacePath || "");

    if (tabId && workspacePath) {
      if (fs.existsSync(workspacePath)) {
        try {
          const { tree, flat } = await scanWorkspaceData(workspacePath);
          searchIndex.prime(flat);
          mainWindow.webContents.send("host-message", {
            command: "workspaceSearchIndexLoaded",
            tabs: [{
              tabId,
              workspacePath,
              fileList: flat,
              tree,
            }],
          });
        } catch (err) {
          console.error("Failed to index workspace search index:", workspacePath, err);
          mainWindow.webContents.send("host-message", {
            command: "workspaceSearchIndexLoaded",
            tabs: [{
              tabId,
              workspacePath,
              fileList: [],
              tree: null,
            }],
          });
        }
      } else {
        mainWindow.webContents.send("host-message", {
          command: "workspaceSearchIndexLoaded",
          tabs: [{
            tabId,
            workspacePath,
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
  if (!activeWorkspace) {
    handleOpenPath(filePath);
    return;
  }
  const stat = fs.statSync(filePath);
  const isFile = stat.isFile();
  if (isFile) {
    if (!isSupportedFilePathLite(filePath, documentConversionEnabled)) {
      dialog.showMessageBoxSync(mainWindow, {
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

  const targetFolder = isFile ? path.dirname(filePath) : filePath;
  const targetName = path.basename(targetFolder) || targetFolder;
  const currentName = activeWorkspace
    ? (path.basename(activeWorkspace) || activeWorkspace)
    : "current workspace";
  const { response } = await dialog.showMessageBox(mainWindow, {
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
  activeWorkspace = folderPath;
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
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  setAppZoomLevel(currentZoom + ZOOM_LEVEL_STEP);
}

function handleZoomOut() {
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  setAppZoomLevel(currentZoom - ZOOM_LEVEL_STEP);
}

function clampZoomLevel(zoomLevel) {
  return Math.min(ZOOM_LEVEL_MAX, Math.max(ZOOM_LEVEL_MIN, zoomLevel));
}

function normalizeZoomStep(zoomLevel) {
  return Math.round(zoomLevel / ZOOM_LEVEL_STEP) * ZOOM_LEVEL_STEP;
}

function setAppZoomLevel(zoomLevel) {
  if (!mainWindow) return;
  const nextZoom = clampZoomLevel(normalizeZoomStep(zoomLevel));
  mainWindow.webContents.setZoomLevel(nextZoom);
}

function clampAppZoom() {
  if (!mainWindow) return;
  setAppZoomLevel(mainWindow.webContents.getZoomLevel());
}

function handleCloseWorkspace() {
  readyHandled = false;
  if (workspaceWatch) workspaceWatch.dispose();
  activeWorkspace = null;
  currentFile = null;
  handleReady();
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

function isSameOrInsidePath(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function getWorkspaceBaseDir() {
  if (!activeWorkspace || !fs.existsSync(activeWorkspace)) return null;
  return fs.statSync(activeWorkspace).isFile()
    ? path.dirname(activeWorkspace)
    : activeWorkspace;
}

function bindWorkspaceWatch() {
  if (workspaceWatch) workspaceWatch.watchWorkspace(getWorkspaceBaseDir());
}

function isCurrentFileStillAvailable() {
  if (!currentFile) return false;

  const status = getWorkspacePathStatus(currentFile);
  if (!status.ok || !status.stat.isFile()) return false;
  if (!isSupportedFilePathLite(currentFile, documentConversionEnabled)) return false;

  return flatList.some((file) => file.fsPath === currentFile);
}

async function refreshActiveWorkspace({
  showLoading = false,
  loadingLabel = "Refreshing workspace...",
  preserveCurrentContent = false,
  changedPath = "",
} = {}) {
  if (!activeWorkspace) return;

  const status = getWorkspacePathStatus(activeWorkspace);
  if (!status.ok) {
    sendWorkspaceUnavailable(activeWorkspace, status.reason);
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

async function refreshActiveWorkspaceFromWatch(_workspacePath, change = null) {
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

function resolveNavigationPath(filePath) {
  const requestedPath = decodeNavigationPath(stripNavigationFragment(String(filePath)));
  if (!requestedPath && currentFile) return currentFile;

  const baseDir = getWorkspaceBaseDir();
  const currentDir = currentFile ? path.dirname(currentFile) : baseDir;

  if (baseDir && path.isAbsolute(requestedPath) && isSameOrInsidePath(baseDir, requestedPath)) {
    return requestedPath;
  }

  if (baseDir && isRootRelativeWorkspaceHref(requestedPath)) {
    return path.resolve(baseDir, `.${requestedPath}`);
  }

  if (!path.isAbsolute(requestedPath) && currentDir) {
    return path.resolve(currentDir, requestedPath);
  }

  return requestedPath;
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
    mainWindow.webContents.send("host-message", {
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

  if (!activeWorkspace) return;

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
  if (!updateManager) return;
  await updateManager.startDownload({
    version: String(msg?.version || ""),
    url: String(msg?.url || ""),
  });
}

async function handleScheduleDownloadedUpdate() {
  if (!updateManager) return;
  await updateManager.schedulePendingUpdate();
}

async function handleRestartAndApplyUpdate() {
  if (!updateManager) return;
  await updateManager.restartAndApplyUpdate();
  app.quit();
}

async function scanWorkspaceData(workspacePath) {
  ensureHeavyModules();
  let tree = null;
  let flat = [];

  try {
    const isFile = fs.statSync(workspacePath).isFile();
    if (isFile) {
      if (isSupportedFilePathLite(workspacePath, documentConversionEnabled)) {
        const entry = DesktopScanner.buildFileEntry(workspacePath, path.dirname(workspacePath));
        flat = [entry];
        tree = DesktopScanner.buildTree(flat);
      }
    } else {
      const result = await DesktopScanner.scan(workspacePath, { documentConversionEnabled });
      tree = result.tree;
      flat = result.flat;
    }
  } catch (err) {
    console.error("Failed to scan workspace data:", err);
  }

  return { tree, flat };
}

function sendCurrentFileChanged() {
  if (!currentFile) return;
  mainWindow?.webContents.send("host-message", {
    command: "currentFileChanged",
    filePath: currentFile,
  });
}

async function sendWorkspaceFilesChanged() {
  if (!activeWorkspace) return;
  const status = getWorkspacePathStatus(activeWorkspace);
  if (!status.ok) {
    sendWorkspaceUnavailable(activeWorkspace, status.reason);
    return;
  }

  const { tree, flat } = await scanWorkspaceData(activeWorkspace);
  flatList = flat;
  if (searchIndex) searchIndex.prime(flat);

  mainWindow.webContents.send("host-message", {
    command: "workspaceFilesChanged",
    fileList: flat,
    tree,
    workspaceName: path.basename(activeWorkspace),
    workspacePath: activeWorkspace,
    documentConversionEnabled,
  });
}

async function sendWorkspaceData() {
  if (!activeWorkspace) return;
  const status = getWorkspacePathStatus(activeWorkspace);
  if (!status.ok) {
    sendWorkspaceUnavailable(activeWorkspace, status.reason);
    return;
  }

  const { tree, flat } = await scanWorkspaceData(activeWorkspace);
  flatList = flat;
  if (searchIndex) searchIndex.prime(flat);

  const workspaceName = path.basename(activeWorkspace);
  const recents = recentWorkspacesStore.load();

  const ackMsg = {
    command: "readyAck",
    fileList: flat,
    tree: tree,
    theme: "dark",
    themeStyle: "default",
    defaultExpanded: true,
    workspaceName: workspaceName,
    workspacePath: activeWorkspace,
    recentWorkspaces: recents,
    documentConversionEnabled,
    ...getHostInfo(),
  };
  mainWindow.webContents.send("host-message", ackMsg);
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
  ensureHeavyModules();
  if (!currentFile || !activeWorkspace) return;
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
    const result = await documentConverter.readMarkdown(currentFile);
    raw = result.markdown;
    previewInfo = result.previewInfo;
  } catch (err) {
    console.error("Failed to read file:", currentFile, err);
    raw = documentConverter.createFailureMarkdown(currentFile, err);
    previewInfo = isExtraDocumentFilePathLite(currentFile)
      ? {
          kind: "converted",
          sourceExtension: path.extname(currentFile).toLowerCase(),
          sourceLabel: getFileTypeLabelLite(currentFile),
          qualityWarning: "Markdown Explorer could not convert this file. The details are shown below.",
        }
      : null;
  }

  const isWorkspaceFile = fs.statSync(activeWorkspace).isFile();
  const baseDir = isWorkspaceFile ? path.dirname(activeWorkspace) : activeWorkspace;
  const fileInfo = flatList.find((f) => f.fsPath === currentFile) || {
    relativePath: path.relative(baseDir, currentFile),
    title: stripKnownExtensionLite(path.basename(currentFile)),
  };

  const msg = {
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
  };
  mainWindow.webContents.send("host-message", msg);
}

async function sendWelcome() {
  const msg = {
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
  };
  mainWindow.webContents.send("host-message", msg);
}


