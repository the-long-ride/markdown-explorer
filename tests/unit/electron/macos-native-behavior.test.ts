import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { configureApplicationMenu } = require('../../../electron/core/main-bootstrap.js');

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
});
