import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMainWindow } = require('../../../electron/window/window.js');

function makeBrowserWindowMock() {
  const events: Record<string, Function[]> = {};
  const onceEvents: Record<string, Function[]> = {};
  const webContentsEvents: Record<string, Function[]> = {};
  const send = vi.fn();
  let urlGetter = vi.fn(() => 'file:///app/ui/dist/index.html');

  const webContents = {
    send,
    getURL: () => urlGetter(),
    on: vi.fn((event: string, handler: Function) => {
      if (!webContentsEvents[event]) webContentsEvents[event] = [];
      webContentsEvents[event].push(handler);
    }),
    setWindowOpenHandler: vi.fn(),
    executeJavaScript: vi.fn(() => Promise.resolve(null)),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: vi.fn(() => false),
    _trigger(event: string, ...args: any[]) {
      (webContentsEvents[event] || []).forEach((h: Function) => h(...args));
    },
  };

  return {
    show: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    once: vi.fn((event: string, handler: Function) => {
      if (!onceEvents[event]) onceEvents[event] = [];
      onceEvents[event].push(handler);
    }),
    isMaximized: vi.fn(() => true),
    webContents,
    _trigger(event: string, ...args: any[]) {
      (events[event] || []).forEach((h: Function) => h(...args));
    },
    _triggerOnce(event: string, ...args: any[]) {
      (onceEvents[event] || []).forEach((h: Function) => h(...args));
    },
    _setUrl(url: string) {
      urlGetter = vi.fn(() => url);
    },
  };
}

describe('createMainWindow', () => {
  let BrowserWindowConstructor: ReturnType<typeof vi.fn>;
  let windowMock: ReturnType<typeof makeBrowserWindowMock>;
  let shellImpl: { openExternal: ReturnType<typeof vi.fn> };
  let perfImpl: any;
  let debugTools: any;
  let clampAppZoom: ReturnType<typeof vi.fn>;
  let pathImpl: any;

  beforeEach(() => {
    windowMock = makeBrowserWindowMock();
    BrowserWindowConstructor = vi.fn(function MockBrowserWindow() { return windowMock; });
    shellImpl = { openExternal: vi.fn() };
    perfImpl = {
      mark: vi.fn(),
      measure: vi.fn(),
      setRendererMarks: vi.fn(),
      printSummary: vi.fn(),
    };
    debugTools = {
      shouldAutoOpenDevTools: vi.fn(() => false),
      openDevToolsIfDebug: vi.fn(),
      toggleDevToolsIfDebug: vi.fn(),
    };
    clampAppZoom = vi.fn();
    pathImpl = {
      join: vi.fn((...args: string[]) => args.join('/')),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(deps?: Record<string, any>) {
    return createMainWindow({
      appDir: '/test/app',
      debugTools,
      clampAppZoom,
      BrowserWindowConstructor,
      shellImpl,
      perfImpl,
      pathImpl,
      dirname: '/test/app/desktop',
      ...deps,
    });
  }

  test('constructs BrowserWindow with correct options', () => {
    create();
    expect(BrowserWindowConstructor).toHaveBeenCalledTimes(1);
    const opts = BrowserWindowConstructor.mock.calls[0][0];
    expect(opts.show).toBe(false);
    expect(opts.backgroundColor).toBe('#151518');
    expect(opts.minWidth).toBe(720);
    expect(opts.minHeight).toBe(480);
    expect(opts.isMaximized).toBe(true);
    expect(opts.frame).toBe(false);
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
  });

  test('passes correct icon path', () => {
    create();
    expect(pathImpl.join).toHaveBeenCalledWith('/test/app', 'ui', 'assets', 'logos', 'logo-500.png');
  });

  test('sets preload script path from dirname', () => {
    create();
    expect(pathImpl.join).toHaveBeenCalledWith('/test/app/desktop', '..', 'preload', 'preload.js');
  });

  test('loads index.html file', () => {
    create();
    expect(windowMock.loadFile).toHaveBeenCalledWith('/test/app/ui/dist/index.html');
  });

  test('registers before-input-event handler', () => {
    create();
    expect(windowMock.webContents.on).toHaveBeenCalledWith('before-input-event', expect.any(Function));
  });

  test('before-input-event detects Ctrl+Shift+I as devtools key', () => {
    create();
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('before-input-event', { preventDefault }, {
      control: true, shift: true, key: 'I',
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(debugTools.toggleDevToolsIfDebug).toHaveBeenCalled();
  });

  test('before-input-event detects Meta+Alt+I as devtools key', () => {
    create();
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('before-input-event', { preventDefault }, {
      meta: true, alt: true, key: 'i',
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(debugTools.toggleDevToolsIfDebug).toHaveBeenCalled();
  });

  test('before-input-event detects F12 as devtools key', () => {
    create();
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('before-input-event', { preventDefault }, {
      key: 'F12',
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(debugTools.toggleDevToolsIfDebug).toHaveBeenCalled();
  });

  test('before-input-event ignores regular keys', () => {
    create();
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('before-input-event', { preventDefault }, {
      key: 'a',
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(debugTools.toggleDevToolsIfDebug).not.toHaveBeenCalled();
  });

  test('maximize event sends window-state-changed with isMaximized=true', () => {
    create();
    windowMock._trigger('maximize');
    expect(windowMock.webContents.send).toHaveBeenCalledWith('host-message', {
      command: 'window-state-changed',
      isMaximized: true,
    });
  });

  test('unmaximize event sends window-state-changed with isMaximized=false', () => {
    create();
    windowMock._trigger('unmaximize');
    expect(windowMock.webContents.send).toHaveBeenCalledWith('host-message', {
      command: 'window-state-changed',
      isMaximized: false,
    });
  });

  test('registers will-navigate handler', () => {
    create();
    expect(windowMock.webContents.on).toHaveBeenCalledWith('will-navigate', expect.any(Function));
  });

  test('will-navigate allows same-page navigation (same URL)', () => {
    create();
    windowMock._setUrl('file:///app/ui/dist/index.html');
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('will-navigate', { preventDefault }, 'file:///app/ui/dist/index.html');
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test('will-navigate allows fragment navigation', () => {
    create();
    windowMock._setUrl('file:///app/ui/dist/index.html');
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('will-navigate', { preventDefault }, 'file:///app/ui/dist/index.html#section');
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test('will-navigate blocks external HTTP navigation and opens externally', () => {
    create();
    windowMock._setUrl('file:///app/ui/dist/index.html');
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('will-navigate', { preventDefault }, 'https://example.com/');
    expect(preventDefault).toHaveBeenCalled();
    expect(shellImpl.openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  test('will-navigate blocks non-HTTP navigation silently', () => {
    create();
    windowMock._setUrl('file:///app/ui/dist/index.html');
    const preventDefault = vi.fn();
    windowMock.webContents._trigger('will-navigate', { preventDefault }, 'ftp://example.com/');
    expect(preventDefault).toHaveBeenCalled();
    expect(shellImpl.openExternal).not.toHaveBeenCalled();
  });

  test('registers setWindowOpenHandler', () => {
    create();
    expect(windowMock.webContents.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  test('setWindowOpenHandler opens external HTTP URLs', () => {
    create();
    const handler = windowMock.webContents.setWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'https://example.com/' });
    expect(result).toEqual({ action: 'deny' });
    expect(shellImpl.openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  test('setWindowOpenHandler denies non-HTTP URLs without opening externally', () => {
    create();
    const handler = windowMock.webContents.setWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'ftp://example.com/' });
    expect(result).toEqual({ action: 'deny' });
    expect(shellImpl.openExternal).not.toHaveBeenCalled();
  });

  test('did-finish-load marks perf, calls clampAppZoom', () => {
    create();
    windowMock.webContents._trigger('did-finish-load');
    expect(perfImpl.mark).toHaveBeenCalledWith('renderer:did-finish-load');
    expect(perfImpl.measure).toHaveBeenCalledWith('window create to renderer load', 'window:created', 'renderer:did-finish-load');
    expect(clampAppZoom).toHaveBeenCalled();
  });

  test('did-finish-load opens devtools when shouldAutoOpenDevTools returns true', () => {
    debugTools.shouldAutoOpenDevTools = vi.fn(() => true);
    create();
    windowMock.webContents._trigger('did-finish-load');
    expect(debugTools.openDevToolsIfDebug).toHaveBeenCalled();
  });

  test('did-finish-load does not open devtools when shouldAutoOpenDevTools returns false', () => {
    debugTools.shouldAutoOpenDevTools = vi.fn(() => false);
    create();
    windowMock.webContents._trigger('did-finish-load');
    expect(debugTools.openDevToolsIfDebug).not.toHaveBeenCalled();
  });

  test('did-finish-load collects renderer perf marks', () => {
    const executeJavaScript = vi.fn(() => Promise.resolve({
      'renderer:entry': 100,
      'renderer:react-mounted': 200,
    }));
    windowMock.webContents.executeJavaScript = executeJavaScript;
    create();
    windowMock.webContents._trigger('did-finish-load');
    return Promise.resolve().then(() => {
      expect(perfImpl.setRendererMarks).toHaveBeenCalledWith({
        'renderer:entry': 100,
        'renderer:react-mounted': 200,
      });
      expect(perfImpl.printSummary).toHaveBeenCalled();
    });
  });

  test('did-finish-load handles null renderer entries gracefully', () => {
    windowMock.webContents.executeJavaScript = vi.fn(() => Promise.resolve(null));
    create();
    windowMock.webContents._trigger('did-finish-load');
    return Promise.resolve().then(() => {
      expect(perfImpl.setRendererMarks).not.toHaveBeenCalled();
      expect(perfImpl.printSummary).not.toHaveBeenCalled();
    });
  });

  test('did-finish-load handles executeJavaScript rejection gracefully', () => {
    windowMock.webContents.executeJavaScript = vi.fn(() => Promise.reject(new Error('boom')));
    create();
    windowMock.webContents._trigger('did-finish-load');
    return Promise.resolve().then(() => {
      expect(perfImpl.setRendererMarks).not.toHaveBeenCalled();
    });
  });

  test('ready-to-show calls mainWindow.show()', () => {
    create();
    windowMock._triggerOnce('ready-to-show');
    expect(windowMock.show).toHaveBeenCalled();
  });

  test('returns the mainWindow instance', () => {
    const result = create();
    expect(result).toBe(windowMock);
  });
});