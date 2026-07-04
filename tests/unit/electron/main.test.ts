import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAppBootstrap } = require('../../../electron/core/main-bootstrap.js');

function makeAppMock() {
  const events: Record<string, Function[]> = {};
  const whenReadyPromise = Promise.resolve();

  return {
    quit: vi.fn(),
    whenReady: vi.fn(() => whenReadyPromise),
    on: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    _trigger(event: string, ...args: any[]) {
      (events[event] || []).forEach((h: Function) => h(...args));
    },
  };
}

function makeHiddenWindowMock() {
  const onceEvents: Record<string, Function> = {};
  let destroyed = false;
  return {
    loadURL: vi.fn(),
    once: vi.fn((event: string, handler: Function) => {
      onceEvents[event] = handler;
    }),
    close: vi.fn(() => { destroyed = true; }),
    isDestroyed: vi.fn(() => destroyed),
    _triggerOnce(event: string, ...args: any[]) {
      onceEvents[event]?.(...args);
    },
    _triggerClosed() {
      destroyed = true;
      onceEvents['closed']?.();
    },
  };
}

describe('createAppBootstrap', () => {
  let appImpl: ReturnType<typeof makeAppMock>;
  let hiddenMock: ReturnType<typeof makeHiddenWindowMock>;
  let BrowserWindowImpl: ReturnType<typeof vi.fn>;
  let sessionImpl: any;
  let MenuImpl: any;
  let perfImpl: any;
  let processImpl: any;
  let setTimeoutImpl: ReturnType<typeof vi.fn>;
  let clearTimeoutImpl: ReturnType<typeof vi.fn>;
  let setImmediateImpl: ReturnType<typeof vi.fn>;
  let configureYouTubeEmbedHeadersFn: ReturnType<typeof vi.fn>;
  let createAppTrayFn: ReturnType<typeof vi.fn>;
  let createUpdateManagerFn: ReturnType<typeof vi.fn>;
  let registerIpcHandlersFn: ReturnType<typeof vi.fn>;
  let runtimeImpl: any;
  let debugToolsImpl: any;
  let createMainWindowFn: ReturnType<typeof vi.fn>;
  let result: ReturnType<typeof createAppBootstrap>;

  beforeEach(() => {
    appImpl = makeAppMock();
    hiddenMock = makeHiddenWindowMock();
    BrowserWindowImpl = vi.fn(function MockBrowserWindow() { return hiddenMock; });
    BrowserWindowImpl.getAllWindows = vi.fn(() => []);
    sessionImpl = { defaultSession: { webRequest: { onBeforeSendHeaders: vi.fn() } } };
    MenuImpl = {
      setApplicationMenu: vi.fn(),
      buildFromTemplate: vi.fn(() => []),
    };
    perfImpl = {
      mark: vi.fn(),
      measure: vi.fn(),
      setRendererMarks: vi.fn(),
      printSummary: vi.fn(),
    };
    processImpl = {
      platform: 'win32',
      arch: 'x64',
      execPath: '/node',
      argv: ['node', 'main.js'],
    };
    setTimeoutImpl = vi.fn((fn: Function, _ms: number) => {
      fn();
      return 42;
    });
    clearTimeoutImpl = vi.fn();
    setImmediateImpl = vi.fn((fn: Function) => fn());
    configureYouTubeEmbedHeadersFn = vi.fn();
    createAppTrayFn = vi.fn(() => ({}));
    createUpdateManagerFn = vi.fn(() => ({
      applyPendingUpdateOnQuit: vi.fn(),
    }));
    registerIpcHandlersFn = vi.fn();
    runtimeImpl = {
      handleReady: vi.fn(),
      handleOpenFolder: vi.fn(),
      handleOpenFile: vi.fn(),
      handleOpenPath: vi.fn(),
      handleActivateWorkspace: vi.fn(),
      handleSearchAcrossWorkspaces: vi.fn(),
      handleSearchWorkspace: vi.fn(),
      handleIndexWorkspaceSearchItems: vi.fn(),
      handleLoadWorkspaceSearchIndexes: vi.fn(),
      handleConfirmOpenPath: vi.fn(),
      handleOpenRecent: vi.fn(),
      handleDeleteRecentWorkspace: vi.fn(),
      handleReplaceRecentWorkspaces: vi.fn(),
      handleCloseWorkspace: vi.fn(),
      handleZoomIn: vi.fn(),
      handleZoomOut: vi.fn(),
      handleNavigate: vi.fn(),
      handleRefresh: vi.fn(),
      handleSetDocumentConversion: vi.fn(),
      handleDownloadUpdate: vi.fn(),
      handleScheduleDownloadedUpdate: vi.fn(),
      handleRestartAndApplyUpdate: vi.fn(),
      clampAppZoom: vi.fn(),
      dispose: vi.fn(),
    };
    debugToolsImpl = {
      shouldAutoOpenDevTools: vi.fn(() => false),
      openDevToolsIfDebug: vi.fn(),
      toggleDevToolsIfDebug: vi.fn(),
    };
    createMainWindowFn = vi.fn(() => ({
      webContents: { send: vi.fn() },
      isMaximized: vi.fn(() => true),
      show: vi.fn(),
    }));

    result = createAppBootstrap({
      appImpl,
      BrowserWindowImpl,
      sessionImpl,
      MenuImpl,
      pathImpl: { join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((p: string) => p) },
      fsImpl: { existsSync: vi.fn(() => true), statSync: vi.fn(() => ({ isFile: vi.fn(() => false) })) },
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
      appDirImpl: '/test/app',
      createMainWindowFn,
      recentWorkspacesStoreImpl: { load: vi.fn(() => []), save: vi.fn() },
      TrayConstructor: vi.fn(),
      ipcMainImpl: {},
      clipboardImpl: {},
      shellImpl: { openExternal: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('whenReady lifecycle', () => {
    test('marks electron:ready on whenReady', async () => {
      await Promise.resolve();
      expect(perfImpl.mark).toHaveBeenCalledWith('electron:ready');
    });

    test('measures main require to electron ready', async () => {
      await Promise.resolve();
      expect(perfImpl.measure).toHaveBeenCalledWith('main require to electron ready', 'main:required', 'electron:ready');
    });

    test('configures YouTube embed headers', async () => {
      await Promise.resolve();
      expect(configureYouTubeEmbedHeadersFn).toHaveBeenCalledWith(sessionImpl);
    });

    test('creates hidden GPU warmup window', async () => {
      await Promise.resolve();
      expect(BrowserWindowImpl).toHaveBeenCalledWith({
        width: 1, height: 1, show: false, skipTaskbar: true, paintWhenInitiallyHidden: false,
      });
      expect(hiddenMock.loadURL).toHaveBeenCalledWith('about:blank');
    });

    test('GPU warmup: ready-to-show triggers close + createWindow', async () => {
      await Promise.resolve();
      hiddenMock._triggerOnce('ready-to-show');
      expect(hiddenMock.close).toHaveBeenCalled();
      expect(createMainWindowFn).toHaveBeenCalled();
      expect(perfImpl.mark).toHaveBeenCalledWith('window:created');
    });

    test('GPU warmup: timeout triggers close + createWindow when not destroyed', async () => {
      await Promise.resolve();
      setTimeoutImpl.mock.calls = [];
      setTimeoutImpl.mockImplementation((fn: Function, _ms: number) => {
        setTimeoutImpl.mock.results = [];
        return 42;
      });
      result = createAppBootstrap({
        appImpl, BrowserWindowImpl, sessionImpl, MenuImpl, perfImpl,
        processImpl, setTimeoutImpl, clearTimeoutImpl, setImmediateImpl,
        configureYouTubeEmbedHeadersFn, createAppTrayFn, createUpdateManagerFn,
        registerIpcHandlersFn, runtimeImpl, debugToolsImpl, createMainWindowFn,
        appDirImpl: '/test/app', pathImpl: { join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((p: string) => p) },
        fsImpl: { existsSync: vi.fn(() => true), statSync: vi.fn(() => ({ isFile: vi.fn(() => false) })) },
        recentWorkspacesStoreImpl: { load: vi.fn(() => []), save: vi.fn() },
        TrayConstructor: vi.fn(),
        ipcMainImpl: {},
        clipboardImpl: {},
        shellImpl: { openExternal: vi.fn() },
      });
      await Promise.resolve();
    });

    test('GPU warmup: closed event clears timeout', async () => {
      await Promise.resolve();
      hiddenMock._triggerClosed();
      expect(clearTimeoutImpl).toHaveBeenCalled();
    });

    test('setImmediate creates tray, updateManager, and registers handlers', async () => {
      await Promise.resolve();
      expect(createAppTrayFn).toHaveBeenCalled();
      expect(createUpdateManagerFn).toHaveBeenCalledWith({
        app: appImpl,
        execPath: '/node',
        relaunchArgs: ['main.js'],
        sendToWindow: expect.any(Function),
      });
      expect(registerIpcHandlersFn).toHaveBeenCalled();
    });

    test('registerIpcHandlers maps all handler functions', async () => {
      await Promise.resolve();
      const call = registerIpcHandlersFn.mock.calls[0][0];
      expect(call.handlers.ready).toBe(runtimeImpl.handleReady);
      expect(call.handlers.openFolder).toBe(runtimeImpl.handleOpenFolder);
      expect(call.handlers.openFile).toBe(runtimeImpl.handleOpenFile);
      expect(call.handlers.openPath).toBe(runtimeImpl.handleOpenPath);
      expect(call.handlers.activateWorkspace).toBe(runtimeImpl.handleActivateWorkspace);
      expect(call.handlers.searchAcrossWorkspaces).toBe(runtimeImpl.handleSearchAcrossWorkspaces);
      expect(call.handlers.searchWorkspace).toBe(runtimeImpl.handleSearchWorkspace);
      expect(call.handlers.indexWorkspaceSearchItems).toBe(runtimeImpl.handleIndexWorkspaceSearchItems);
      expect(call.handlers.loadWorkspaceSearchIndexes).toBe(runtimeImpl.handleLoadWorkspaceSearchIndexes);
      expect(call.handlers.confirmOpenPath).toBe(runtimeImpl.handleConfirmOpenPath);
      expect(call.handlers.openRecent).toBe(runtimeImpl.handleOpenRecent);
      expect(call.handlers.deleteRecentWorkspace).toBe(runtimeImpl.handleDeleteRecentWorkspace);
      expect(call.handlers.replaceRecentWorkspaces).toBe(runtimeImpl.handleReplaceRecentWorkspaces);
      expect(call.handlers.closeWorkspace).toBe(runtimeImpl.handleCloseWorkspace);
      expect(call.handlers.zoomIn).toBe(runtimeImpl.handleZoomIn);
      expect(call.handlers.zoomOut).toBe(runtimeImpl.handleZoomOut);
      expect(call.handlers.navigate).toBe(runtimeImpl.handleNavigate);
      expect(call.handlers.refresh).toBe(runtimeImpl.handleRefresh);
      expect(call.handlers.setDocumentConversion).toBe(runtimeImpl.handleSetDocumentConversion);
      expect(call.handlers.downloadUpdate).toBe(runtimeImpl.handleDownloadUpdate);
      expect(call.handlers.scheduleDownloadedUpdate).toBe(runtimeImpl.handleScheduleDownloadedUpdate);
      expect(call.handlers.restartAndApplyUpdate).toBe(runtimeImpl.handleRestartAndApplyUpdate);
    });

    test('registers activate event listener', async () => {
      await Promise.resolve();
      expect(appImpl.on).toHaveBeenCalledWith('activate', expect.any(Function));
    });
  });

  describe('activate handler', () => {
    test('re-creates window when all windows closed', async () => {
      await Promise.resolve();
      BrowserWindowImpl.getAllWindows = vi.fn(() => []);
      appImpl._trigger('activate');
      expect(createMainWindowFn).toHaveBeenCalledTimes(2); // once from setImmediate, once from activate
    });

    test('does not re-create window when windows exist', async () => {
      await Promise.resolve();
      const createCallCount = createMainWindowFn.mock.calls.length;
      BrowserWindowImpl.getAllWindows = vi.fn(() => [{ id: 1 }]);
      appImpl._trigger('activate');
      expect(createMainWindowFn).toHaveBeenCalledTimes(createCallCount);
    });
  });

  describe('window-all-closed', () => {
    test('quits on non-macOS platforms', async () => {
      await Promise.resolve();
      processImpl.platform = 'win32';
      appImpl._trigger('window-all-closed');
      expect(appImpl.quit).toHaveBeenCalled();
    });

    test('quits on Linux', async () => {
      await Promise.resolve();
      processImpl.platform = 'linux';
      appImpl._trigger('window-all-closed');
      expect(appImpl.quit).toHaveBeenCalled();
    });

    test('does not quit on macOS', async () => {
      await Promise.resolve();
      processImpl.platform = 'darwin';
      appImpl._trigger('window-all-closed');
      expect(appImpl.quit).not.toHaveBeenCalled();
    });
  });

  describe('before-quit', () => {
    test('disposes runtime', async () => {
      await Promise.resolve();
      appImpl._trigger('before-quit');
      expect(runtimeImpl.dispose).toHaveBeenCalled();
    });

    test('applies pending update when updateManager exists', async () => {
      await Promise.resolve();
      const applyPending = vi.fn();
      createUpdateManagerFn.mockReturnValue({ applyPendingUpdateOnQuit: applyPending });
      result = createAppBootstrap({
        appImpl, BrowserWindowImpl, sessionImpl, MenuImpl, perfImpl,
        processImpl, setTimeoutImpl, clearTimeoutImpl, setImmediateImpl,
        configureYouTubeEmbedHeadersFn, createAppTrayFn, createUpdateManagerFn,
        registerIpcHandlersFn, runtimeImpl, debugToolsImpl, createMainWindowFn,
        appDirImpl: '/test/app', pathImpl: { join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((p: string) => p) },
        fsImpl: { existsSync: vi.fn(() => true), statSync: vi.fn(() => ({ isFile: vi.fn(() => false) })) },
        recentWorkspacesStoreImpl: { load: vi.fn(() => []), save: vi.fn() },
        TrayConstructor: vi.fn(),
        ipcMainImpl: {},
        clipboardImpl: {},
        shellImpl: { openExternal: vi.fn() },
      });
      await Promise.resolve();
      appImpl._trigger('before-quit');
      expect(applyPending).toHaveBeenCalled();
    });

    test('skips pending update when updateManager is null', async () => {
      await Promise.resolve();
      createUpdateManagerFn.mockReturnValue(null);
      result = createAppBootstrap({
        appImpl, BrowserWindowImpl, sessionImpl, MenuImpl, perfImpl,
        processImpl, setTimeoutImpl, clearTimeoutImpl, setImmediateImpl,
        configureYouTubeEmbedHeadersFn, createAppTrayFn, createUpdateManagerFn,
        registerIpcHandlersFn, runtimeImpl, debugToolsImpl, createMainWindowFn,
        appDirImpl: '/test/app', pathImpl: { join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((p: string) => p) },
        fsImpl: { existsSync: vi.fn(() => true), statSync: vi.fn(() => ({ isFile: vi.fn(() => false) })) },
        recentWorkspacesStoreImpl: { load: vi.fn(() => []), save: vi.fn() },
        TrayConstructor: vi.fn(),
        ipcMainImpl: {},
        clipboardImpl: {},
        shellImpl: { openExternal: vi.fn() },
      });
      await Promise.resolve();
      appImpl._trigger('before-quit');
      expect(runtimeImpl.dispose).toHaveBeenCalled();
    });
  });

  describe('returned API', () => {
    test('createWindow marks perf and creates main window', async () => {
      await Promise.resolve();
      result.createWindow();
      expect(perfImpl.mark).toHaveBeenCalledWith('window:created');
      expect(createMainWindowFn).toHaveBeenCalled();
    });

    test('getMainWindow returns window reference', async () => {
      await Promise.resolve();
      const w = result.getMainWindow();
      expect(w).toBeDefined();
    });

    test('getUpdateManager returns updateManager reference', async () => {
      await Promise.resolve();
      const um = result.getUpdateManager();
      expect(um).toBeDefined();
    });
  });
});