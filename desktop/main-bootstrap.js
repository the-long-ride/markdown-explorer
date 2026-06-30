function createAppBootstrap({
  appImpl,
  BrowserWindowImpl,
  sessionImpl,
  MenuImpl,
  pathImpl,
  fsImpl,
  perfImpl,
  processImpl,
  setTimeoutImpl,
  clearTimeoutImpl,
  setImmediateImpl,
  configureYouTubeEmbedHeadersFn,
  createAppTrayFn,
  createUpdateManagerFn,
  registerIpcHandlersFn,
  runtimeImpl,
  debugToolsImpl,
  appDirImpl,
  createMainWindowFn,
  recentWorkspacesStoreImpl,
} = {}) {
  let mainWindowRef = null;
  let trayRef = null;
  let updateManagerRef = null;

  function createWindow() {
    mainWindowRef = createMainWindowFn({ appDir: appDirImpl, debugTools: debugToolsImpl, clampAppZoom: runtimeImpl.clampAppZoom });
    perfImpl.mark("window:created");
  }

  function getMainWindow() {
    return mainWindowRef;
  }

  function getUpdateManager() {
    return updateManagerRef;
  }

  appImpl.whenReady().then(() => {
    perfImpl.mark("electron:ready");
    perfImpl.measure("main require to electron ready", "main:required", "electron:ready");
    configureYouTubeEmbedHeadersFn(sessionImpl);

    const hidden = new BrowserWindowImpl({
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
    const gpuTimeout = setTimeoutImpl(() => {
      if (!hidden.isDestroyed()) {
        hidden.close();
        createWindow();
      }
    }, 1000);
    hidden.once("closed", () => clearTimeoutImpl(gpuTimeout));
    setImmediateImpl(() => {
      trayRef = createAppTrayFn({
        appDir: appDirImpl,
        getMainWindow,
        fs: fsImpl,
        pathImpl,
        TrayConstructor: require("electron").Tray,
        ElectronMenu: MenuImpl,
        appQuit: () => appImpl.quit(),
      });
      updateManagerRef = createUpdateManagerFn({
        app: appImpl,
        execPath: processImpl.execPath,
        relaunchArgs: processImpl.argv.slice(1),
        sendToWindow(message) {
          mainWindowRef?.webContents.send("host-message", message);
        },
      });
      registerIpcHandlersFn({
        ipcMain: require("electron").ipcMain,
        clipboard: require("electron").clipboard,
        fs: fsImpl,
        shell: require("electron").shell,
        getMainWindow,
        handlers: {
          ready: runtimeImpl.handleReady,
          openFolder: runtimeImpl.handleOpenFolder,
          openFile: runtimeImpl.handleOpenFile,
          openPath: runtimeImpl.handleOpenPath,
          activateWorkspace: runtimeImpl.handleActivateWorkspace,
          searchAcrossWorkspaces: runtimeImpl.handleSearchAcrossWorkspaces,
          searchWorkspace: runtimeImpl.handleSearchWorkspace,
          indexWorkspaceSearchItems: runtimeImpl.handleIndexWorkspaceSearchItems,
          loadWorkspaceSearchIndexes: runtimeImpl.handleLoadWorkspaceSearchIndexes,
          confirmOpenPath: runtimeImpl.handleConfirmOpenPath,
          openRecent: runtimeImpl.handleOpenRecent,
          deleteRecentWorkspace: runtimeImpl.handleDeleteRecentWorkspace,
          replaceRecentWorkspaces: runtimeImpl.handleReplaceRecentWorkspaces,
          closeWorkspace: runtimeImpl.handleCloseWorkspace,
          zoomIn: runtimeImpl.handleZoomIn,
          zoomOut: runtimeImpl.handleZoomOut,
          navigate: runtimeImpl.handleNavigate,
          refresh: runtimeImpl.handleRefresh,
          setDocumentConversion: runtimeImpl.handleSetDocumentConversion,
          downloadUpdate: runtimeImpl.handleDownloadUpdate,
          scheduleDownloadedUpdate: runtimeImpl.handleScheduleDownloadedUpdate,
          restartAndApplyUpdate: runtimeImpl.handleRestartAndApplyUpdate,
        },
      });
    });
    appImpl.on("activate", () => {
      if (BrowserWindowImpl.getAllWindows().length === 0) createWindow();
    });
  });

  appImpl.on("window-all-closed", () => {
    if (processImpl.platform !== "darwin") appImpl.quit();
  });

  appImpl.on("before-quit", () => {
    runtimeImpl.dispose();
    if (updateManagerRef) {
      void updateManagerRef.applyPendingUpdateOnQuit();
    }
  });

  return { createWindow, getMainWindow, getUpdateManager };
}

module.exports = { createAppBootstrap };