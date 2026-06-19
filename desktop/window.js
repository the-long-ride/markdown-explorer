const path = require("path");
const { BrowserWindow, shell } = require("electron");
const perf = require("./perf-timer");

function createMainWindow({ appDir, debugTools, clampAppZoom }) {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    isMaximized: true,
    center: true,
    frame: false,
    icon: path.join(appDir, "ui", "assets", "logos", "logo-500.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
      void shell.openExternal(navigationUrl);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    perf.mark("renderer:did-finish-load");
    perf.measure("window create to renderer load", "window:created", "renderer:did-finish-load");
    clampAppZoom();
    if (debugTools.shouldAutoOpenDevTools()) {
      debugTools.openDevToolsIfDebug(mainWindow);
    }
    // Collect renderer-side perf marks if available
    mainWindow.webContents.executeJavaScript("window.__mdnPerfEntries ? window.__mdnPerfEntries() : null").then((rendererEntries) => {
      if (rendererEntries) {
        perf.setRendererMarks(rendererEntries);
        perf.printSummary();
      }
    }).catch(() => {});
  });

  mainWindow.loadFile(path.join(appDir, "ui", "dist", "index.html"));
  return mainWindow;
}

module.exports = { createMainWindow };
