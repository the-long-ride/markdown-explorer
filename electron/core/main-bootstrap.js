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
  setMainWindow,
  setUpdateManager,
  TrayConstructor = require("electron").Tray,
  ipcMainImpl = require("electron").ipcMain,
  clipboardImpl = require("electron").clipboard,
  shellImpl = require("electron").shell,
  createHtmlPreviewServerFn = require("./html-preview-server").createHtmlPreviewServer,
  externalOpenQueue = null,
} = {}) {
  let mainWindowRef = null;
  let trayRef = null;
  let updateManagerRef = null;
  const htmlPreviewServer = createHtmlPreviewServerFn();

  function createWindow() {
    mainWindowRef = createMainWindowFn({ appDir: appDirImpl, debugTools: debugToolsImpl, clampAppZoom: runtimeImpl.clampAppZoom });
    if (setMainWindow) setMainWindow(mainWindowRef);
    perfImpl.mark("window:created");
  }

  function getMainWindow() {
    return mainWindowRef;
  }

  function getUpdateManager() {
    return updateManagerRef;
  }

  async function handleReady(message) {
    await runtimeImpl.handleReady(message);
    deliverExternalOpenPath(externalOpenQueue?.take());
  }

  function deliverExternalOpenPath(externalPath) {
    if (externalPath) {
      mainWindowRef?.webContents.send('host-message', {
        command: 'externalOpenPath',
        path: externalPath,
      });
    }
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
        TrayConstructor,
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
      if (setUpdateManager) setUpdateManager(updateManagerRef);
      registerIpcHandlersFn({
        ipcMain: ipcMainImpl,
        clipboard: clipboardImpl,
        fs: fsImpl,
        shell: shellImpl,
        getMainWindow,
        handlers: {
          ready: handleReady,
          openFolder: runtimeImpl.handleOpenFolder,
          openFile: runtimeImpl.handleOpenFile,
          openPath: runtimeImpl.handleOpenPath,
          activateWorkspace: runtimeImpl.handleActivateWorkspace,
          searchAcrossWorkspaces: runtimeImpl.handleSearchAcrossWorkspaces,
          searchWorkspace: runtimeImpl.handleSearchWorkspace,
          loadSearchPreview: runtimeImpl.handleLoadSearchPreview,
          indexWorkspaceSearchItems: runtimeImpl.handleIndexWorkspaceSearchItems,
          loadWorkspaceSearchIndexes: runtimeImpl.handleLoadWorkspaceSearchIndexes,
          confirmOpenPath: runtimeImpl.handleConfirmOpenPath,
          openRecent: runtimeImpl.handleOpenRecent,
          deleteRecentWorkspace: runtimeImpl.handleDeleteRecentWorkspace,
          replaceRecentWorkspaces: runtimeImpl.handleReplaceRecentWorkspaces,
          closeWorkspace: runtimeImpl.handleCloseWorkspace,
          cancelWorkspaceScan: runtimeImpl.handleCancelWorkspaceScan,
          cancelAllWorkspaceScans: runtimeImpl.handleCancelAllWorkspaceScans,
          zoomIn: runtimeImpl.handleZoomIn,
          zoomOut: runtimeImpl.handleZoomOut,
          navigate: runtimeImpl.handleNavigate,
          refresh: runtimeImpl.handleRefresh,
          setDocumentConversion: runtimeImpl.handleSetDocumentConversion,
          downloadUpdate: runtimeImpl.handleDownloadUpdate,
          scheduleDownloadedUpdate: runtimeImpl.handleScheduleDownloadedUpdate,
          restartAndApplyUpdate: runtimeImpl.handleRestartAndApplyUpdate,
          readWorkspaceTextResource: runtimeImpl.readWorkspaceTextResource,
          openHtmlPreview: (documentHtml) => htmlPreviewServer.open(
            documentHtml,
            (url) => shellImpl.openExternal(url),
          ),
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
    void htmlPreviewServer.dispose();
    if (updateManagerRef) {
      void updateManagerRef.applyPendingUpdateOnQuit();
    }
  });

  return { createWindow, getMainWindow, getUpdateManager, deliverExternalOpenPath };
}

module.exports = { createAppBootstrap };
