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
const DesktopScanner = require("./scanner");
const { createAppTray } = require("./tray");
const { createDebugTools } = require("./debug-tools");
const { registerIpcHandlers } = require("./ipc-handlers");
const {
  createDocumentConverter,
  getFileTypeLabel,
  getOpenDialogFilters,
  isExtraDocumentFilePath,
  isSupportedFilePath,
  stripKnownExtension,
} = require("./document-converter");
const { createMarkdownRenderer } = require("./markdown-renderer");
const { createMainWindow } = require("./window");
const { createRecentWorkspacesStore } = require("./recents");
const { createSearchIndex } = require("./search-index");
const { configureYouTubeEmbedHeaders } = require("./youtube-headers");

const appDir = app.isPackaged
  ? __dirname
  : path.join(__dirname, "..");

let mainWindow = null;
let activeWorkspace = null;
let currentFile = null;
let flatList = [];
let readyHandled = false;
let documentConversionEnabled = false;
const markdownRenderer = createMarkdownRenderer(appDir);
const documentConverter = createDocumentConverter();
const recentWorkspacesStore = createRecentWorkspacesStore(app);
const searchIndex = createSearchIndex();
const debugTools = createDebugTools(app);

// Electron zoom level maps roughly to factor = 1.2 ^ level.
// This range gives about 63% to 144%, enough zoom-out for dense views while keeping zoom-in guarded.
const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;

// Remove default window menu bar
Menu.setApplicationMenu(null);

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
}
let tray = null;

app.whenReady().then(() => {
  configureYouTubeEmbedHeaders(session);
  createWindow();
  tray = createAppTray(appDir, () => mainWindow);

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
    },
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleReady(msg = {}) {
  if (typeof msg.documentConversionEnabled === "boolean") {
    documentConversionEnabled = msg.documentConversionEnabled;
  }

  if (readyHandled) return;
  readyHandled = true;
  const recents = recentWorkspacesStore.load();
  if (!activeWorkspace) {
    const ackMsg = {
      command: "readyAck",
      fileList: [],
      tree: null,
      theme: "dark",
      themeStyle: "default",
      defaultExpanded: true,
      workspaceName: "",
      workspacePath: undefined,
      recentWorkspaces: recents,
      documentConversionEnabled,
      ...getHostInfo(),
    };
    mainWindow.webContents.send("host-message", ackMsg);
  } else {
    await sendWorkspaceData();
  }
}

function handleOpenFolder(openFirstFile = false) {
  const folders = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openDirectory"],
  });
  if (folders && folders.length > 0) {
    const selectedFolder = folders[0];
    recentWorkspacesStore.save(selectedFolder);
    activeWorkspace = selectedFolder;
    currentFile = null;
    sendLoading("Loading workspace...");
    sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
  }
}

function handleOpenFile() {
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openFile"],
    filters: getOpenDialogFilters(documentConversionEnabled),
  });
  if (files && files.length > 0) {
    const selectedFile = files[0];
    const folder = path.dirname(selectedFile);
    recentWorkspacesStore.save(folder);
    activeWorkspace = folder;
    currentFile = selectedFile;
    sendLoading(
      isExtraDocumentFilePath(selectedFile) ? "Preparing document preview..." : "Loading docs...",
    );
    sendWorkspaceData().then(() => sendContent());
  }
}

function handleOpenPath(filePath, openFirstFile = false) {
  const status = getWorkspacePathStatus(filePath);
  if (!status.ok) {
    sendWorkspaceUnavailable(filePath, status.reason);
    return;
  }

  const stat = status.stat;
  const isFile = stat.isFile();
  if (isFile) {
    if (!isSupportedFilePath(filePath, documentConversionEnabled)) {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: documentConversionEnabled
          ? "Markdown Explorer cannot preview this file type."
          : "Turn on document conversion in Markdown Explorer settings to preview DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
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
    isSupportedFilePath(filePath, documentConversionEnabled)
      ? filePath
      : null;
  recentWorkspacesStore.save(activeWorkspace);
  sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
}

function handleSearchAcrossWorkspaces(msg) {
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) ? msg.items : [];
  mainWindow.webContents.send("host-message", {
    command: "crossTabSearchResults",
    requestId,
    results: searchIndex.search(query, items, 80),
  });
}

function handleSearchWorkspace(msg) {
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) && msg.items.length > 0 ? msg.items : flatList;
  mainWindow.webContents.send("host-message", {
    command: "workspaceSearchResults",
    requestId,
    results: searchIndex.search(query, items, 80),
  });
}

function handleIndexWorkspaceSearchItems(msg) {
  const items = Array.isArray(msg.items) ? msg.items : [];
  setTimeout(() => searchIndex.prime(items), 0);
}

function handleLoadWorkspaceSearchIndexes(msg) {
  const tabRequests = Array.isArray(msg.tabs) ? msg.tabs : [];
  setTimeout(() => {
    const tabs = tabRequests.flatMap((tab) => {
      const tabId = String(tab?.tabId || "");
      const workspacePath = String(tab?.workspacePath || "");
      if (!tabId || !workspacePath || !fs.existsSync(workspacePath)) return [];

      const { tree, flat } = scanWorkspaceData(workspacePath);
      searchIndex.prime(flat);
      return [{
        tabId,
        workspacePath,
        fileList: flat,
        tree,
      }];
    });

    if (tabs.length > 0) {
      mainWindow.webContents.send("host-message", {
        command: "workspaceSearchIndexLoaded",
        tabs,
      });
    }
  }, 0);
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
    if (!isSupportedFilePath(filePath, documentConversionEnabled)) {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: documentConversionEnabled
          ? "Markdown Explorer cannot preview this file type."
          : "Turn on document conversion in Markdown Explorer settings to preview DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files.",
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
  const status = getWorkspacePathStatus(folderPath);
  if (!status.ok) {
    sendWorkspaceUnavailable(folderPath, status.reason);
    return;
  }

  recentWorkspacesStore.save(folderPath);
  activeWorkspace = folderPath;
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
  if (!filePath) {
    currentFile = null;
    await sendWelcome();
    return;
  }

  filePath = resolveNavigationPath(filePath);

  if (
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isFile() &&
    isSupportedFilePath(filePath, documentConversionEnabled)
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
  if (activeWorkspace) {
    const status = getWorkspacePathStatus(activeWorkspace);
    if (!status.ok) {
      sendWorkspaceUnavailable(activeWorkspace, status.reason);
      return;
    }

    sendLoading("Refreshing workspace...");
    await sendWorkspaceData();
    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }
}

async function handleSetDocumentConversion(enabled) {
  const nextEnabled = enabled === true;
  if (documentConversionEnabled === nextEnabled) return;
  documentConversionEnabled = nextEnabled;

  if (!activeWorkspace) return;

  sendLoading(nextEnabled ? "Finding supported documents..." : "Refreshing Markdown files...");
  await sendWorkspaceData();

  if (currentFile && !isSupportedFilePath(currentFile, documentConversionEnabled)) {
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

function scanWorkspaceData(workspacePath) {
  let tree = null;
  let flat = [];

  try {
    const isFile = fs.statSync(workspacePath).isFile();
    if (isFile) {
      if (isSupportedFilePath(workspacePath, documentConversionEnabled)) {
        const entry = DesktopScanner.buildFileEntry(workspacePath, path.dirname(workspacePath));
        flat = [entry];
        tree = DesktopScanner.buildTree(flat);
      }
    } else {
      const result = DesktopScanner.scan(workspacePath, { documentConversionEnabled });
      tree = result.tree;
      flat = result.flat;
    }
  } catch (err) {
    console.error("Failed to scan workspace data:", err);
  }

  return { tree, flat };
}

async function sendWorkspaceData() {
  if (!activeWorkspace) return;
  const status = getWorkspacePathStatus(activeWorkspace);
  if (!status.ok) {
    sendWorkspaceUnavailable(activeWorkspace, status.reason);
    return;
  }

  const { tree, flat } = scanWorkspaceData(activeWorkspace);
  flatList = flat;

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
  if (!currentFile || !activeWorkspace) return;
  if (!isSupportedFilePath(currentFile, documentConversionEnabled)) {
    currentFile = null;
    await sendWelcome();
    return;
  }

  let raw = "";
  let previewInfo = null;
  try {
    if (isExtraDocumentFilePath(currentFile)) {
      sendLoading(
        "Preparing document preview...",
        `Preparing ${getFileTypeLabel(currentFile)} preview locally.`,
      );
    }
    const result = await documentConverter.readMarkdown(currentFile);
    raw = result.markdown;
    previewInfo = result.previewInfo;
  } catch (err) {
    console.error("Failed to read file:", currentFile, err);
    raw = documentConverter.createFailureMarkdown(currentFile, err);
    previewInfo = isExtraDocumentFilePath(currentFile)
      ? {
          kind: "converted",
          sourceExtension: path.extname(currentFile).toLowerCase(),
          sourceLabel: getFileTypeLabel(currentFile),
          qualityWarning: "Markdown Explorer could not convert this file. The details are shown below.",
        }
      : null;
  }

  const { html, frontmatter, toc } = markdownRenderer.render(currentFile, raw);

  const isWorkspaceFile = fs.statSync(activeWorkspace).isFile();
  const baseDir = isWorkspaceFile ? path.dirname(activeWorkspace) : activeWorkspace;
  const fileInfo = flatList.find((f) => f.fsPath === currentFile) || {
    relativePath: path.relative(baseDir, currentFile),
    title: stripKnownExtension(path.basename(currentFile)),
  };

  const msg = {
    command: "renderContent",
    html: html,
    markdownSource: raw,
    frontmatter: frontmatter,
    toc: toc,
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
