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
const { createDesktopRuntime } = require('./main-runtime');
const {
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
} = require("./workspace-refresh");

const appDir = app.isPackaged
  ? __dirname
  : path.join(__dirname, "..");

perf.mark("main:required");

let mainWindow = null;

let DesktopScanner = null;
let searchIndex = null;
let updateManager = null;
let documentConverter = null;
let workspaceWatch = null;
let crossTabSearchWorker = null;

const debugTools = createDebugTools(app);
const recentWorkspacesStore = createRecentWorkspacesStore(app);

function ensureHeavyModules() {
  if (DesktopScanner) return;
  DesktopScanner = require("./scanner");
  const { createDocumentConverter } = require("./document-converter");
  const { createSearchIndex } = require("./search-index");
  const { createWorkspaceWatchController } = require("./workspace-watch");

  documentConverter = createDocumentConverter();
  searchIndex = createSearchIndex();
  workspaceWatch = createWorkspaceWatchController({
    fs,
    setTimeout,
    clearTimeout,
    debounceMs: 120,
    onRefresh: (...args) => runtime.refreshActiveWorkspaceFromWatch(...args),
  });
}

const runtime = createDesktopRuntime({
  path,
  fs,
  dialog,
  getMainWindow: () => mainWindow,
  sendHostMessage(message) {
    mainWindow?.webContents.send("host-message", message);
  },
  getHostInfo() {
    return {
      appVersion: app.getVersion(),
      appRuntime: "desktop",
      hostPlatform: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : process.platform === "linux" ? "linux" : "unknown",
      hostArch: process.arch,
      isMaximized: mainWindow ? mainWindow.isMaximized() : false,
    };
  },
  sendLoading(label, detail) {
    mainWindow?.webContents.send("host-message", {
      command: "setLoading",
      label,
      detail,
    });
  },
  sendRecentWorkspacesChanged() {
    mainWindow?.webContents.send("host-message", {
      command: "recentWorkspacesChanged",
      recentWorkspaces: recentWorkspacesStore.load(),
    });
  },
  recentWorkspacesStore,
  createStartupReadyAck,
  deferWorkspaceLoad,
  ensureHeavyModules,
  async scanWorkspaceData(wsPath) {
    ensureHeavyModules();
    let tree = null;
    let flat = [];

    try {
      const isFile = fs.statSync(wsPath).isFile();
      if (isFile) {
        const { isSupportedFilePathLite } = require('./main-runtime');
        if (isSupportedFilePathLite(wsPath, runtime.state.documentConversionEnabled)) {
          const entry = DesktopScanner.buildFileEntry(wsPath, path.dirname(wsPath));
          flat = [entry];
          tree = DesktopScanner.buildTree(flat);
        }
      } else {
        const result = await DesktopScanner.scan(wsPath, { documentConversionEnabled: runtime.state.documentConversionEnabled });
        tree = result.tree;
        flat = result.flat;
      }
    } catch (err) {
      console.error("Failed to scan workspace data:", err);
    }

    return { tree, flat };
  },
  createSearchIndex() {
    const { createSearchIndex } = require("./search-index");
    return createSearchIndex();
  },
  createSearchWorkerController(opts) {
    const { createSearchWorkerController } = require("./search-worker-controller");
    return createSearchWorkerController(opts);
  },
  createWorkspaceWatchController(opts) {
    const { createWorkspaceWatchController } = require("./workspace-watch");
    return createWorkspaceWatchController(opts);
  },
  get documentConverter() {
    return documentConverter;
  },
  perf,
  get updateManager() {
    return updateManager;
  },
  DesktopScanner,
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
  appQuit: () => app.quit(),
});

// Remove default window menu bar
Menu.setApplicationMenu(null);

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-networking');

function createWindow() {
  mainWindow = createMainWindow({ appDir, debugTools, clampAppZoom: runtime.clampAppZoom });
  perf.mark("window:created");
}
let tray = null;

app.whenReady().then(() => {
  perf.mark("electron:ready");
  perf.measure("main require to electron ready", "main:required", "electron:ready");
  configureYouTubeEmbedHeaders(session);

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
  const gpuTimeout = setTimeout(() => {
    if (!hidden.isDestroyed()) {
      hidden.close();
      createWindow();
    }
  }, 1000);
  hidden.once("closed", () => clearTimeout(gpuTimeout));
  setImmediate(() => {
    const { createAppTray } = require("./tray");
    const { registerIpcHandlers } = require('./ipc-handlers');
    tray = createAppTray(appDir, () => mainWindow);
    const { createUpdateManager } = require("./update-manager");
    updateManager = createUpdateManager({
      app,
      execPath: process.execPath,
      relaunchArgs: process.argv.slice(1),
      sendToWindow(message) {
        mainWindow?.webContents.send("host-message", message);
      },
    });
    registerIpcHandlers({
      ipcMain,
      clipboard,
      fs,
      shell,
      getMainWindow: () => mainWindow,
      handlers: {
        ready: runtime.handleReady,
        openFolder: runtime.handleOpenFolder,
        openFile: runtime.handleOpenFile,
        openPath: runtime.handleOpenPath,
        activateWorkspace: runtime.handleActivateWorkspace,
        searchAcrossWorkspaces: runtime.handleSearchAcrossWorkspaces,
        searchWorkspace: runtime.handleSearchWorkspace,
        indexWorkspaceSearchItems: runtime.handleIndexWorkspaceSearchItems,
        loadWorkspaceSearchIndexes: runtime.handleLoadWorkspaceSearchIndexes,
        confirmOpenPath: runtime.handleConfirmOpenPath,
        openRecent: runtime.handleOpenRecent,
        deleteRecentWorkspace: runtime.handleDeleteRecentWorkspace,
        replaceRecentWorkspaces: runtime.handleReplaceRecentWorkspaces,
        closeWorkspace: runtime.handleCloseWorkspace,
        zoomIn: runtime.handleZoomIn,
        zoomOut: runtime.handleZoomOut,
        navigate: runtime.handleNavigate,
        refresh: runtime.handleRefresh,
        setDocumentConversion: runtime.handleSetDocumentConversion,
        downloadUpdate: runtime.handleDownloadUpdate,
        scheduleDownloadedUpdate: runtime.handleScheduleDownloadedUpdate,
        restartAndApplyUpdate: runtime.handleRestartAndApplyUpdate,
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
  runtime.dispose();
  if (!updateManager) return;
  void updateManager.applyPendingUpdateOnQuit();
});
