import { describe, expect, test, vi } from 'vitest';

import {
  ALL_THEME_STYLE_OPTIONS,
  DEFAULT_KEYBINDINGS,
  DESKTOP_DEFAULT_KEYBINDINGS,
  VSCODE_DEFAULT_KEYBINDINGS,
  PET_THEME_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_STYLE_OPTIONS,
  getDefaultKeybindings,
  getDefaultKeybindingsForRuntime,
  normalizeKeybindingsForRuntime,
  isPetThemeStyle,
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from '../../../../ui/src/contexts/appStateConstants';

describe('appStateConstants', () => {
  test('DEFAULT_KEYBINDINGS has 21 entries including Save without app-owned zoom', () => {
    expect(Object.keys(DEFAULT_KEYBINDINGS)).toHaveLength(21);
    expect(DEFAULT_KEYBINDINGS.saveCurrentDocument).toBe('Ctrl+S');
  });

  test('VSCODE_DEFAULT_KEYBINDINGS adds the external editor action for VS Code', () => {
    expect(Object.keys(VSCODE_DEFAULT_KEYBINDINGS)).toHaveLength(22);
    expect(VSCODE_DEFAULT_KEYBINDINGS.editCurrentDocument).toBe('Ctrl+Alt+E');
    expect(VSCODE_DEFAULT_KEYBINDINGS.zoomIn).toBeUndefined();
    expect(VSCODE_DEFAULT_KEYBINDINGS.zoomOut).toBeUndefined();
  });

  test('DESKTOP_DEFAULT_KEYBINDINGS has 31 entries including Save, Edit, and desktop reset zoom', () => {
    expect(Object.keys(DESKTOP_DEFAULT_KEYBINDINGS)).toHaveLength(31);
    expect(DESKTOP_DEFAULT_KEYBINDINGS.saveCurrentDocument).toBe('Ctrl+S');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.editCurrentDocument).toBe('Ctrl+E');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.resetZoom).toBe('Ctrl+Alt+Z');
  });

  test('DESKTOP_DEFAULT_KEYBINDINGS overrides 5 from defaults', () => {
    expect(DESKTOP_DEFAULT_KEYBINDINGS.searchCurrent).toBe('Ctrl+F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.searchAllTabs).toBe('Ctrl+Shift+F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.findCurrentFile).toBe('F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleTheme).toBe('Ctrl+L');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleSidebar).toBe('Ctrl+B');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleToc).toBe('Ctrl+T');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.refresh).toBe('F5');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleDesktopViewMode).toBe('Ctrl+Alt+T');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.openCurrentDocumentLocation).toBe('Shift+Alt+R');
  });

  test('getDefaultKeybindings(true) returns desktop keybindings', () => {
    const kb = getDefaultKeybindings(true);
    expect(kb.searchCurrent).toBe('Ctrl+F');
  });

  test('getDefaultKeybindings(false) returns VS Code-compatible keybindings before host handshake', () => {
    const kb = getDefaultKeybindings(false);
    expect(kb.searchCurrent).toBe('Ctrl+K');
    expect(kb.editCurrentDocument).toBe('Ctrl+Alt+E');
  });

  test('getDefaultKeybindingsForRuntime keeps Edit host-specific', () => {
    expect(getDefaultKeybindingsForRuntime('desktop').editCurrentDocument).toBe('Ctrl+E');
    expect(getDefaultKeybindingsForRuntime('tauri').editCurrentDocument).toBe('Ctrl+E');
    expect(getDefaultKeybindingsForRuntime('vscode').editCurrentDocument).toBe('Ctrl+Alt+E');
    expect(getDefaultKeybindingsForRuntime('chrome').editCurrentDocument).toBeUndefined();
  });

  test('normalizeKeybindingsForRuntime strips imported Edit binding in Chromium', () => {
    const kb = normalizeKeybindingsForRuntime({ editCurrentDocument: 'Ctrl+Shift+E' }, 'chrome');
    expect(kb.editCurrentDocument).toBeUndefined();
  });

  test('normalizeKeybindingsForRuntime strips reset zoom outside desktop apps', () => {
    expect(normalizeKeybindingsForRuntime({ zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', resetZoom: 'Ctrl+Alt+Z' }, 'vscode')).not.toHaveProperty('zoomIn');
    expect(normalizeKeybindingsForRuntime({ zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', resetZoom: 'Ctrl+Alt+Z' }, 'vscode')).not.toHaveProperty('zoomOut');
    expect(normalizeKeybindingsForRuntime({ resetZoom: 'Ctrl+Alt+Z' }, 'vscode').resetZoom).toBeUndefined();
    expect(normalizeKeybindingsForRuntime({ resetZoom: 'Ctrl+Alt+Z' }, 'chrome').resetZoom).toBeUndefined();
    expect(normalizeKeybindingsForRuntime(undefined, 'desktop').resetZoom).toBe('Ctrl+Alt+Z');
    expect(normalizeKeybindingsForRuntime(undefined, 'tauri').resetZoom).toBe('Ctrl+Alt+Z');
  });

  test('normalizeKeybindings merges saved over defaults', () => {
    const result = normalizeKeybindings({ searchCurrent: 'Ctrl+P' }, false);
    expect(result.searchCurrent).toBe('Ctrl+P');
    expect(result.settings).toBe('Ctrl+i');
  });

  test('normalizeKeybindings with undefined saved returns defaults', () => {
    const result = normalizeKeybindings(undefined, false);
    expect(result.searchCurrent).toBe('Ctrl+K');
  });

  test('normalizeThemeMode valid', () => {
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('auto')).toBe('auto');
  });

  test('normalizeThemeMode invalid falls back to auto', () => {
    expect(normalizeThemeMode('invalid')).toBe('auto');
  });

  test('normalizeThemeStyle valid', () => {
    expect(normalizeThemeStyle('glass')).toBe('default');
    expect(normalizeThemeStyle('default')).toBe('default');
    expect(normalizeThemeStyle('bento')).toBe('bento');
    expect(normalizeThemeStyle('vercel')).toBe('vercel');
    expect(normalizeThemeStyle('tokyo-night')).toBe('tokyo-night');
    expect(normalizeThemeStyle('neon-voltage')).toBe('neon-voltage');
    expect(normalizeThemeStyle('raw-grid')).toBe('raw-grid');
  });

  test('normalizeThemeStyle invalid falls back to default', () => {
    expect(normalizeThemeStyle('invalid')).toBe('default');
  });

  test('normalizeDesktopViewMode valid', () => {
    expect(normalizeDesktopViewMode('tabs')).toBe('tabs');
  });

  test('normalizeDesktopViewMode invalid falls back to focus', () => {
    expect(normalizeDesktopViewMode('invalid')).toBe('focus');
  });

  test('isPetThemeStyle identifies pet themes', () => {
    expect(isPetThemeStyle('pet-white-shiba')).toBe(true);
    expect(isPetThemeStyle('pet-cat')).toBe(true);
  });

  test('isPetThemeStyle returns false for non-pet styles', () => {
    expect(isPetThemeStyle('default')).toBe(false);
    expect(isPetThemeStyle('glass')).toBe(false);
    expect(isPetThemeStyle('bento')).toBe(false);
    expect(isPetThemeStyle('vercel')).toBe(false);
    expect(isPetThemeStyle('tokyo-night')).toBe(false);
    expect(isPetThemeStyle('neon-voltage')).toBe(false);
    expect(isPetThemeStyle('raw-grid')).toBe(false);
  });

  test('THEME_MODE_OPTIONS has 3 entries', () => {
    expect(THEME_MODE_OPTIONS).toHaveLength(3);
  });

  test('ALL_THEME_STYLE_OPTIONS combines style + pet options', () => {
    expect(ALL_THEME_STYLE_OPTIONS.length).toBe(THEME_STYLE_OPTIONS.length + PET_THEME_STYLE_OPTIONS.length);
  });
});
