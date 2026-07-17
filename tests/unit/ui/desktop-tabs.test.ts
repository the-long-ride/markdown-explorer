import { describe, expect, test, vi, beforeEach } from 'vitest';

import {
  clampFloatingToolbarPosition,
  createEmptyTab,
  createTabId,
  getDroppedFilePath,
  getTabLabel,
  getWorkspaceNameFromPath,
  readInitialDesktopState,
  readPersistedDesktopTabs,
  readToolbarPosition,
  readWorkspaceAliases,
  writePersistedDesktopTabs,
  writeWorkspaceAliases,
} from '../../../ui/src/desktop/desktopTabs';

describe('desktopTabs', () => {
  describe('createEmptyTab', () => {
    test('returns tab with all defaults', () => {
      const tab = createEmptyTab('test-id', 'workspace');
      expect(tab.id).toBe('test-id');
      expect(tab.kind).toBe('workspace');
      expect(tab.fileList).toEqual([]);
      expect(tab.tree).toBeNull();
      expect(tab.currentFile).toBeNull();
      expect(tab.contentHtml).toBe('');
      expect(tab.markdownSource).toBeNull();
      expect(tab.frontmatter).toEqual({});
      expect(tab.toc).toEqual([]);
      expect(tab.previewInfo).toBeNull();
      expect(tab.relativePath).toBe('');
      expect(tab.isLoading).toBe(false);
      expect(tab.notFoundHref).toBeNull();
      expect(tab.workspaceUnavailablePath).toBeNull();
      expect(tab.workspaceUnavailableReason).toBeNull();
      expect(tab.contentTabs).toEqual([]);
      expect(tab.activeContentTabPath).toBeNull();
    });
  });

  describe('getWorkspaceNameFromPath', () => {
    test('extracts last segment from forward-slash path', () => {
      expect(getWorkspaceNameFromPath('C:/Users/test/docs')).toBe('docs');
    });

    test('extracts last segment from backslash path', () => {
      expect(getWorkspaceNameFromPath('C:\\Users\\test\\docs')).toBe('docs');
    });
  });

  describe('getTabLabel', () => {
    test('prefers alias over workspaceName', () => {
      expect(getTabLabel({ alias: 'My Project', workspaceName: 'docs', kind: 'workspace', id: '1' } as any)).toBe('My Project');
    });

    test('uses workspaceName when no alias', () => {
      expect(getTabLabel({ workspaceName: 'docs', kind: 'workspace', id: '1' } as any)).toBe('docs');
    });

    test('falls back to Home for home kind', () => {
      expect(getTabLabel({ kind: 'home', id: '1' } as any)).toBe('Home');
    });

    test('falls back to New workspace for non-home kind without name', () => {
      expect(getTabLabel({ kind: 'new', id: '1' } as any)).toBe('New workspace');
    });
  });

  describe('createTabId', () => {
    test('starts with tab-', () => {
      expect(createTabId()).toMatch(/^tab-/);
    });
  });

  describe('clampFloatingToolbarPosition', () => {
    test('clamps position to viewport with margin', () => {
      const pos = clampFloatingToolbarPosition({ x: -100, y: -100 }, { width: 320, height: 52 });
      expect(pos.x).toBe(8);
      expect(pos.y).toBe(8);
    });

    test('respects size for clamping', () => {
      const pos = clampFloatingToolbarPosition({ x: 99999, y: 99999 }, { width: 320, height: 52 });
      expect(pos.x).toBeLessThanOrEqual(window.innerWidth - 320 - 8);
      expect(pos.y).toBeLessThanOrEqual(window.innerHeight - 52 - 8);
    });

    test('SSR (no window) returns position as-is', () => {
      const originalWindow = globalThis.window;
      (globalThis as any).window = undefined;
      const pos = clampFloatingToolbarPosition({ x: 50, y: 50 }, { width: 320, height: 52 });
      expect(pos).toEqual({ x: 50, y: 50 });
      (globalThis as any).window = originalWindow;
    });
  });

  describe('readToolbarPosition', () => {
    beforeEach(() => { localStorage.clear(); });

    test('missing key returns default', () => {
      expect(readToolbarPosition()).toEqual({ x: 36, y: 36 });
    });

    test('reads stored values', () => {
      localStorage.setItem('markdown-explorer-tab-toolbar-position', JSON.stringify({ x: 100, y: 200 }));
      expect(readToolbarPosition()).toEqual({ x: 100, y: 200 });
    });

    test('invalid JSON returns default', () => {
      localStorage.setItem('markdown-explorer-tab-toolbar-position', '{bad');
      expect(readToolbarPosition()).toEqual({ x: 36, y: 36 });
    });
  });

  describe('readWorkspaceAliases', () => {
    beforeEach(() => { localStorage.clear(); });

    test('missing key returns empty', () => {
      expect(readWorkspaceAliases()).toEqual({});
    });

    test('reads valid data', () => {
      localStorage.setItem('markdown-explorer-workspace-aliases-v1', JSON.stringify({ '/path': 'alias' }));
      expect(readWorkspaceAliases()).toEqual({ '/path': 'alias' });
    });

    test('invalid data returns empty', () => {
      localStorage.setItem('markdown-explorer-workspace-aliases-v1', 'not-json');
      expect(readWorkspaceAliases()).toEqual({});
    });
  });

  describe('writeWorkspaceAliases', () => {
    beforeEach(() => { localStorage.clear(); });

    test('writes to localStorage', () => {
      writeWorkspaceAliases({ '/a': 'A' });
      expect(JSON.parse(localStorage.getItem('markdown-explorer-workspace-aliases-v1')!)).toEqual({ '/a': 'A' });
    });

    test('silently ignores errors', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
      expect(() => writeWorkspaceAliases({ '/a': 'A' })).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('readPersistedDesktopTabs', () => {
    beforeEach(() => { localStorage.clear(); });

    test('adds home tab if missing', () => {
      localStorage.setItem('markdown-explorer-desktop-tabs-v1', JSON.stringify({
        tabs: [{ id: 'tab-1', kind: 'workspace' }],
        activeTabId: 'tab-1',
      }));
      const result = readPersistedDesktopTabs({});
      expect(result.tabs[0].id).toBe('home');
      expect(result.tabs[0].kind).toBe('home');
    });

    test('restores aliases from workspaceAliases', () => {
      localStorage.setItem('markdown-explorer-desktop-tabs-v1', JSON.stringify({
        tabs: [{ id: 'tab-1', kind: 'workspace', workspacePath: '/docs' }],
        activeTabId: 'tab-1',
      }));
      const result = readPersistedDesktopTabs({ '/docs': 'MyDocs' });
      expect(result.tabs.find(t => t.id === 'tab-1')?.alias).toBe('MyDocs');
    });

    test('invalid JSON returns home-only default', () => {
      localStorage.setItem('markdown-explorer-desktop-tabs-v1', 'bad-json');
      const result = readPersistedDesktopTabs({});
      expect(result.tabs).toHaveLength(1);
      expect(result.tabs[0].id).toBe('home');
    });
  });

  describe('writePersistedDesktopTabs', () => {
    beforeEach(() => { localStorage.clear(); });

    test('serializes tab metadata', () => {
      const tab = createEmptyTab('tab-1', 'workspace');
      tab.workspacePath = '/docs';
      tab.workspaceName = 'docs';
      writePersistedDesktopTabs([tab], 'tab-1');
      const stored = JSON.parse(localStorage.getItem('markdown-explorer-desktop-tabs-v1')!);
      expect(stored.activeTabId).toBe('tab-1');
      expect(stored.tabs[0].id).toBe('tab-1');
      expect(stored.tabs[0].workspacePath).toBe('/docs');
    });
  });

  describe('readInitialDesktopState', () => {
    beforeEach(() => { localStorage.clear(); });

    test('combines aliases and tab state', () => {
      localStorage.setItem('markdown-explorer-workspace-aliases-v1', JSON.stringify({ '/a': 'AliasA' }));
      localStorage.setItem('markdown-explorer-desktop-tabs-v1', JSON.stringify({
        tabs: [{ id: 't1', kind: 'workspace', workspacePath: '/b', alias: 'AliasB' }],
        activeTabId: 't1',
      }));
      const state = readInitialDesktopState();
      expect(state.workspaceAliases['/a']).toBe('AliasA');
      expect(state.workspaceAliases['/b']).toBe('AliasB');
    });

    test('adds missing alias from tab data', () => {
      localStorage.setItem('markdown-explorer-workspace-aliases-v1', '{}');
      localStorage.setItem('markdown-explorer-desktop-tabs-v1', JSON.stringify({
        tabs: [{ id: 't1', kind: 'workspace', workspacePath: '/new', alias: 'NewAlias' }],
        activeTabId: 't1',
      }));
      const state = readInitialDesktopState();
      expect(state.workspaceAliases['/new']).toBe('NewAlias');
    });
  });

  describe('getDroppedFilePath', () => {
    test('uses electronAPI.getPathForFile when available', () => {
      (window as any).electronAPI = { getPathForFile: vi.fn().mockReturnValue('/path/to/file.md') };
      const file = new File([], 'test.md');
      expect(getDroppedFilePath(file)).toBe('/path/to/file.md');
      delete (window as any).electronAPI;
    });

    test('uses Tauri consumed dropped path before DOM file path fallbacks', () => {
      (window as any).electronAPI = {
        consumeDroppedPaths: vi.fn().mockReturnValue(['C:\\docs\\dropped-folder']),
        getPathForFile: vi.fn().mockReturnValue('C:\\docs\\from-file.md'),
      };
      const file = new File([], 'test.md');
      (file as any).path = 'C:\\docs\\fallback.md';
      expect(getDroppedFilePath(file)).toBe('C:\\docs\\dropped-folder');
      delete (window as any).electronAPI;
    });

    test('falls back to file.path', () => {
      const file = new File([], 'test.md');
      (file as any).path = '/fallback/path.md';
      expect(getDroppedFilePath(file)).toBe('/fallback/path.md');
    });
  });
});
