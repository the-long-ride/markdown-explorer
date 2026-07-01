import { describe, expect, test, vi } from 'vitest';

import {
  ALL_THEME_STYLE_OPTIONS,
  DEFAULT_KEYBINDINGS,
  DESKTOP_DEFAULT_KEYBINDINGS,
  PET_THEME_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_STYLE_OPTIONS,
  getDefaultKeybindings,
  isPetThemeStyle,
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from '../../../../ui/src/contexts/appStateConstants';

describe('appStateConstants', () => {
  test('DEFAULT_KEYBINDINGS has 19 entries', () => {
    expect(Object.keys(DEFAULT_KEYBINDINGS)).toHaveLength(19);
  });

  test('DESKTOP_DEFAULT_KEYBINDINGS has 19 entries', () => {
    expect(Object.keys(DESKTOP_DEFAULT_KEYBINDINGS)).toHaveLength(19);
  });

  test('DESKTOP_DEFAULT_KEYBINDINGS overrides 5 from defaults', () => {
    expect(DESKTOP_DEFAULT_KEYBINDINGS.searchCurrent).toBe('Ctrl+F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.searchAllTabs).toBe('Ctrl+Shift+F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.findCurrentFile).toBe('F');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleTheme).toBe('Ctrl+L');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.toggleSidebar).toBe('Ctrl+B');
    expect(DESKTOP_DEFAULT_KEYBINDINGS.refresh).toBe('F5');
  });

  test('getDefaultKeybindings(true) returns desktop keybindings', () => {
    const kb = getDefaultKeybindings(true);
    expect(kb.searchCurrent).toBe('Ctrl+F');
  });

  test('getDefaultKeybindings(false) returns default keybindings', () => {
    const kb = getDefaultKeybindings(false);
    expect(kb.searchCurrent).toBe('Ctrl+K');
  });

  test('getDefaultKeybindings(false) with __chromeExtBus returns Chrome keybindings', () => {
    (window as any).__chromeExtBus = {};
    const kb = getDefaultKeybindings(false);
    expect(kb.refresh).toBe('Alt+R');
    delete (window as any).__chromeExtBus;
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
    expect(normalizeThemeStyle('glass')).toBe('glass');
    expect(normalizeThemeStyle('default')).toBe('default');
    expect(normalizeThemeStyle('bento')).toBe('bento');
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
    expect(isPetThemeStyle('pet-shiba')).toBe(true);
    expect(isPetThemeStyle('pet-cat')).toBe(true);
  });

  test('isPetThemeStyle returns false for non-pet styles', () => {
    expect(isPetThemeStyle('default')).toBe(false);
    expect(isPetThemeStyle('glass')).toBe(false);
  });

  test('THEME_MODE_OPTIONS has 3 entries', () => {
    expect(THEME_MODE_OPTIONS).toHaveLength(3);
  });

  test('ALL_THEME_STYLE_OPTIONS combines style + pet options', () => {
    expect(ALL_THEME_STYLE_OPTIONS.length).toBe(THEME_STYLE_OPTIONS.length + PET_THEME_STYLE_OPTIONS.length);
  });
});
