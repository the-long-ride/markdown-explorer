function registerIpcHandlers({ ipcMain, clipboard, fs, handlers, getMainWindow, shell }) {
  ipcMain.on("webview-message", async (_event, msg) => {
    switch (msg.command) {
      case "ready":
        await handlers.ready();
        break;
      case "openFolder":
        handlers.openFolder(Boolean(msg.openFirstFile));
        break;
      case "openFile":
        handlers.openFile();
        break;
      case "openPath":
        handlers.openPath(msg.path, Boolean(msg.openFirstFile));
        break;
      case "activateWorkspace":
        handlers.activateWorkspace(msg.workspacePath, msg.filePath, Boolean(msg.openFirstFile));
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
        handlers.openRecent(msg.path, Boolean(msg.openFirstFile));
        break;
      case "deleteRecentWorkspace":
        handlers.deleteRecentWorkspace(msg.path);
        break;
      case "closeWorkspace":
        handlers.closeWorkspace();
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
      case "copyCode":
        clipboard.writeText(msg.text);
        break;
      case "openExternal":
        if (typeof msg.url === "string" && /^https?:\/\//i.test(msg.url)) {
          shell.openExternal(msg.url);
        }
        break;
      case "refresh":
        await handlers.refresh();
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
    }
  });
}

module.exports = { registerIpcHandlers };
