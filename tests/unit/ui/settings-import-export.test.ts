import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  SETTINGS_EXPORT_KIND,
  SETTINGS_EXPORT_SCHEMA_VERSION,
  createSettingsExport,
  normalizeRecentWorkspaces,
  parseSettingsImport,
  restoreLocalUiSettings,
} from '../../../ui/src/settings/settingsImportExport';

import {
  DESKTOP_TABS_STORAGE_KEY,
  FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY,
  FLOATING_TOOLBAR_STORAGE_KEY,
  WORKSPACE_ALIASES_STORAGE_KEY,
} from '../../../ui/src/desktop/constants';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-custom-theme-id');
});

describe('SETTINGS_EXPORT_KIND', () => {
  test('equals markdown-explorer-settings', () => {
    expect(SETTINGS_EXPORT_KIND).toBe('markdown-explorer-settings');
  });
});

describe('SETTINGS_EXPORT_SCHEMA_VERSION', () => {
  test('equals 1', () => {
    expect(SETTINGS_EXPORT_SCHEMA_VERSION).toBe(1);
  });
});

describe('normalizeRecentWorkspaces', () => {
  test('non-array returns []', () => {
    expect(normalizeRecentWorkspaces('not-array')).toEqual([]);
    expect(normalizeRecentWorkspaces(null)).toEqual([]);
    expect(normalizeRecentWorkspaces(42)).toEqual([]);
  });

  test('empty array returns []', () => {
    expect(normalizeRecentWorkspaces([])).toEqual([]);
  });

  test('item without path is filtered', () => {
    expect(normalizeRecentWorkspaces([{ name: 'no-path' }])).toEqual([]);
  });

  test('duplicate paths are deduplicated', () => {
    const input = [
      { path: '/a/b', name: 'B' },
      { path: '/a/b', name: 'B-dup' },
    ];
    const result = normalizeRecentWorkspaces(input);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/a/b');
  });

  test('path is trimmed, name derived from path basename if missing', () => {
    const result = normalizeRecentWorkspaces([{ path: '  /x/y/myproj  ' }]);
    expect(result[0].path).toBe('/x/y/myproj');
    expect(result[0].name).toBe('myproj');
  });

  test('name is trimmed and sliced to 120', () => {
    const longName = 'a'.repeat(200);
    const result = normalizeRecentWorkspaces([{ path: '/p', name: `  ${longName}  ` }]);
    expect(result[0].name).toBe('a'.repeat(120));
  });

  test('lastOpened defaults to Date.now() if not finite', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const result = normalizeRecentWorkspaces([{ path: '/p' }]);
    expect(result[0].lastOpened).toBe(now);
    vi.restoreAllMocks();
  });

  test('lastOpened uses provided finite value', () => {
    const result = normalizeRecentWorkspaces([{ path: '/p', lastOpened: 12345 }]);
    expect(result[0].lastOpened).toBe(12345);
  });

  test('caps at 100 entries', () => {
    const input = Array.from({ length: 150 }, (_, i) => ({ path: `/path/${i}` }));
    const result = normalizeRecentWorkspaces(input);
    expect(result).toHaveLength(100);
  });

  test('non-object item filtered', () => {
    expect(normalizeRecentWorkspaces([42, 'string', null, true])).toEqual([]);
  });
});

describe('createSettingsExport', () => {
  const baseParams = {
    theme: 'dark' as const,
    themeStyle: 'default' as const,
    settings: {
      showTitle: false,
      defaultHtmlPreview: true,
      fileTabs: false,
      documentConversion: false,
      scopeFocus: {},
      desktopViewMode: 'focus' as const,
      language: 'en',
      customThemes: [
        { id: 't1', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1 },
      ],
      activeCustomThemeId: 't1',
    },
    recentWorkspaces: [{ path: '/ws', name: 'ws', lastOpened: 1 }],
    appVersion: '1.0.0',
  };

  test('creates envelope with correct kind, schemaVersion, appVersion, exportedAt', () => {
    const result = createSettingsExport(baseParams);
    expect(result.kind).toBe('markdown-explorer-settings');
    expect(result.schemaVersion).toBe(1);
    expect(result.appVersion).toBe('1.0.0');
    expect(result.exportedAt).toBeTruthy();
  });

  test('normalizes customThemes in payload', () => {
    const result = createSettingsExport(baseParams);
    expect(result.payload.settings.customThemes).toHaveLength(1);
  });

  test('normalizes recentWorkspaces in payload', () => {
    const result = createSettingsExport(baseParams);
    expect(result.payload.recentWorkspaces).toHaveLength(1);
  });

  test('reads from localStorage for sidebarWidth/tocWidth when set', () => {
    localStorage.setItem('markdown-explorer-sidebar-width', '250');
    localStorage.setItem('markdown-explorer-toc-width', '300');
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.sidebarWidth).toBe('250');
    expect(result.payload.localUi.tocWidth).toBe('300');
  });

  test('sidebarWidth/tocWidth undefined when not set', () => {
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.sidebarWidth).toBeUndefined();
    expect(result.payload.localUi.tocWidth).toBeUndefined();
  });

  test('reads workspaceAliases from localStorage', () => {
    localStorage.setItem(WORKSPACE_ALIASES_STORAGE_KEY, JSON.stringify({ '/a': 'alias-a' }));
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.workspaceAliases).toEqual({ '/a': 'alias-a' });
  });

  test('reads desktopTabs from localStorage', () => {
    localStorage.setItem(DESKTOP_TABS_STORAGE_KEY, JSON.stringify([{ id: 'tab1' }]));
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.desktopTabs).toEqual([{ id: 'tab1' }]);
  });

  test('reads floatingToolbarPosition from localStorage', () => {
    localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify({ x: 10, y: 20 }));
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.floatingToolbarPosition).toEqual({ x: 10, y: 20 });
  });

  test('reads floatingToolbarCollapsed from localStorage', () => {
    localStorage.setItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY, 'true');
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.floatingToolbarCollapsed).toBe('true');
  });

  test('localStorage values unset yield undefined', () => {
    const result = createSettingsExport(baseParams);
    expect(result.payload.localUi.workspaceAliases).toBeUndefined();
    expect(result.payload.localUi.desktopTabs).toBeUndefined();
    expect(result.payload.localUi.floatingToolbarPosition).toBeUndefined();
    expect(result.payload.localUi.floatingToolbarCollapsed).toBeUndefined();
  });
});

describe('parseSettingsImport', () => {
  const validEnvelope = {
    kind: 'markdown-explorer-settings',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    payload: {
      theme: 'dark',
      themeStyle: 'glass',
      settings: {},
      recentWorkspaces: [],
    },
  };

  test('invalid JSON throws not valid JSON', () => {
    expect(() => parseSettingsImport('{bad json', false)).toThrow('not valid JSON');
  });

  test('non-object JSON throws does not contain settings data', () => {
    expect(() => parseSettingsImport('42', false)).toThrow('does not contain settings data');
    expect(() => parseSettingsImport('"string"', false)).toThrow('does not contain settings data');
  });

  test('wrong kind throws not a Markdown Explorer settings file', () => {
    const envelope = { ...validEnvelope, kind: 'wrong' };
    expect(() => parseSettingsImport(JSON.stringify(envelope), false)).toThrow('not a Markdown Explorer settings file');
  });

  test('invalid schemaVersion throws unknown schema version', () => {
    const envelope = { ...validEnvelope, schemaVersion: -1 };
    expect(() => parseSettingsImport(JSON.stringify(envelope), false)).toThrow('unknown schema version');
  });

  test('schemaVersion NaN throws unknown schema version', () => {
    const envelope = { ...validEnvelope, schemaVersion: 'abc' };
    expect(() => parseSettingsImport(JSON.stringify(envelope), false)).toThrow('unknown schema version');
  });

  test('missing payload defaults to empty', () => {
    const envelope = { kind: 'markdown-explorer-settings', schemaVersion: 1 };
    const result = parseSettingsImport(JSON.stringify(envelope), false);
    expect(result.recentWorkspaces).toEqual([]);
    expect(result.settings).toBeDefined();
  });

  test('valid import returns normalized theme, themeStyle, settings, recentWorkspaces, localUi', () => {
    const result = parseSettingsImport(JSON.stringify(validEnvelope), false);
    expect(result.theme).toBe('dark');
    expect(result.themeStyle).toBe('glass');
    expect(result.settings).toBeDefined();
    expect(result.recentWorkspaces).toEqual([]);
  });

  test('localUi missing defaults to {}', () => {
    const result = parseSettingsImport(JSON.stringify(validEnvelope), false);
    expect(result.localUi).toEqual({});
  });

  test('localUi present is preserved', () => {
    const envelope = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        localUi: { sidebarWidth: '200', tocWidth: '250' },
      },
    };
    const result = parseSettingsImport(JSON.stringify(envelope), false);
    expect(result.localUi.sidebarWidth).toBe('200');
  });
});

describe('restoreLocalUiSettings', () => {
  test('valid sidebarWidth sets localStorage + CSS custom property', () => {
    restoreLocalUiSettings({ sidebarWidth: '280' });
    expect(localStorage.getItem('markdown-explorer-sidebar-width')).toBe('280');
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('280px');
  });

  test('valid tocWidth sets localStorage + CSS custom property', () => {
    restoreLocalUiSettings({ tocWidth: '310' });
    expect(localStorage.getItem('markdown-explorer-toc-width')).toBe('310');
    expect(document.documentElement.style.getPropertyValue('--toc-width')).toBe('310px');
  });

  test('zero sidebarWidth not written', () => {
    restoreLocalUiSettings({ sidebarWidth: '0' });
    expect(localStorage.getItem('markdown-explorer-sidebar-width')).toBeNull();
  });

  test('negative sidebarWidth not written', () => {
    restoreLocalUiSettings({ sidebarWidth: '-10' });
    expect(localStorage.getItem('markdown-explorer-sidebar-width')).toBeNull();
  });

  test('NaN sidebarWidth not written', () => {
    restoreLocalUiSettings({ sidebarWidth: 'abc' });
    expect(localStorage.getItem('markdown-explorer-sidebar-width')).toBeNull();
  });

  test('zero tocWidth not written', () => {
    restoreLocalUiSettings({ tocWidth: '0' });
    expect(localStorage.getItem('markdown-explorer-toc-width')).toBeNull();
  });

  test('negative tocWidth not written', () => {
    restoreLocalUiSettings({ tocWidth: '-5' });
    expect(localStorage.getItem('markdown-explorer-toc-width')).toBeNull();
  });

  test('NaN tocWidth not written', () => {
    restoreLocalUiSettings({ tocWidth: 'not-a-number' });
    expect(localStorage.getItem('markdown-explorer-toc-width')).toBeNull();
  });

  test('writeJsonStorage: valid object writes workspaceAliases', () => {
    const aliases = { '/a': 'my-alias' };
    restoreLocalUiSettings({ workspaceAliases: aliases });
    expect(JSON.parse(localStorage.getItem(WORKSPACE_ALIASES_STORAGE_KEY)!)).toEqual(aliases);
  });

  test('writeJsonStorage: valid object writes desktopTabs', () => {
    const tabs = [{ id: 'tab1' }];
    restoreLocalUiSettings({ desktopTabs: tabs });
    expect(JSON.parse(localStorage.getItem(DESKTOP_TABS_STORAGE_KEY)!)).toEqual(tabs);
  });

  test('writeJsonStorage: valid object writes floatingToolbarPosition', () => {
    const pos = { x: 100, y: 200 };
    restoreLocalUiSettings({ floatingToolbarPosition: pos });
    expect(JSON.parse(localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY)!)).toEqual(pos);
  });

  test('writeJsonStorage: oversized object skipped', () => {
    const huge = { data: 'x'.repeat(400_000) };
    restoreLocalUiSettings({ workspaceAliases: huge });
    expect(localStorage.getItem(WORKSPACE_ALIASES_STORAGE_KEY)).toBeNull();
  });

  test('writeJsonStorage: oversized floatingToolbarPosition (limit 20k) skipped', () => {
    const huge = { data: 'x'.repeat(25_000) };
    restoreLocalUiSettings({ floatingToolbarPosition: huge });
    expect(localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY)).toBeNull();
  });

  test('writeJsonStorage: invalid value ignored', () => {
    restoreLocalUiSettings({ workspaceAliases: 'not-an-object' });
    expect(localStorage.getItem(WORKSPACE_ALIASES_STORAGE_KEY)).toBeNull();
  });

  test('writeJsonStorage: null value ignored', () => {
    restoreLocalUiSettings({ workspaceAliases: null as any });
    expect(localStorage.getItem(WORKSPACE_ALIASES_STORAGE_KEY)).toBeNull();
  });

  test('floatingToolbarCollapsed "true" written', () => {
    restoreLocalUiSettings({ floatingToolbarCollapsed: 'true' });
    expect(localStorage.getItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY)).toBe('true');
  });

  test('floatingToolbarCollapsed "false" written', () => {
    restoreLocalUiSettings({ floatingToolbarCollapsed: 'false' });
    expect(localStorage.getItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY)).toBe('false');
  });

  test('floatingToolbarCollapsed other value ignored', () => {
    restoreLocalUiSettings({ floatingToolbarCollapsed: 'yes' });
    expect(localStorage.getItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY)).toBeNull();
  });
});
