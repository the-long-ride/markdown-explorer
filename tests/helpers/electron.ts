import { vi } from 'vitest';

export interface ElectronMockWindow {
  webContents: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    getZoomLevel: ReturnType<typeof vi.fn>;
    setZoomLevel: ReturnType<typeof vi.fn>;
    isDevToolsOpened: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
    closeDevTools: ReturnType<typeof vi.fn>;
    setWindowOpenHandler: ReturnType<typeof vi.fn>;
  };
  show: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  minimize: ReturnType<typeof vi.fn>;
  maximize: ReturnType<typeof vi.fn>;
  unmaximize: ReturnType<typeof vi.fn>;
  isMaximized: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  isVisible: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
}

export function createElectronMock(overrides: Record<string, any> = {}) {
  const sentMessages: any[] = [];
  const eventListeners = new Map<string, Function[]>();

  const window: ElectronMockWindow = {
    webContents: {
      send: vi.fn((channel: string, msg: any) => {
        if (channel === 'host-message') sentMessages.push(msg);
      }),
      on: vi.fn(),
      getZoomLevel: vi.fn(() => 0),
      setZoomLevel: vi.fn(),
      isDevToolsOpened: vi.fn(() => false),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    },
    show: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event)!.push(handler);
    }),
    once: vi.fn(),
    loadFile: vi.fn(),
  };

  const ipcMain = {
    on: vi.fn((channel: string, handler: Function) => {
      if (!eventListeners.has(channel)) eventListeners.set(channel, []);
      eventListeners.get(channel)!.push(handler);
    }),
    handle: vi.fn(),
    removeHandler: vi.fn(),
  };

  const ipcRenderer = {
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };

  const clipboard = { writeText: vi.fn(), readText: vi.fn(() => '') };
  const shell = { openPath: vi.fn(), openExternal: vi.fn(), showItemInFolder: vi.fn() };
  const dialog = {
    showOpenDialogSync: vi.fn(() => null),
    showMessageBox: vi.fn(() => Promise.resolve({})),
    showMessageBoxSync: vi.fn(() => 0),
  };

  const app = {
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
    getVersion: vi.fn(() => '1.5.5'),
    isPackaged: false,
    on: vi.fn(),
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-userdata';
      if (name === 'temp') return '/tmp/test-temp';
      throw new Error(`unexpected path request: ${name}`);
    }),
    commandLine: { appendSwitch: vi.fn() },
  };

  const session = {
    defaultSession: {
      webRequest: {
        onBeforeSendHeaders: vi.fn(),
      },
    },
  };

  const Menu = {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn(() => ({})),
  };

  const Tray = vi.fn(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  }));

  const BrowserWindow = vi.fn(() => window);

  const contextBridge = { exposeInMainWorld: vi.fn() };
  const webUtils = { getPathForFile: vi.fn((file: any) => file?.path ?? '') };

  const failNextMap = new Map<string, Error>();

  return {
    window,
    ipcMain,
    ipcRenderer,
    clipboard,
    shell,
    dialog,
    app,
    session,
    Menu,
    Tray,
    BrowserWindow,
    contextBridge,
    webUtils,
    sentMessages,
    eventListeners,
    failNext(operation: string, error: Error) {
      failNextMap.set(operation, error);
    },
    getFailNextMap: () => failNextMap,
    reset() {
      sentMessages.length = 0;
      eventListeners.clear();
      failNextMap.clear();
    },
    emitEvent(channel: string, ...args: any[]) {
      const handlers = eventListeners.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          handler({}, ...args);
        }
      }
    },
    emitIpcMessage(msg: any) {
      const handlers = eventListeners.get('webview-message') ?? [];
      for (const handler of handlers) {
        handler({}, msg);
      }
    },
    ...overrides,
  };
}
