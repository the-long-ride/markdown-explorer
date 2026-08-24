import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { configureApplicationMenu } = require('../../../electron/core/main-bootstrap.js');
const { createAppTray, createTrayIcon } = require('../../../electron/window/tray.js');

function readPngSize(filePath: string) {
  const png = readFileSync(filePath);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('macOS native desktop behavior', () => {
  test('installs native app/edit/window menus so Cmd+C, Cmd+V, and selection editing keep working', () => {
    const builtMenu = { kind: 'native-menu' };
    const MenuImpl = {
      buildFromTemplate: vi.fn(() => builtMenu),
      setApplicationMenu: vi.fn(),
    };

    const result = configureApplicationMenu({ MenuImpl, platform: 'darwin' });

    expect(MenuImpl.buildFromTemplate).toHaveBeenCalledWith([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]);
    expect(MenuImpl.setApplicationMenu).toHaveBeenCalledWith(builtMenu);
    expect(result).toBe(builtMenu);
  });

  test('keeps the application menu suppressed on Windows and Linux', () => {
    const MenuImpl = {
      buildFromTemplate: vi.fn(),
      setApplicationMenu: vi.fn(),
    };

    expect(configureApplicationMenu({ MenuImpl, platform: 'win32' })).toBeNull();
    expect(MenuImpl.buildFromTemplate).not.toHaveBeenCalled();
    expect(MenuImpl.setApplicationMenu).toHaveBeenCalledWith(null);
  });

  test('loads the dedicated macOS template image without runtime raster resizing', () => {
    const source = {
      isEmpty: vi.fn(() => false),
      setTemplateImage: vi.fn(),
    };
    const nativeImageImpl = { createFromPath: vi.fn(() => source) };

    const result = createTrayIcon({
      iconPath: '/app/ui/assets/logos/markdown-explorerTemplate.png',
      platform: 'darwin',
      nativeImageImpl,
    });

    expect(nativeImageImpl.createFromPath).toHaveBeenCalledWith('/app/ui/assets/logos/markdown-explorerTemplate.png');
    expect(source.setTemplateImage).toHaveBeenCalledWith(true);
    expect(result).toBe(source);
  });

  test('does not fall back to an oversized raw path when the macOS template image cannot load', () => {
    const nativeImageImpl = {
      createFromPath: vi.fn(() => ({ isEmpty: vi.fn(() => true) })),
    };

    expect(createTrayIcon({
      iconPath: '/app/ui/assets/logos/markdown-explorerTemplate.png',
      platform: 'darwin',
      nativeImageImpl,
    })).toBeNull();
  });

  test('passes the dedicated template NativeImage into Tray on macOS', () => {
    const source = {
      isEmpty: vi.fn(() => false),
      setTemplateImage: vi.fn(),
    };
    const nativeImageImpl = { createFromPath: vi.fn(() => source) };
    const tray = {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
    };
    const TrayConstructor = vi.fn(() => tray);
    const ElectronMenu = { buildFromTemplate: vi.fn(() => []) };
    const fs = { existsSync: vi.fn(() => true) };

    createAppTray({
      appDir: '/app',
      getMainWindow: vi.fn(),
      fs,
      pathImpl: path.posix,
      TrayConstructor,
      ElectronMenu,
      appQuit: vi.fn(),
      platform: 'darwin',
      nativeImageImpl,
    });

    const templatePath = '/app/ui/assets/logos/markdown-explorerTemplate.png';
    expect(fs.existsSync).toHaveBeenCalledWith(templatePath);
    expect(nativeImageImpl.createFromPath).toHaveBeenCalledWith(templatePath);
    expect(TrayConstructor).toHaveBeenCalledWith(source);
  });

  test('ships standard and Retina macOS template representations', () => {
    const logoDir = path.join(process.cwd(), 'ui', 'assets', 'logos');
    expect(readPngSize(path.join(logoDir, 'markdown-explorerTemplate.png'))).toEqual({ width: 16, height: 16 });
    expect(readPngSize(path.join(logoDir, 'markdown-explorerTemplate@2x.png'))).toEqual({ width: 32, height: 32 });
  });

  test('preserves the original icon path outside macOS', () => {
    expect(createTrayIcon({ iconPath: '/logo-128.png', platform: 'linux' })).toBe('/logo-128.png');
  });
});
