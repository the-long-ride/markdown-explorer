function configureApplicationMenu({ MenuImpl, platform } = {}) {
  if (platform !== "darwin") {
    MenuImpl.setApplicationMenu(null);
    return null;
  }

  const menu = MenuImpl.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "windowMenu" },
  ]);
  MenuImpl.setApplicationMenu(menu);
  return menu;
}

function createAppBootstrap({
  appImpl,
  BrowserWindowImpl,
  sessionImpl,
  MenuImpl,
  pathImpl,
  fsImpl,
  dialogImpl,
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
  createExportResourceHandlersFn = require("./runtime-export-resources").createExportResourceHandlers,
  createExportSaveHandlerFn = require("./runtime-export-save").createExportSaveHandler,
  createInsightsWorkspaceHostFn = require("./runtime-insights").createInsightsWorkspaceHost,
  createExternalLinkHostFn = require("./runtime-insights-external").createExternalLinkHost,
  createNativeCloseGuardFn = require("./native-close-guard").createNativeCloseGuard,
  externalOpenQueue = null,
} = {}) {
  let mainWindowRef = null;
  let trayRef = null;
  let updateManagerRef = null;
  const htmlPreviewServer = createHtmlPreviewServerFn();

  function createWindow() {
    mainWindowRef = createMainWindowFn({ appDir: appDirImpl, debugTools: debugToolsImpl, clampAppZoom: runtimeImpl.clampAppZoom });
    nativeCloseGuard.attachWindow(mainWindowRef);
    if (setMainWindow) setMainWindow(mainWindowRef);
    perfImpl.mark("window:created");
  }

  function getMainWindow() {
    return mainWindowRef;
  }

  function getWorkspaceBaseDir() {
    const workspacePath = runtimeImpl.state?.workspacePath;
    if (!workspacePath || !fsImpl.existsSync(workspacePath)) return null;
    try {
      return fsImpl.statSync(workspacePath).isFile() ? pathImpl.dirname(workspacePath) : workspacePath;
    } catch {
      return null;
    }
  }

  function isSameOrInsidePath(basePath, targetPath) {
    const relative = pathImpl.relative(pathImpl.resolve(basePath), pathImpl.resolve(targetPath));
    return relative === "" || (!relative.startsWith("..") && !pathImpl.isAbsolute(relative));
  }

  const sendHostMessage = (message) => {
    mainWindowRef?.webContents.send("host-message", message);
  };

  const nativeCloseGuard = createNativeCloseGuardFn({
    app: appImpl,
    getMainWindow,
    sendHostMessage,
    platform: processImpl.platform,
  });

  const exportResourceHandlers = createExportResourceHandlersFn({
    fs: fsImpl,
    pathApi: pathImpl,
    sendHostMessage,
    getWorkspaceBaseDir,
  });
  const insightsHost = createInsightsWorkspaceHostFn({
    fs: fsImpl,
    pathApi: pathImpl,
    sendHostMessage,
    getWorkspaceBaseDir,
    isSameOrInsidePath,
  });
  const externalLinkHost = createExternalLinkHostFn({ sendHostMessage });
  const saveExportFile = createExportSaveHandlerFn({
    dialog: dialogImpl,
    fs: fsImpl,
    pathApi: pathImpl,
    getMainWindow,
    sendHostMessage,
  });

  function getUpdateManager() {
    return updateManagerRef;
  }

  async function handleReady(message) {
    await runtimeImpl.handleReady(message);
    deliverExternalOpenPath(externalOpenQueue?.take());
  }

  function deliverExternalOpenPath(externalRequest) {
    if (!externalRequest) return;
    if (typeof externalRequest === 'string') {
      mainWindowRef?.webContents.send('host-message', {
        command: 'externalOpenPath',
        path: externalRequest,
      });
      return;
    }
    mainWindowRef?.webContents.send('host-message', {
      command: 'externalOpenRequest',
      request: externalRequest,
    });
  }

  appImpl.whenReady().then(() => {
    configureApplicationMenu({ MenuImpl, platform: processImpl.platform });
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
        appQuit: nativeCloseGuard.requestAppQuit,
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
          scanInsightsWorkspace: insightsHost.scanInsightsWorkspace,
          cancelInsightsScan: insightsHost.cancelInsightsScan,
          readInsightsDocumentSource: insightsHost.readInsightsDocumentSource,
          probeWorkspaceResource: insightsHost.probeWorkspaceResource,
          setInsightsWatchState: insightsHost.setInsightsWatchState,
          checkExternalLinks: externalLinkHost.checkExternalLinks,
          cancelExternalLinkChecks: externalLinkHost.cancelExternalLinkChecks,
          confirmOpenPath: runtimeImpl.handleConfirmOpenPath,
          openRecent: runtimeImpl.handleOpenRecent,
          deleteRecentWorkspace: runtimeImpl.handleDeleteRecentWorkspace,
          replaceRecentWorkspaces: runtimeImpl.handleReplaceRecentWorkspaces,
          closeWorkspace: runtimeImpl.handleCloseWorkspace,
          cancelWorkspaceScan: runtimeImpl.handleCancelWorkspaceScan,
          cancelAllWorkspaceScans: runtimeImpl.handleCancelAllWorkspaceScans,
          zoomIn: runtimeImpl.handleZoomIn,
          zoomOut: runtimeImpl.handleZoomOut,
          zoomReset: runtimeImpl.handleZoomReset,
          navigate: runtimeImpl.handleNavigate,
          refresh: runtimeImpl.handleRefresh,
          setDocumentConversion: runtimeImpl.handleSetDocumentConversion,
          saveDocument: runtimeImpl.handleSaveDocument,
          getGitCapability: runtimeImpl.handleGetGitCapability,
          listDocumentHistory: runtimeImpl.handleListDocumentHistory,
          readGitRevision: runtimeImpl.handleReadGitRevision,
          compareGitRevisions: runtimeImpl.handleCompareGitRevisions,
          confirmNativeClose: nativeCloseGuard.confirm,
          windowClose: nativeCloseGuard.closeApprovedWindow,
          listDesktopFonts: runtimeImpl.handleListDesktopFonts,
          importDesktopFonts: runtimeImpl.handleImportDesktopFonts,
          removeImportedDesktopFont: runtimeImpl.handleRemoveImportedDesktopFont,
          downloadUpdate: runtimeImpl.handleDownloadUpdate,
          scheduleDownloadedUpdate: runtimeImpl.handleScheduleDownloadedUpdate,
          restartAndApplyUpdate: runtimeImpl.handleRestartAndApplyUpdate,
          readWorkspaceTextResource: runtimeImpl.readWorkspaceTextResource,
          readWorkspaceExportResource: exportResourceHandlers.readWorkspaceExportResource,
          saveExportFile,
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

  appImpl.on("before-quit", (event) => {
    if (!nativeCloseGuard.handleBeforeQuit(event)) return;
    externalLinkHost.dispose();
    insightsHost.dispose();
    runtimeImpl.dispose();
    void htmlPreviewServer.dispose();
    if (updateManagerRef) {
      void updateManagerRef.applyPendingUpdateOnQuit();
    }
  });

  return { createWindow, getMainWindow, getUpdateManager, deliverExternalOpenPath };
}

module.exports = { createAppBootstrap, configureApplicationMenu };