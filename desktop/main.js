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
const markdownRenderer = createMarkdownRenderer(appDir);
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
      closeWorkspace: handleCloseWorkspace,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      navigate: handleNavigate,
      refresh: handleRefresh,
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

async function handleReady() {
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
    sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
  }
}

function handleOpenFile() {
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Markdown Files", extensions: ["md", "mdx"] }
    ]
  });
  if (files && files.length > 0) {
    const selectedFile = files[0];
    const folder = path.dirname(selectedFile);
    recentWorkspacesStore.save(folder);
    activeWorkspace = folder;
    currentFile = selectedFile;
    sendWorkspaceData().then(() => sendContent());
  }
}

function handleOpenPath(filePath, openFirstFile = false) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  const isFile = stat.isFile();
  if (isFile) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: "Markdown Explorer only supports opening .md and .mdx files.",
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
  sendWorkspaceData().then(() => sendInitialContent(openFirstFile && !isFile));
}

function handleActivateWorkspace(workspacePath, filePath, openFirstFile = false) {
  if (!workspacePath || !fs.existsSync(workspacePath)) return;
  activeWorkspace = workspacePath;
  currentFile = filePath && fs.existsSync(filePath) ? filePath : null;
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
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: "Markdown Explorer only supports opening .md and .mdx files.",
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
  if (fs.existsSync(folderPath)) {
    recentWorkspacesStore.save(folderPath);
    activeWorkspace = folderPath;
    if (fs.statSync(folderPath).isFile()) {
      currentFile = folderPath;
      sendWorkspaceData().then(() => sendInitialContent(false));
    } else {
      currentFile = null;
      sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
    }
  } else {
    // Remove invalid path
    recentWorkspacesStore.remove(folderPath);
    readyHandled = false;
    handleReady();
  }
}

function handleDeleteRecentWorkspace(folderPath) {
  try {
    recentWorkspacesStore.remove(folderPath);
  } catch (err) {
    console.error("Failed to delete recent workspace:", err);
  }
  readyHandled = false;
  handleReady();
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

async function handleNavigate(filePath) {
  if (!filePath) {
    currentFile = null;
    await sendWelcome();
    return;
  }

  if (!path.isAbsolute(filePath) && activeWorkspace) {
    const isFile = fs.statSync(activeWorkspace).isFile();
    const baseDir = isFile ? path.dirname(activeWorkspace) : activeWorkspace;
    filePath = path.resolve(baseDir, filePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
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
    await sendWorkspaceData();
    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }
}

function scanWorkspaceData(workspacePath) {
  let tree = null;
  let flat = [];

  try {
    const isFile = fs.statSync(workspacePath).isFile();
    if (isFile) {
      const ext = path.extname(workspacePath).toLowerCase();
      if (ext === ".md" || ext === ".mdx") {
        const entry = DesktopScanner.buildFileEntry(workspacePath, path.dirname(workspacePath));
        flat = [entry];
        tree = DesktopScanner.buildTree(flat);
      }
    } else {
      const result = DesktopScanner.scan(workspacePath);
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

  let raw = "";
  try {
    raw = fs.readFileSync(currentFile, "utf8");
  } catch (err) {
    console.error("Failed to read file:", currentFile, err);
  }

  const { html, frontmatter, toc } = markdownRenderer.render(currentFile, raw);

  const isWorkspaceFile = fs.statSync(activeWorkspace).isFile();
  const baseDir = isWorkspaceFile ? path.dirname(activeWorkspace) : activeWorkspace;
  const fileInfo = flatList.find((f) => f.fsPath === currentFile) || {
    relativePath: path.relative(baseDir, currentFile),
    title: path.basename(currentFile).replace(/\.(md|mdx)$/i, ""),
  };

  const msg = {
    command: "renderContent",
    html: html,
    frontmatter: frontmatter,
    toc: toc,
    filePath: currentFile,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
  };
  mainWindow.webContents.send("host-message", msg);
}

async function sendWelcome() {
  const msg = {
    command: "renderContent",
    html: "",
    frontmatter: {},
    toc: [],
    filePath: "",
    relativePath: "Welcome Page",
    title: "Welcome",
    fileList: flatList,
  };
  mainWindow.webContents.send("host-message", msg);
}
