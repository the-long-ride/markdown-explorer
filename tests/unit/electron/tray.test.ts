import { describe, expect, test, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createAppTray } = require('../../../electron/window/tray.js');

function makeTrayMock() {
  const events: Record<string, Function> = {};
  return {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      events[event] = handler;
    }),
    _trigger(event: string) {
      events[event]?.();
    },
    trayObj: {} as Record<string, any>,
  };
}

function makeMenuMock() {
  return {
    buildFromTemplate: vi.fn((template: any[]) => template),
  };
}

describe('createAppTray', () => {
  const baseDeps = () => ({
    appDir: '/test/app',
    getMainWindow: vi.fn(),
    fs: { existsSync: vi.fn(() => true) },
    pathImpl: path.posix,
    TrayConstructor: vi.fn(function MockTray(iconPath: string) {
      const mock = makeTrayMock();
      Object.assign(mock.trayObj, mock);
      return mock.trayObj;
    }),
    ElectronMenu: makeMenuMock(),
    appQuit: vi.fn(),
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns null when icon file does not exist', () => {
    const deps = baseDeps();
    deps.fs.existsSync = vi.fn(() => false);
    const tray = createAppTray(deps);
    expect(tray).toBeNull();
  });

  test('constructs Tray with correct icon path', () => {
    const deps = baseDeps();
    const tray = createAppTray(deps);
    expect(deps.TrayConstructor).toHaveBeenCalledWith('/test/app/ui/assets/logos/logo-128.png');
  });

  test('sets tooltip', () => {
    const deps = baseDeps();
    const tray = createAppTray(deps);
  });

  test('builds context menu with Open, separator, Quit', () => {
    const deps = baseDeps();
    createAppTray(deps);
    expect(deps.ElectronMenu.buildFromTemplate).toHaveBeenCalled();

    const template = deps.ElectronMenu.buildFromTemplate.mock.calls[0][0];
    expect(template[0].label).toBe('Open Markdown Explorer');
    expect(template[1].type).toBe('separator');
    expect(template[2].label).toBe('Quit');
  });

  test('Open menu item shows and focuses mainWindow when available', () => {
    const mainWindow = { show: vi.fn(), focus: vi.fn(), isVisible: vi.fn() };
    const deps = baseDeps();
    deps.getMainWindow = vi.fn(() => mainWindow);
    createAppTray(deps);

    const template = deps.ElectronMenu.buildFromTemplate.mock.calls[0][0];
    template[0].click();
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();
  });

  test('Open menu item does nothing when mainWindow is null', () => {
    const deps = baseDeps();
    deps.getMainWindow = vi.fn(() => null);
    createAppTray(deps);

    const template = deps.ElectronMenu.buildFromTemplate.mock.calls[0][0];
    template[0].click();
    // No error thrown is the assertion
  });

  test('Quit menu item calls appQuit', () => {
    const deps = baseDeps();
    createAppTray(deps);

    const template = deps.ElectronMenu.buildFromTemplate.mock.calls[0][0];
    template[2].click();
    expect(deps.appQuit).toHaveBeenCalled();
  });

  test('tray click focuses window when visible', () => {
    const mainWindow = { show: vi.fn(), focus: vi.fn(), isVisible: vi.fn(() => true) };
    const deps = baseDeps();
    deps.getMainWindow = vi.fn(() => mainWindow);
    const tray = createAppTray(deps);
    expect(deps.TrayConstructor).toHaveBeenCalled();

    const win = deps.TrayConstructor.mock.results[0].value;
    win._trigger('click');
    expect(mainWindow.focus).toHaveBeenCalled();
    expect(mainWindow.show).not.toHaveBeenCalled();
  });

  test('tray click shows window when not visible', () => {
    const mainWindow = { show: vi.fn(), focus: vi.fn(), isVisible: vi.fn(() => false) };
    const deps = baseDeps();
    deps.getMainWindow = vi.fn(() => mainWindow);
    const tray = createAppTray(deps);
    const win = deps.TrayConstructor.mock.results[0].value;
    win._trigger('click');
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.focus).not.toHaveBeenCalled();
  });

  test('tray click does nothing when mainWindow is null', () => {
    const deps = baseDeps();
    deps.getMainWindow = vi.fn(() => null);
    const tray = createAppTray(deps);
    const win = deps.TrayConstructor.mock.results[0].value;
    win._trigger('click');
    // No error
  });

  test('returns null when Tray constructor throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = baseDeps();
    deps.TrayConstructor = vi.fn(() => { throw new Error('Tray error'); });
    const tray = createAppTray(deps);
    expect(tray).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  test('returns null when buildFromTemplate throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = baseDeps();
    deps.ElectronMenu.buildFromTemplate = vi.fn(() => { throw new Error('Menu error'); });
    const tray = createAppTray(deps);
    expect(tray).toBeNull();
    expect(spy).toHaveBeenCalled();
  });
});