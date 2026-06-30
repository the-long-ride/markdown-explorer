require('v8-compile-cache');

/* v8 ignore next 15 */
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
const { createMainWindowLegacy } = require("./window");
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

const debugTools = createDebugTools({ isPackaged: app.isPackaged });
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

Menu.setApplicationMenu(null);

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-networking');

const { createAppBootstrap } = require('./main-bootstrap');

/* v8 ignore next 18 */
const bootstrap = createAppBootstrap({
  appImpl: app,
  BrowserWindowImpl: BrowserWindow,
  sessionImpl: session,
  MenuImpl: Menu,
  pathImpl: path,
  fsImpl: fs,
  perfImpl: perf,
  processImpl: process,
  setTimeoutImpl: setTimeout,
  clearTimeoutImpl: clearTimeout,
  setImmediateImpl: setImmediate,
  configureYouTubeEmbedHeadersFn: configureYouTubeEmbedHeaders,
  createAppTrayFn: require("./tray").createAppTray,
  createUpdateManagerFn: require("./update-manager").createUpdateManager,
  registerIpcHandlersFn: require("./ipc-handlers").registerIpcHandlers,
  runtimeImpl: runtime,
  debugToolsImpl: debugTools,
  appDirImpl: appDir,
  createMainWindowFn: createMainWindowLegacy,
  recentWorkspacesStoreImpl: recentWorkspacesStore,
});

module.exports = { createAppBootstrap };
