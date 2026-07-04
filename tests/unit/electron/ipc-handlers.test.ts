import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { registerIpcHandlers } = require('../../../desktop/ipc-handlers.js');

describe('registerIpcHandlers', () => {
  let ipcMain: { on: ReturnType<typeof vi.fn> };
  let handlers: Record<string, ReturnType<typeof vi.fn>>;
  let getMainWindow: ReturnType<typeof vi.fn>;
  let shell: { openExternal: ReturnType<typeof vi.fn>; openPath: ReturnType<typeof vi.fn> };
  let clipboard: { writeText: ReturnType<typeof vi.fn> };
  let fs: { existsSync: ReturnType<typeof vi.fn> };
  let registeredHandler: Function;

  beforeEach(() => {
    ipcMain = {
      on: vi.fn((channel: string, handler: Function) => {
        registeredHandler = handler;
      }),
    };
    handlers = {
      ready: vi.fn(() => Promise.resolve()),
      openFolder: vi.fn(),
      openFile: vi.fn(),
      openPath: vi.fn(),
      activateWorkspace: vi.fn(),
      searchAcrossWorkspaces: vi.fn(),
      searchWorkspace: vi.fn(),
      indexWorkspaceSearchItems: vi.fn(),
      loadWorkspaceSearchIndexes: vi.fn(),
      confirmOpenPath: vi.fn(),
      openRecent: vi.fn(),
      deleteRecentWorkspace: vi.fn(),
      replaceRecentWorkspaces: vi.fn(),
      closeWorkspace: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      navigate: vi.fn(() => Promise.resolve()),
      refresh: vi.fn(() => Promise.resolve()),
      setDocumentConversion: vi.fn(() => Promise.resolve()),
      downloadUpdate: vi.fn(() => Promise.resolve()),
      scheduleDownloadedUpdate: vi.fn(() => Promise.resolve()),
      restartAndApplyUpdate: vi.fn(() => Promise.resolve()),
    };
    getMainWindow = vi.fn();
    shell = { openExternal: vi.fn(), openPath: vi.fn() };
    clipboard = { writeText: vi.fn() };
    fs = { existsSync: vi.fn() };

    registerIpcHandlers({ ipcMain, clipboard, fs, handlers, getMainWindow, shell });
  });

  test('registers webview-message listener', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('webview-message', expect.any(Function));
  });

  describe('ready', () => {
    test('dispatches to handlers.ready with msg', async () => {
      await registeredHandler(null, { command: 'ready', payload: 'data' });
      expect(handlers.ready).toHaveBeenCalledWith({ command: 'ready', payload: 'data' });
    });
  });

  describe('openFolder', () => {
    test('passes openFirstFile flag', () => {
      registeredHandler(null, { command: 'openFolder', openFirstFile: true });
      expect(handlers.openFolder).toHaveBeenCalledWith(true);
    });

    test('passes false when flag missing', () => {
      registeredHandler(null, { command: 'openFolder' });
      expect(handlers.openFolder).toHaveBeenCalledWith(false);
    });
  });

  describe('openFile', () => {
    test('dispatches to handlers.openFile', () => {
      registeredHandler(null, { command: 'openFile' });
      expect(handlers.openFile).toHaveBeenCalled();
    });
  });

  describe('openPath', () => {
    test('passes path and openFirstFile', () => {
      registeredHandler(null, { command: 'openPath', path: '/some/path', openFirstFile: true });
      expect(handlers.openPath).toHaveBeenCalledWith('/some/path', true);
    });
  });

  describe('activateWorkspace', () => {
    test('passes workspacePath, filePath, openFirstFile', () => {
      registeredHandler(null, {
        command: 'activateWorkspace',
        workspacePath: '/ws',
        filePath: '/ws/file.md',
        openFirstFile: false,
      });
      expect(handlers.activateWorkspace).toHaveBeenCalledWith('/ws', '/ws/file.md', false);
    });
  });

  describe('searchAcrossWorkspaces', () => {
    test('passes msg', () => {
      registeredHandler(null, { command: 'searchAcrossWorkspaces', query: 'test' });
      expect(handlers.searchAcrossWorkspaces).toHaveBeenCalledWith({ command: 'searchAcrossWorkspaces', query: 'test' });
    });
  });

  describe('window commands', () => {
    test('window-minimize calls getMainWindow().minimize()', () => {
      const minWindow = { minimize: vi.fn() };
      getMainWindow.mockReturnValue(minWindow);
      registeredHandler(null, { command: 'window-minimize' });
      expect(minWindow.minimize).toHaveBeenCalled();
    });

    test('window-minimize safe when getMainWindow returns null', () => {
      getMainWindow.mockReturnValue(null);
      registeredHandler(null, { command: 'window-minimize' });
    });

    test('window-close calls getMainWindow().close()', () => {
      const win = { close: vi.fn() };
      getMainWindow.mockReturnValue(win);
      registeredHandler(null, { command: 'window-close' });
      expect(win.close).toHaveBeenCalled();
    });

    test('window-close safe when getMainWindow returns null', () => {
      getMainWindow.mockReturnValue(null);
      registeredHandler(null, { command: 'window-close' });
    });

    test('window-maximize toggles maximize when maximized', () => {
      const win = { isMaximized: vi.fn(() => true), unmaximize: vi.fn(), maximize: vi.fn() };
      getMainWindow.mockReturnValue(win);
      registeredHandler(null, { command: 'window-maximize' });
      expect(win.unmaximize).toHaveBeenCalled();
      expect(win.maximize).not.toHaveBeenCalled();
    });

    test('window-maximize toggles maximize when unmaximized', () => {
      const win = { isMaximized: vi.fn(() => false), unmaximize: vi.fn(), maximize: vi.fn() };
      getMainWindow.mockReturnValue(win);
      registeredHandler(null, { command: 'window-maximize' });
      expect(win.maximize).toHaveBeenCalled();
      expect(win.unmaximize).not.toHaveBeenCalled();
    });

    test('window-maximize safe when getMainWindow returns null', () => {
      getMainWindow.mockReturnValue(null);
      registeredHandler(null, { command: 'window-maximize' });
    });
  });

  describe('openInEditor', () => {
    test('opens path when file exists', () => {
      fs.existsSync.mockReturnValue(true);
      registeredHandler(null, { command: 'openInEditor', path: '/file.md' });
      expect(shell.openPath).toHaveBeenCalledWith('/file.md');
    });

    test('does nothing when path is missing', () => {
      registeredHandler(null, { command: 'openInEditor' });
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    test('does nothing when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      registeredHandler(null, { command: 'openInEditor', path: '/missing.md' });
      expect(shell.openPath).not.toHaveBeenCalled();
    });
  });

  describe('copyCode', () => {
    test('writes text to clipboard', () => {
      registeredHandler(null, { command: 'copyCode', text: 'some code' });
      expect(clipboard.writeText).toHaveBeenCalledWith('some code');
    });
  });

  describe('openExternal', () => {
    test('opens valid HTTP URL', () => {
      registeredHandler(null, { command: 'openExternal', url: 'https://example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    test('opens valid HTTPS URL', () => {
      registeredHandler(null, { command: 'openExternal', url: 'https://secure.example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('https://secure.example.com');
    });

    test('rejects non-string URL', () => {
      registeredHandler(null, { command: 'openExternal', url: 123 });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects non-HTTP URL', () => {
      registeredHandler(null, { command: 'openExternal', url: 'ftp://example.com' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects empty URL', () => {
      registeredHandler(null, { command: 'openExternal', url: '' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('remaining handler commands', () => {
    test('searchWorkspace', () => {
      registeredHandler(null, { command: 'searchWorkspace', query: 'x' });
      expect(handlers.searchWorkspace).toHaveBeenCalled();
    });

    test('indexWorkspaceSearchItems', () => {
      registeredHandler(null, { command: 'indexWorkspaceSearchItems', items: [] });
      expect(handlers.indexWorkspaceSearchItems).toHaveBeenCalled();
    });

    test('loadWorkspaceSearchIndexes', () => {
      registeredHandler(null, { command: 'loadWorkspaceSearchIndexes' });
      expect(handlers.loadWorkspaceSearchIndexes).toHaveBeenCalled();
    });

    test('confirmOpenPath', () => {
      registeredHandler(null, { command: 'confirmOpenPath', path: '/p' });
      expect(handlers.confirmOpenPath).toHaveBeenCalled();
    });

    test('openRecentWorkspace', () => {
      registeredHandler(null, { command: 'openRecentWorkspace', path: '/ws', openFirstFile: true });
      expect(handlers.openRecent).toHaveBeenCalled();
    });

    test('deleteRecentWorkspace', () => {
      registeredHandler(null, { command: 'deleteRecentWorkspace', path: '/ws' });
      expect(handlers.deleteRecentWorkspace).toHaveBeenCalled();
    });

    test('replaceRecentWorkspaces', () => {
      registeredHandler(null, { command: 'replaceRecentWorkspaces', recentWorkspaces: [] });
      expect(handlers.replaceRecentWorkspaces).toHaveBeenCalled();
    });

    test('closeWorkspace', () => {
      registeredHandler(null, { command: 'closeWorkspace' });
      expect(handlers.closeWorkspace).toHaveBeenCalled();
    });

    test('zoom-in', () => {
      registeredHandler(null, { command: 'zoom-in' });
      expect(handlers.zoomIn).toHaveBeenCalled();
    });

    test('zoom-out', () => {
      registeredHandler(null, { command: 'zoom-out' });
      expect(handlers.zoomOut).toHaveBeenCalled();
    });

    test('navigate', () => {
      registeredHandler(null, { command: 'navigate', path: '/file.md' });
      expect(handlers.navigate).toHaveBeenCalled();
    });

    test('refresh', () => {
      registeredHandler(null, { command: 'refresh' });
      expect(handlers.refresh).toHaveBeenCalled();
    });

    test('setDocumentConversion', () => {
      registeredHandler(null, { command: 'setDocumentConversion', enabled: true });
      expect(handlers.setDocumentConversion).toHaveBeenCalledWith(true);
    });

    test('downloadUpdate', () => {
      registeredHandler(null, { command: 'downloadUpdate', data: {} });
      expect(handlers.downloadUpdate).toHaveBeenCalled();
    });

    test('scheduleDownloadedUpdate', () => {
      registeredHandler(null, { command: 'scheduleDownloadedUpdate' });
      expect(handlers.scheduleDownloadedUpdate).toHaveBeenCalled();
    });

    test('restartAndApplyUpdate', () => {
      registeredHandler(null, { command: 'restartAndApplyUpdate' });
      expect(handlers.restartAndApplyUpdate).toHaveBeenCalled();
    });
  });
});