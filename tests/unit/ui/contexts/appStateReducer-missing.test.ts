import { describe, expect, test } from 'vitest';
import {
  reducer as appStateReducer,
  initialState,
  type AppState,
} from '../../../../ui/src/contexts/appStateReducer';
import type { ContentTab } from '../../../../ui/src/types';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return { ...initialState, ...overrides };
}

function makeTab(filePath: string, overrides: Partial<ContentTab> = {}): ContentTab {
  return {
    filePath,
    relativePath: filePath,
    fileName: filePath.split(/[\\/]/).pop() || filePath,
    title: filePath,
    contentHtml: '<p></p>',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    ...overrides,
  };
}

describe('appStateReducer - inline callback coverage with populated contentTabs', () => {
  test('WORKSPACE_SCAN_PROGRESS exposes a running scanned-file count', () => {
    const next = appStateReducer(makeState(), {
      type: 'WORKSPACE_SCAN_PROGRESS',
      scannedFiles: 250,
      active: true,
    });
    expect(next.isWorkspaceScanning).toBe(true);
    expect(next.scannedFiles).toBe(250);
  });

  test('REORDER_CONTENT_TABS moves dragged tab before target', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const tabC = makeTab('/c.md');
    const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/a.md' });
    const next = appStateReducer(state, {
      type: 'REORDER_CONTENT_TABS',
      sourcePath: '/c.md',
      targetPath: '/a.md',
    });

    expect(next.contentTabs.map((tab) => tab.filePath)).toEqual(['/c.md', '/a.md', '/b.md']);
  });

  test('CLOSE_CONTENT_TAB filter callback removes middle tab', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const tabC = makeTab('/c.md');
    const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/b.md' });
    const next = appStateReducer(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/b.md' });
    expect(next.contentTabs).toHaveLength(2);
    expect(next.activeContentTabPath).toBe('/a.md');
  });

  test('CLOSE_CONTENT_TABS_TO_RIGHT findIndex callback from first tab', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const tabC = makeTab('/c.md');
    const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/a.md' });
    const next = appStateReducer(state, { type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: '/a.md' });
    expect(next.contentTabs).toHaveLength(1);
    expect(next.contentTabs[0].filePath).toBe('/a.md');
  });

  test('CLOSE_OTHER_CONTENT_TABS find callback keeps middle tab', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const tabC = makeTab('/c.md');
    const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/a.md' });
    const next = appStateReducer(state, { type: 'CLOSE_OTHER_CONTENT_TABS', filePath: '/b.md' });
    expect(next.contentTabs).toHaveLength(1);
    expect(next.contentTabs[0].filePath).toBe('/b.md');
    expect(next.activeContentTabPath).toBe('/b.md');
  });

  test('ACTIVATE_CONTENT_TAB find callback activates last tab', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const tabC = makeTab('/c.md');
    const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/a.md' });
    const next = appStateReducer(state, { type: 'ACTIVATE_CONTENT_TAB', filePath: '/c.md' });
    expect(next.activeContentTabPath).toBe('/c.md');
    expect(next.currentFile).toBe('/c.md');
  });

  test('SET_THEME with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/docs/x.md')] });
    const next = appStateReducer(state, { type: 'SET_THEME', theme: 'dark' });
    expect(next.theme).toBe('dark');
    expect(next.hasThemePreference).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('SET_THEME_STYLE with populated contentTabs', () => {
    const state = makeState({
      contentTabs: [makeTab('/docs/y.md')],
      settings: { ...initialState.settings, activeCustomThemeId: 'old' },
    });
    const next = appStateReducer(state, { type: 'SET_THEME_STYLE', themeStyle: 'glass' });
    expect(next.themeStyle).toBe('glass');
    expect(next.hasThemeStylePreference).toBe(true);
    expect(next.settings.activeCustomThemeId).toBeUndefined();
  });

  test('SELECT_CUSTOM_THEME find callback with populated contentTabs', () => {
    const theme = {
      id: 't1',
      baseStyle: 'glass' as const,
      colorMode: 'light' as const,
      name: 'T',
      createdAt: 0,
      updatedAt: 0,
    };
    const state = makeState({
      contentTabs: [makeTab('/custom.md')],
      settings: { ...initialState.settings, customThemes: [theme as any] },
    });
    const next = appStateReducer(state, { type: 'SELECT_CUSTOM_THEME', themeId: 't1' });
    expect(next.themeStyle).toBe('glass');
    expect(next.settings.activeCustomThemeId).toBe('t1');
  });

  test('UPDATE_SETTINGS find callback with customThemes and populated contentTabs', () => {
    const theme = {
      id: 't1',
      baseStyle: 'glass' as const,
      colorMode: 'light' as const,
      name: 'T',
      createdAt: 0,
      updatedAt: 0,
    };
    const state = makeState({
      contentTabs: [makeTab('/settings.md')],
      settings: { ...initialState.settings, customThemes: [theme as any], activeCustomThemeId: 't1' },
    });
    const next = appStateReducer(state, { type: 'UPDATE_SETTINGS', settings: { activeCustomThemeId: 't1' } });
    expect(next.settings.activeCustomThemeId).toBe('t1');
    expect(next.themeStyle).toBe('glass');
    expect(next.contentTabs.length).toBe(1);
  });

  test('SET_MAXIMIZED with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/max.md')], isMaximized: false });
    const next = appStateReducer(state, { type: 'SET_MAXIMIZED', isMaximized: true });
    expect(next.isMaximized).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('TOGGLE_FOCUS_MODE with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/focus.md')], focusMode: false });
    const next = appStateReducer(state, { type: 'TOGGLE_FOCUS_MODE' });
    expect(next.focusMode).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('SET_SIDEBAR_ACTIVE_TAB with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/sidebar.md')], sidebarActiveTab: 'files' });
    const next = appStateReducer(state, { type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'search' });
    expect(next.sidebarActiveTab).toBe('search');
    expect(next.contentTabs.length).toBe(1);
  });

  test('SET_SIDEBAR_COLLAPSED with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/collapse.md')], sidebarCollapsed: false });
    const next = appStateReducer(state, { type: 'SET_SIDEBAR_COLLAPSED', collapsed: true });
    expect(next.sidebarCollapsed).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('TOGGLE_SIDEBAR with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/toggle.md')], sidebarCollapsed: false });
    const next = appStateReducer(state, { type: 'TOGGLE_SIDEBAR' });
    expect(next.sidebarCollapsed).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('TOGGLE_TOC with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/toc.md')], tocCollapsed: false });
    const next = appStateReducer(state, { type: 'TOGGLE_TOC' });
    expect(next.tocCollapsed).toBe(true);
    expect(next.contentTabs.length).toBe(1);
  });

  test('CURRENT_FILE_CHANGED matching with populated contentTabs', () => {
    const state = makeState({ currentFile: '/docs/a.md', contentTabs: [makeTab('/docs/a.md')] });
    const next = appStateReducer(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/docs/a.md' });
    expect(next.staleContentFilePath).toBe('/docs/a.md');
  });

  test('CURRENT_FILE_CHANGED non-matching with populated contentTabs', () => {
    const state = makeState({ currentFile: '/docs/a.md', contentTabs: [makeTab('/docs/a.md')] });
    const next = appStateReducer(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/docs/other.md' });
    expect(next.staleContentFilePath).toBeNull();
  });

  test('NAV_NOT_FOUND with populated contentTabs', () => {
    const state = makeState({ contentTabs: [makeTab('/nav.md')], isLoading: true });
    const next = appStateReducer(state, { type: 'NAV_NOT_FOUND', href: '/missing' });
    expect(next.isLoading).toBe(false);
    expect(next.notFoundHref).toBe('/missing');
    expect(next.contentTabs.length).toBe(1);
  });
});
