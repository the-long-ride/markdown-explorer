function createMainWindow({
  appDir,
  debugTools,
  clampAppZoom,
  BrowserWindowConstructor,
  shellImpl,
  perfImpl,
  pathImpl,
  dirname,
  devServerUrl,
} = {}) {
  const mainWindow = new BrowserWindowConstructor({
    show: false,
    backgroundColor: '#151518',
    width: 1200,
    height: 700,
    minWidth: 800,
    minHeight: 480,
    isMaximized: true,
    center: true,
    frame: false,
    icon: pathImpl.join(appDir, "ui", "assets", "logos", "logo-500.png"),
    webPreferences: {
      preload: pathImpl.join(dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    const isDevToolsKey =
      (input.control && input.shift && key === "i") ||
      (input.meta && input.alt && key === "i") ||
      key === "f12";
    if (isDevToolsKey) {
      event.preventDefault();
      debugTools.toggleDevToolsIfDebug(mainWindow);
    }
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("host-message", {
      command: "window-state-changed",
      isMaximized: true,
    });
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("host-message", {
      command: "window-state-changed",
      isMaximized: false,
    });
  });

  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (navigationUrl === currentUrl || navigationUrl.startsWith(`${currentUrl}#`)) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(navigationUrl)) {
      void shellImpl.openExternal(navigationUrl);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shellImpl.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    perfImpl.mark("renderer:did-finish-load");
    perfImpl.measure("window create to renderer load", "window:created", "renderer:did-finish-load");
    clampAppZoom();
    if (debugTools.shouldAutoOpenDevTools()) {
      debugTools.openDevToolsIfDebug(mainWindow);
    }
    const isDebug = Boolean(debugTools && typeof debugTools.isDebugMode === "function" && debugTools.isDebugMode());
    if (isDebug) {
      mainWindow.webContents.executeJavaScript("window.__DEBUG__ = true;").catch(() => {});
    }
    mainWindow.webContents.executeJavaScript("window.__mdnPerfEntries ? window.__mdnPerfEntries() : null").then((rendererEntries) => {
      if (rendererEntries) {
        perfImpl.setRendererMarks(rendererEntries);
        perfImpl.printSummary();
      }
    }).catch(() => {});
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[renderer:did-fail-load]", errorCode, errorDescription, validatedURL);
  });

  // A crashed renderer leaves only the dark window background; log why.
  // exitCode -2147483645 (0x80000003) usually means the Chromium sandbox
  // could not start child processes from the install location (dev: --no-sandbox).
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer:gone]", details && details.reason, details && details.exitCode);
  });

  const isDebug = Boolean(debugTools && typeof debugTools.isDebugMode === "function" && debugTools.isDebugMode());
  if (devServerUrl) {
    mainWindow.loadURL(new URL(isDebug ? '?debug=1' : '', devServerUrl).toString());
  } else if (isDebug) {
    mainWindow.loadFile(pathImpl.join(appDir, "ui", "dist", "index.html"), { query: { debug: "1" } });
  } else {
    mainWindow.loadFile(pathImpl.join(appDir, "ui", "dist", "index.html"));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  return mainWindow;
}

const path = require("path");
const { app, BrowserWindow, shell } = require("electron");
const perf = require("../perf/perf-timer");

function createMainWindowLegacy(deps) {
  const { appDir, debugTools, clampAppZoom } = deps;
  return createMainWindow({
    appDir,
    debugTools,
    clampAppZoom,
    BrowserWindowConstructor: BrowserWindow,
    shellImpl: shell,
    perfImpl: perf,
    pathImpl: path,
    dirname: __dirname,
    devServerUrl: app.isPackaged ? undefined : process.env.MDN_DEV_SERVER_URL,
  });
}

module.exports = { createMainWindow, createMainWindowLegacy };
