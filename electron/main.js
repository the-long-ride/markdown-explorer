require('v8-compile-cache');

/* v8 ignore next 15 */
const {
  app,
  BrowserWindow,
  Tray,
  dialog,
  ipcMain,
  clipboard,
  Menu,
  shell,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");

const perf = require("./perf/perf-timer");
const { createMainWindowLegacy } = require("./window/window");
const { createDebugTools } = require("./window/debug-tools");
const { createRecentWorkspacesStore } = require("./workspace/recents");
const { configureYouTubeEmbedHeaders } = require("./youtube/youtube-headers");
const {
  createStartupReadyAck,
  deferWorkspaceLoad,
} = require("./core/startup-workspace");
const { findExternalOpenPath, createExternalOpenQueue } = require('./core/external-open');
const { createDesktopRuntime } = require('./core/main-runtime');
const { isInstallerUpdateSupported } = require("./update/update-manager");
const {
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
} = require("./workspace/workspace-refresh");

const appDir = app.isPackaged
  ? __dirname
  : path.join(__dirname, "..");

perf.mark("main:required");

let mainWindow = null;

let DesktopScanner = null;
let searchIndex = null;
let updateManager = null;
let documentConverter = null;
let crossTabSearchWorker = null;

const debugTools = createDebugTools({ isPackaged: app.isPackaged });
const recentWorkspacesStore = createRecentWorkspacesStore(app);
const externalOpenQueue = createExternalOpenQueue();
const startupExternalPath = findExternalOpenPath(process.argv, fs);
if (startupExternalPath) externalOpenQueue.push(startupExternalPath);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function ensureHeavyModules() {
  if (DesktopScanner) return;
  DesktopScanner = require("./workspace/scanner");
  const { createDocumentConverter } = require("./render/document-converter");
  const { createSearchIndex } = require("./search/search-index");

  documentConverter = createDocumentConverter();
  searchIndex = createSearchIndex();
}

const runtime = createDesktopRuntime({
  path,
  fs,
  setTimeout,
  clearTimeout,
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
      canInstallUpdates: isInstallerUpdateSupported({ platform: process.platform, app }),
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
        const { isSupportedFilePathLite } = require('./core/main-runtime');
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
    const { createSearchIndex } = require("./search/search-index");
    return createSearchIndex();
  },
  createSearchWorkerController(opts) {
    const { createSearchWorkerController } = require("./search/search-worker-controller");
    return createSearchWorkerController(opts);
  },
  createWorkspaceWatchController(opts) {
    const { createWorkspaceWatchController } = require("./workspace/workspace-watch");
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

const { createAppBootstrap } = require('./core/main-bootstrap');

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
  createAppTrayFn: require("./window/tray").createAppTray,
  createUpdateManagerFn: require("./update/update-manager").createUpdateManager,
  registerIpcHandlersFn: require("./core/ipc-handlers").registerIpcHandlers,
  runtimeImpl: runtime,
  debugToolsImpl: debugTools,
  appDirImpl: appDir,
  createMainWindowFn: createMainWindowLegacy,
  recentWorkspacesStoreImpl: recentWorkspacesStore,
  setMainWindow: (win) => {
    mainWindow = win;
    const emitFullscreenState = () => {
      mainWindow?.webContents.send("host-message", {
        command: "fullscreenChanged",
        isFullscreen: mainWindow.isFullScreen() || mainWindow.isKiosk(),
      });
    };
    win.on("enter-full-screen", emitFullscreenState);
    win.on("leave-full-screen", emitFullscreenState);
  },
  setUpdateManager: (um) => { updateManager = um; },
  TrayConstructor: Tray,
  ipcMainImpl: ipcMain,
  clipboardImpl: clipboard,
  shellImpl: shell,
  externalOpenQueue,
});

app.on('second-instance', (_event, argv) => {
  const externalPath = findExternalOpenPath(argv, fs);
  if (!externalPath) return;
  const window = bootstrap.getMainWindow();
  if (!window) {
    externalOpenQueue.push(externalPath);
    return;
  }
  if (window.isMinimized?.()) window.restore();
  window.focus?.();
  bootstrap.deliverExternalOpenPath(externalPath);
});

module.exports = { createAppBootstrap };
