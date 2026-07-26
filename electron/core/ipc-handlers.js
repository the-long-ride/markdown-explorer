const path = require("path");
const SHELL_LOCATION_MODES = new Set(["open-directory", "reveal-file", "open-parent-directory"]);

function registerIpcHandlers({ ipcMain, clipboard, fs, handlers, getMainWindow, shell, platform = process.platform }) {
  ipcMain.on("webview-message", async (_event, msg) => {
    switch (msg.command) {
      case "ready":
        await handlers.ready(msg);
        break;
      case "openFolder":
        handlers.openFolder(Boolean(msg.openFirstFile), msg);
        break;
      case "openFile":
        handlers.openFile(msg);
        break;
      case "openPath":
        handlers.openPath(msg.path, Boolean(msg.openFirstFile), msg);
        break;
      case "activateWorkspace":
        handlers.activateWorkspace(msg.workspacePath, msg.filePath, Boolean(msg.openFirstFile), msg);
        break;
      case "searchAcrossWorkspaces":
        handlers.searchAcrossWorkspaces(msg);
        break;
      case "searchWorkspace":
        handlers.searchWorkspace(msg);
        break;
      case "indexWorkspaceSearchItems":
        handlers.indexWorkspaceSearchItems(msg);
        break;
      case "loadWorkspaceSearchIndexes":
        handlers.loadWorkspaceSearchIndexes(msg);
        break;
      case "confirmOpenPath":
        handlers.confirmOpenPath(msg.path);
        break;
      case "openRecentWorkspace":
        handlers.openRecent(msg.path, Boolean(msg.openFirstFile), msg);
        break;
      case "deleteRecentWorkspace":
        handlers.deleteRecentWorkspace(msg.path);
        break;
      case "replaceRecentWorkspaces":
        handlers.replaceRecentWorkspaces(msg.recentWorkspaces);
        break;
      case "closeWorkspace":
        handlers.closeWorkspace();
        break;
      case "cancelWorkspaceScan":
        handlers.cancelWorkspaceScan(msg.workspaceOperationId);
        break;
      case "cancelAllWorkspaceScans":
        handlers.cancelAllWorkspaceScans();
        break;
      case "zoom-in":
        handlers.zoomIn();
        break;
      case "zoom-out":
        handlers.zoomOut();
        break;
      case "navigate":
        await handlers.navigate(msg.path);
        break;
      case "openInEditor":
        if (msg.path && fs.existsSync(msg.path)) shell.openPath(msg.path);
        break;
      case "openShellLocation": {
        if (!SHELL_LOCATION_MODES.has(msg.mode) || !msg.path || !fs.existsSync(msg.path)) break;
        if (msg.mode === "reveal-file") {
          shell.showItemInFolder(msg.path);
          break;
        }
        const targetPath = msg.mode === "open-parent-directory" ? path.dirname(msg.path) : msg.path;
        if (fs.existsSync(targetPath)) await shell.openPath(targetPath);
        break;
      }
      case "copyCode":
        clipboard.writeText(msg.text);
        break;
      case "openExternal":
        if (typeof msg.url === "string" && /^(?:https?|file):\/\//i.test(msg.url)) {
          shell.openExternal(msg.url);
        }
        break;
      case "readWorkspaceTextResource":
        handlers.readWorkspaceTextResource(msg);
        break;
      case "openHtmlPreview":
        if (typeof msg.documentHtml === "string" && msg.documentHtml.trim()) {
          await handlers.openHtmlPreview(msg.documentHtml);
        }
        break;
      case "refresh":
        await handlers.refresh();
        break;
      case "setDocumentConversion":
        await handlers.setDocumentConversion(Boolean(msg.enabled));
        break;
      case "downloadUpdate":
        await handlers.downloadUpdate(msg);
        break;
      case "scheduleDownloadedUpdate":
        await handlers.scheduleDownloadedUpdate();
        break;
      case "restartAndApplyUpdate":
        await handlers.restartAndApplyUpdate();
        break;
      case "window-minimize":
        getMainWindow()?.minimize();
        break;
      case "window-maximize": {
        const mainWindow = getMainWindow();
        if (!mainWindow) break;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
        break;
      }
      case "window-close":
        getMainWindow()?.close();
        break;
      case "toggle-fullscreen": {
        const mainWindow = getMainWindow();
        if (!mainWindow) break;
        try {
          let isFullscreen;
          if (platform === "win32") {
            isFullscreen = !mainWindow.isKiosk();
            mainWindow.setKiosk(isFullscreen);
          } else {
            isFullscreen = !mainWindow.isFullScreen();
            mainWindow.setFullScreen(isFullscreen);
          }
          mainWindow.webContents?.send("host-message", {
            command: "fullscreenChanged",
            isFullscreen,
          });
        } catch (error) {
          console.error("[electron] Failed to toggle fullscreen:", error);
        }
        break;
      }
    }
  });
}

module.exports = { registerIpcHandlers };
