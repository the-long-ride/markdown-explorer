import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDebugTools } = require('../../../electron/window/debug-tools.js');

function makeWindow(devToolsOpen = false) {
  return {
    webContents: {
      isDevToolsOpened: vi.fn(() => devToolsOpen),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn(),
    },
  };
}

describe('createDebugTools', () => {
  describe('isDebugMode', () => {
    test('enabled when not packaged (dev mode)', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      const w = makeWindow();
      expect(debug.openDevToolsIfDebug(w)).toBe(true);
    });

    test('enabled when MARKDOWN_EXPLORER_DEBUG env is truthy', () => {
      for (const val of ['1', 'true', 'yes', 'on', 'TRUE', 'YES', 'ON']) {
        const debug = createDebugTools({ isPackaged: true, env: { MARKDOWN_EXPLORER_DEBUG: val }, argv: [] });
        const w = makeWindow();
        expect(debug.openDevToolsIfDebug(w)).toBe(true);
      }
    });

    test('disabled when MARKDOWN_EXPLORER_DEBUG env is falsy', () => {
      for (const val of ['0', 'false', 'no', 'off', '', undefined]) {
        const debug = createDebugTools({ isPackaged: true, env: val !== undefined ? { MARKDOWN_EXPLORER_DEBUG: val } : {}, argv: [] });
        const w = makeWindow();
        expect(debug.openDevToolsIfDebug(w)).toBe(false);
      }
    });

    test('enabled when --debug flag present', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: ['node', 'main.js', '--debug'] });
      const w = makeWindow();
      expect(debug.openDevToolsIfDebug(w)).toBe(true);
    });

    test('enabled when --devtools flag present', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: ['node', 'main.js', '--devtools'] });
      const w = makeWindow();
      expect(debug.openDevToolsIfDebug(w)).toBe(true);
    });

    test('disabled when packaged with no flags', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: [] });
      const w = makeWindow();
      expect(debug.openDevToolsIfDebug(w)).toBe(false);
    });
  });

  describe('shouldAutoOpenDevTools', () => {
    test('returns true when env is truthy (even in packaged)', () => {
      const debug = createDebugTools({ isPackaged: true, env: { MARKDOWN_EXPLORER_DEBUG: '1' }, argv: [] });
      expect(debug.shouldAutoOpenDevTools()).toBe(true);
    });

    test('returns true when --devtools flag present (even in packaged)', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: ['node', '--devtools'] });
      expect(debug.shouldAutoOpenDevTools()).toBe(true);
    });

    test('returns false when packaged with no triggers', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: [] });
      expect(debug.shouldAutoOpenDevTools()).toBe(false);
    });

    test('returns true when not packaged with no env or argv', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      expect(debug.shouldAutoOpenDevTools()).toBe(false);
    });
  });

  describe('openDevToolsIfDebug', () => {
    test('returns false when window is null', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      expect(debug.openDevToolsIfDebug(null)).toBe(false);
    });

    test('opens devtools when not already open', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      const w = makeWindow(false);
      expect(debug.openDevToolsIfDebug(w)).toBe(true);
      expect(w.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
      expect(w.webContents.isDevToolsOpened).toHaveBeenCalled();
    });

    test('does not re-open when devtools already open', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      const w = makeWindow(true);
      expect(debug.openDevToolsIfDebug(w)).toBe(true);
      expect(w.webContents.openDevTools).not.toHaveBeenCalled();
    });

    test('returns false when debug disabled', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: [] });
      const w = makeWindow(false);
      expect(debug.openDevToolsIfDebug(w)).toBe(false);
      expect(w.webContents.openDevTools).not.toHaveBeenCalled();
    });
  });

  describe('toggleDevToolsIfDebug', () => {
    test('returns false when window is null', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      expect(debug.toggleDevToolsIfDebug(null)).toBe(false);
    });

    test('closes devtools when currently open', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      const w = makeWindow(true);
      expect(debug.toggleDevToolsIfDebug(w)).toBe(true);
      expect(w.webContents.closeDevTools).toHaveBeenCalled();
      expect(w.webContents.openDevTools).not.toHaveBeenCalled();
    });

    test('opens devtools when currently closed', () => {
      const debug = createDebugTools({ isPackaged: false, env: {}, argv: [] });
      const w = makeWindow(false);
      expect(debug.toggleDevToolsIfDebug(w)).toBe(true);
      expect(w.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
      expect(w.webContents.closeDevTools).not.toHaveBeenCalled();
    });

    test('returns false when debug disabled', () => {
      const debug = createDebugTools({ isPackaged: true, env: {}, argv: [] });
      const w = makeWindow(false);
      expect(debug.toggleDevToolsIfDebug(w)).toBe(false);
      expect(w.webContents.openDevTools).not.toHaveBeenCalled();
      expect(w.webContents.closeDevTools).not.toHaveBeenCalled();
    });
  });
});