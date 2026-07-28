import { describe, expect, test, vi } from 'vitest';

import {
  type AppState,
  type Action,
  reducer,
  initialState,
  createEmptyUpdateState,
  createInitialState,
  normalizePathKey,
  getWorkspaceScopeKey,
  getPathFileName,
  stripMarkdownExtension,
  findFileInfo,
  upsertContentTab,
  renderMarkdownClientSide,
  createContentTabFromMessage,
  createContentTabFromState,
  applyContentTab,
  clearContentTabs,
  applyContentTabsFallback,
  refreshContentTabMetadata,
  reconcileScopeFocusSetting,
} from '../../../../ui/src/contexts/appStateReducer';
import type { ContentTab, MdFile, FolderNode } from '../../../../ui/src/types';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return { ...initialState, ...overrides };
}

function makeTab(filePath: string, overrides: Partial<ContentTab> = {}): ContentTab {
  return {
    filePath,
    relativePath: filePath,
    fileName: filePath.split(/[\\/]/).pop() || filePath,
    title: filePath,
    contentHtml: '<p>test</p>',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    ...overrides,
  };
}

const sampleFileList: MdFile[] = [
  { fsPath: 'C:/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
  { fsPath: 'C:/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
];

describe('normalizePathKey', () => {
  test('backslashes to forward slashes', () => {
    expect(normalizePathKey('C:\\Docs\\File.md')).toBe('c:/docs/file.md');
  });

  test('already forward slashes', () => {
    expect(normalizePathKey('C:/Docs/File.md')).toBe('c:/docs/file.md');
  });

  test('mixed separators', () => {
    expect(normalizePathKey('C:/Docs\\Sub/File.md')).toBe('c:/docs/sub/file.md');
  });
});

describe('getWorkspaceScopeKey', () => {
  test('prefers workspacePath', () => {
    expect(getWorkspaceScopeKey('/docs', 'My Docs')).toBe('/docs');
  });

  test('falls back to workspaceName', () => {
    expect(getWorkspaceScopeKey(undefined, 'My Docs')).toBe('My Docs');
  });

  test('falls back to default', () => {
    expect(getWorkspaceScopeKey(undefined, '')).toBe('default');
  });
});

describe('getPathFileName', () => {
  test('POSIX path', () => {
    expect(getPathFileName('/docs/guide.md')).toBe('guide.md');
  });

  test('Windows path', () => {
    expect(getPathFileName('C:\\docs\\guide.md')).toBe('guide.md');
  });

  test('no separator returns input', () => {
    expect(getPathFileName('file.md')).toBe('file.md');
  });

  test('empty returns Document', () => {
    expect(getPathFileName('')).toBe('Document');
  });
});

describe('stripMarkdownExtension', () => {
  test('removes .md', () => {
    expect(stripMarkdownExtension('guide.md')).toBe('guide');
  });

  test('removes .mdx', () => {
    expect(stripMarkdownExtension('api.mdx')).toBe('api');
  });

  test('no extension returns same', () => {
    expect(stripMarkdownExtension('README')).toBe('README');
  });

  test('multiple dots removes last', () => {
    expect(stripMarkdownExtension('my.file.md')).toBe('my.file');
  });
});

describe('findFileInfo', () => {
  test('matches by fsPath case-insensitive', () => {
    expect(findFileInfo(sampleFileList, 'c:/DOCS/readme.md')).toBe(sampleFileList[0]);
  });

  test('matches by relativePath', () => {
    expect(findFileInfo(sampleFileList, 'readme.md')).toBe(sampleFileList[0]);
  });

  test('no match returns undefined', () => {
    expect(findFileInfo(sampleFileList, 'missing.md')).toBeUndefined();
  });
});

describe('upsertContentTab', () => {
  test('inserts new tab', () => {
    const tabs: ContentTab[] = [];
    const tab = makeTab('/a.md');
    expect(upsertContentTab(tabs, tab)).toEqual([tab]);
  });

  test('updates existing tab by normalized path', () => {
    const tab1 = makeTab('/A.md', { contentHtml: 'old' });
    const tab2 = makeTab('/a.md', { contentHtml: 'new' });
    expect(upsertContentTab([tab1], tab2)).toEqual([tab2]);
  });
});

describe('createEmptyUpdateState', () => {
  test('returns idle state', () => {
    const state = createEmptyUpdateState();
    expect(state.status).toBe('idle');
    expect(state.version).toBe('');
    expect(state.progressPercent).toBe(0);
  });
});

describe('createInitialState', () => {
  test('no saved state, desktop', () => {
    const state = createInitialState(undefined, true);
    expect(state.appRuntime).toBe('desktop');
    expect(state.tocCollapsed).toBe(false);
  });

  test('no saved state, vscode', () => {
    const state = createInitialState(undefined, false);
    expect(state.appRuntime).toBe('vscode');
  });

  test('with saved state', () => {
    const saved = {
      theme: 'dark',
      themeStyle: 'bento',
      showTitle: true,
      defaultHtmlPreview: false,
      defaultCsvPreview: false,
      fileTabs: true,
      documentConversion: true,
      scopeFocus: { ws: ['/a.md'] },
      searchScopeFocus: {},
      desktopViewMode: 'tabs',
      keybindings: { searchCurrent: 'Ctrl+F' },
      language: 'vi',
      customThemes: [],
      activeCustomThemeId: undefined,
    };
    const state = createInitialState(saved as any, true);
    expect(state.theme).toBe('dark');
    expect(state.hasThemePreference).toBe(true);
    expect(state.themeStyle).toBe('bento');
    expect(state.hasThemeStylePreference).toBe(true);
    expect(state.settings.showTitle).toBe(true);
    expect(state.settings.defaultHtmlPreview).toBe(false);
    expect(state.settings.fileTabs).toBe(true);
    expect(state.settings.desktopViewMode).toBe('tabs');
    expect(state.settings.language).toBe('vi');
  });

  test('with storage mock for toc-collapsed', () => {
    const storage = { getItem: (k: string) => k === 'markdown-explorer-toc-collapsed' ? 'true' : null };
    const state = createInitialState(undefined, false, storage as any);
    expect(state.tocCollapsed).toBe(true);
  });

  test('with invalid saved theme falls back to default', () => {
    const saved = { theme: 'invalid-mode', themeStyle: 'nonexistent' };
    const state = createInitialState(saved as any, false);
    expect(state.theme).toBe('auto');
    expect(state.hasThemePreference).toBe(true);
    expect(state.themeStyle).toBe('default');
  });
});

describe('renderMarkdownClientSide', () => {
  test('null source returns empty', () => {
    const result = renderMarkdownClientSide(null, '/file.md');
    expect(result.html).toBe('');
  });

  test('valid markdown returns HTML', () => {
    const result = renderMarkdownClientSide('# Hello', '/hello.md');
    expect(result.html).toContain('Hello');
    expect(result.toc.length).toBeGreaterThan(0);
  });

  test('error returns pre fallback', () => {
    const result = renderMarkdownClientSide('ok', null, undefined);
    expect(result.html).toBeTruthy();
  });
});

describe('createContentTabFromMessage', () => {
  test('with host-rendered HTML', () => {
    const msg = { filePath: '/docs/a.md', html: '<p>host</p>', frontmatter: { title: 'A' }, toc: [], relativePath: 'a.md', title: 'A Doc' } as any;
    const tab = createContentTabFromMessage(msg, sampleFileList);
    expect(tab.filePath).toBe('/docs/a.md');
    expect(tab.contentHtml).toBe('<p>host</p>');
  });

  test('with markdownSource renders client-side', () => {
    const msg = { filePath: '/docs/a.md', markdownSource: '# Title', html: '', frontmatter: {}, toc: [], relativePath: 'a.md' } as any;
    const tab = createContentTabFromMessage(msg, sampleFileList);
    expect(tab.contentHtml).toContain('Title');
    expect(tab.markdownSource).toBe('# Title');
  });

  test('derives title from fileInfo when msg.title missing', () => {
    const msg = { filePath: 'readme.md', html: '<p>test</p>', frontmatter: {}, toc: [], relativePath: '' } as any;
    const tab = createContentTabFromMessage(msg, sampleFileList);
    expect(tab.title).toBe('Readme');
  });
});

describe('createContentTabFromState', () => {
  test('returns null when no currentFile', () => {
    const state = makeState({ currentFile: null });
    expect(createContentTabFromState(state)).toBeNull();
  });

  test('creates tab from state fields', () => {
    const state = makeState({
      currentFile: '/docs/a.md',
      contentHtml: '<p>content</p>',
      markdownSource: '# Hi',
      frontmatter: { x: 'y' },
      toc: [{ level: 1, text: 'Hi', id: 'hi' }],
      relativePath: 'a.md',
      fileList: sampleFileList,
    });
    const tab = createContentTabFromState(state);
    expect(tab).not.toBeNull();
    expect(tab!.filePath).toBe('/docs/a.md');
    expect(tab!.contentHtml).toBe('<p>content</p>');
  });
});

describe('applyContentTab', () => {
  test('sets active path and increments renderVersion', () => {
    const state = makeState({ renderVersion: 5 });
    const tab = makeTab('/docs/a.md');
    const next = applyContentTab(state, tab);
    expect(next.currentFile).toBe('/docs/a.md');
    expect(next.activeContentTabPath).toBe('/docs/a.md');
    expect(next.renderVersion).toBe(6);
  });
});

describe('clearContentTabs', () => {
  test('resets all content fields', () => {
    const state = makeState({ currentFile: '/a.md', contentHtml: 'x', contentTabs: [makeTab('/a.md')], activeContentTabPath: '/a.md' });
    const next = clearContentTabs(state);
    expect(next.currentFile).toBeNull();
    expect(next.contentTabs).toEqual([]);
    expect(next.activeContentTabPath).toBeNull();
    expect(next.renderVersion).toBe(state.renderVersion + 1);
  });
});

describe('applyContentTabsFallback', () => {
  test('empty tabs clears all', () => {
    const state = makeState();
    const next = applyContentTabsFallback(state, []);
    expect(next.contentTabs).toEqual([]);
    expect(next.currentFile).toBeNull();
  });

  test('active tab still present keeps it', () => {
    const tab = makeTab('/a.md');
    const state = makeState({ activeContentTabPath: '/a.md', contentTabs: [tab] });
    const next = applyContentTabsFallback(state, [tab]);
    expect(next.contentTabs).toEqual([tab]);
  });

  test('active tab removed uses preferred path', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const state = makeState({ activeContentTabPath: '/gone.md', contentTabs: [tabA, tabB] });
    const next = applyContentTabsFallback(state, [tabA, tabB], '/a.md');
    expect(next.activeContentTabPath).toBe('/a.md');
  });

  test('active tab removed and no preferred uses last tab', () => {
    const tabA = makeTab('/a.md');
    const tabB = makeTab('/b.md');
    const state = makeState({ activeContentTabPath: '/gone.md', contentTabs: [tabA, tabB] });
    const next = applyContentTabsFallback(state, [tabA, tabB]);
    expect(next.activeContentTabPath).toBe('/b.md');
  });
});

describe('refreshContentTabMetadata', () => {
  test('empty tabs returns as-is', () => {
    expect(refreshContentTabMetadata([], sampleFileList)).toEqual([]);
  });

  test('empty fileList returns as-is', () => {
    const tabs = [makeTab('readme.md')];
    expect(refreshContentTabMetadata(tabs, [])).toEqual(tabs);
  });

  test('updates matching tab metadata', () => {
    const tabs = [makeTab('c:/docs/readme.md', { fileName: 'old.md', title: 'Old' })];
    const result = refreshContentTabMetadata(tabs, sampleFileList);
    expect(result[0].fileName).toBe('readme.md');
    expect(result[0].title).toBe('Readme');
  });

  test('keeps tab unchanged when no match', () => {
    const tabs = [makeTab('/unknown.md')];
    const result = refreshContentTabMetadata(tabs, sampleFileList);
    expect(result[0].fileName).toBe('unknown.md');
  });
});

describe('reducer', () => {
  describe('READY_ACK', () => {
    test('same workspace preserves content tabs', () => {
      const tab = makeTab('/a.md');
      const state = makeState({ workspaceName: 'ws', contentTabs: [tab], activeContentTabPath: '/a.md' });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: sampleFileList,
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'ws',
      });
      expect(next.contentTabs.length).toBe(1);
      expect(next.activeContentTabPath).toBe('/a.md');
    });

    test('workspace change clears active tab path', () => {
      const state = makeState({ workspaceName: 'old' });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: sampleFileList,
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'new',
      });
      expect(next.activeContentTabPath).toBeNull();
      expect(next.focusMode).toBe(false);
      expect(next.sidebarActiveTab).toBe('files');
    });

    test('preserves user theme preference', () => {
      const state = makeState({ theme: 'light', hasThemePreference: true });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'ws',
      });
      expect(next.theme).toBe('light');
    });

    test('uses action theme when no user preference', () => {
      const state = makeState({ theme: 'auto', hasThemePreference: false });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'ws',
      });
      expect(next.theme).toBe('dark');
    });

    test('with activeContentTabPath override', () => {
      const state = makeState({ workspaceName: 'ws' });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'ws',
        activeContentTabPath: '/docs/a.md',
      });
      expect(next.activeContentTabPath).toBe('/docs/a.md');
    });

    test('workspace change with name keeps isLoading when true', () => {
      const state = makeState({ isLoading: true, workspaceName: 'old' });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: 'new',
      });
      expect(next.isLoading).toBe(true);
    });

    test('workspace change without name sets loading false', () => {
      const state = makeState({ isLoading: true, workspaceName: 'old' });
      const next = reducer(state, {
        type: 'READY_ACK',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'glass',
        defaultExpanded: true,
        workspaceName: '',
      });
      expect(next.isLoading).toBe(false);
    });
  });

  test('RECENT_WORKSPACES_CHANGED', () => {
    const state = makeState();
    const next = reducer(state, { type: 'RECENT_WORKSPACES_CHANGED', recentWorkspaces: [{ name: 'x', path: '/x', lastOpened: 1 }] });
    expect(next.recentWorkspaces).toEqual([{ name: 'x', path: '/x', lastOpened: 1 }]);
  });

  test('WORKSPACE_SCAN_PROGRESS does not turn background indexing into global loading', () => {
    const state = makeState({ isLoading: false, workspaceName: '' });
    const next = reducer(state, {
      type: 'WORKSPACE_SCAN_PROGRESS',
      active: true,
      scannedFiles: 2400,
    });
    expect(next.isLoading).toBe(false);
    expect(next.isWorkspaceScanning).toBe(true);
    expect(next.scannedFiles).toBe(2400);
  });

    describe('RENDER_CONTENT', () => {
      test('keeps an active workspace scan visible while initial content renders', () => {
        const state = makeState({ isWorkspaceScanning: true, scannedFiles: 3 });
        const next = reducer(state, {
          type: 'RENDER_CONTENT',
          msg: { filePath: '', html: '', frontmatter: {}, toc: [], relativePath: '' } as any,
        });

        expect(next.isWorkspaceScanning).toBe(true);
        expect(next.scannedFiles).toBe(3);
      });

      test('fileTabs disabled clears tabs', () => {
      const state = makeState({ settings: { ...initialState.settings, fileTabs: false } });
      const next = reducer(state, { type: 'RENDER_CONTENT', msg: { filePath: '/a.md', html: '<p>x</p>', frontmatter: {}, toc: [], relativePath: 'a.md' } as any });
      expect(next.contentTabs).toEqual([]);
      expect(next.activeContentTabPath).toBeNull();
    });

    test('fileTabs enabled with no filePath keeps tabs, nulls active', () => {
      const tab = makeTab('/old.md');
      const state = makeState({ settings: { ...initialState.settings, fileTabs: true }, contentTabs: [tab] });
      const next = reducer(state, { type: 'RENDER_CONTENT', msg: { filePath: '', html: '', frontmatter: {}, toc: [], relativePath: '' } as any });
      expect(next.activeContentTabPath).toBeNull();
    });

    test('fileTabs enabled with filePath upserts tab', () => {
      const state = makeState({ settings: { ...initialState.settings, fileTabs: true }, fileList: sampleFileList });
      const next = reducer(state, { type: 'RENDER_CONTENT', msg: { filePath: '/docs/a.md', html: '<p>x</p>', frontmatter: {}, toc: [], relativePath: 'a.md' } as any });
      expect(next.contentTabs.length).toBe(1);
      expect(next.activeContentTabPath).toBe('/docs/a.md');
      expect(next.renderVersion).toBe(1);
    });

    test('applies an explicit HTML preview intent while loading an unopened file', () => {
      const state = makeState({
        settings: { ...initialState.settings, fileTabs: true, defaultHtmlPreview: true },
      });
      const next = reducer(state, {
        type: 'RENDER_CONTENT',
        htmlPreviewOverride: false,
        msg: {
          filePath: '/docs/page.html',
          html: '<p>rendered markdown view</p>',
          sourceDocumentText: '<!doctype html><html><body>Page</body></html>',
          frontmatter: {},
          toc: [],
          relativePath: 'page.html',
        } as any,
      });

      expect(next.currentHtmlPreviewOverride).toBe(false);
      expect(next.contentTabs[0].htmlPreviewOverride).toBe(false);
    });

    test('with markdownSource renders client-side', () => {
      const state = makeState({ settings: { ...initialState.settings, fileTabs: true } });
      const next = reducer(state, { type: 'RENDER_CONTENT', msg: { filePath: '/a.md', markdownSource: '# Hello', html: '', frontmatter: {}, toc: [], relativePath: 'a.md' } as any });
      expect(next.contentHtml).toContain('Hello');
    });
  });

  describe('CURRENT_FILE_CHANGED', () => {
    test('matching file marks stale', () => {
      const state = makeState({ currentFile: '/docs/a.md' });
      const next = reducer(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/docs/a.md' });
      expect(next.staleContentFilePath).toBe('/docs/a.md');
    });

    test('non-matching file returns unchanged', () => {
      const state = makeState({ currentFile: '/docs/a.md' });
      const next = reducer(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/docs/other.md' });
      expect(next.staleContentFilePath).toBeNull();
    });

    test('case-insensitive match', () => {
      const state = makeState({ currentFile: '/Docs/A.md' });
      const next = reducer(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/docs/a.md' });
      expect(next.staleContentFilePath).toBe('/docs/a.md');
    });
  });

  test('NAV_NOT_FOUND', () => {
    const state = makeState({ isLoading: true });
    const next = reducer(state, { type: 'NAV_NOT_FOUND', href: '/missing' });
    expect(next.isLoading).toBe(false);
    expect(next.notFoundHref).toBe('/missing');
    expect(next.workspaceUnavailablePath).toBeNull();
  });

  describe('ACTIVATE_CONTENT_TAB', () => {
    test('found tab activates it', () => {
      const tab = makeTab('/a.md');
      const state = makeState({ contentTabs: [tab] });
      const next = reducer(state, { type: 'ACTIVATE_CONTENT_TAB', filePath: '/a.md' });
      expect(next.activeContentTabPath).toBe('/a.md');
    });

    test('not found returns unchanged', () => {
      const state = makeState({ contentTabs: [] });
      const next = reducer(state, { type: 'ACTIVATE_CONTENT_TAB', filePath: '/a.md' });
      expect(next).toEqual(state);
    });
  });

  describe('SET_CONTENT_TAB_HTML_PREVIEW', () => {
    test('updates the current HTML view when file tabs are disabled', () => {
      const state = makeState({
        currentFile: '/docs/page.html',
        currentHtmlPreviewOverride: undefined,
        contentTabs: [],
        settings: { ...initialState.settings, fileTabs: false },
      });

      const next = reducer(state, {
        type: 'SET_CONTENT_TAB_HTML_PREVIEW',
        filePath: '/docs/page.html',
        enabled: false,
      });

      expect(next.currentHtmlPreviewOverride).toBe(false);
      expect(next.contentTabs).toEqual([]);
      expect(next.renderVersion).toBe(state.renderVersion + 1);
    });

    test('preserves the current override while updating a matching tab', () => {
      const tab = makeTab('/docs/page.html', { htmlPreviewOverride: true });
      const state = makeState({
        currentFile: '/docs/page.html',
        currentHtmlPreviewOverride: true,
        contentTabs: [tab],
      });

      const next = reducer(state, {
        type: 'SET_CONTENT_TAB_HTML_PREVIEW',
        filePath: '/docs/page.html',
        enabled: false,
      });

      expect(next.currentHtmlPreviewOverride).toBe(false);
      expect(next.contentTabs[0].htmlPreviewOverride).toBe(false);
    });
  });

  describe('CLOSE_CONTENT_TAB', () => {
    test('non-active tab removal', () => {
      const tabA = makeTab('/a.md');
      const tabB = makeTab('/b.md');
      const state = makeState({ contentTabs: [tabA, tabB], activeContentTabPath: '/b.md' });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/a.md' });
      expect(next.contentTabs.length).toBe(1);
      expect(next.activeContentTabPath).toBe('/b.md');
    });

    test('closing active tab falls back to previous', () => {
      const tabA = makeTab('/a.md');
      const tabB = makeTab('/b.md');
      const state = makeState({ contentTabs: [tabA, tabB], activeContentTabPath: '/b.md' });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/b.md' });
      expect(next.activeContentTabPath).toBe('/a.md');
    });

    test('closing only tab clears all', () => {
      const tabA = makeTab('/a.md');
      const state = makeState({ contentTabs: [tabA], activeContentTabPath: '/a.md' });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/a.md' });
      expect(next.contentTabs).toEqual([]);
      expect(next.currentFile).toBeNull();
    });

    test('tab not found returns unchanged', () => {
      const state = makeState({ contentTabs: [] });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/x.md' });
      expect(next).toEqual(state);
    });
  });

  describe('CLOSE_CONTENT_TABS_TO_RIGHT', () => {
    test('slices tabs to index + 1', () => {
      const tabA = makeTab('/a.md');
      const tabB = makeTab('/b.md');
      const tabC = makeTab('/c.md');
      const state = makeState({ contentTabs: [tabA, tabB, tabC], activeContentTabPath: '/a.md' });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: '/a.md' });
      expect(next.contentTabs.length).toBe(1);
    });

    test('tab not found returns unchanged', () => {
      const state = makeState({ contentTabs: [makeTab('/a.md')] });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: '/z.md' });
      expect(next).toEqual(state);
    });

    test('already at last tab returns unchanged', () => {
      const tabA = makeTab('/a.md');
      const tabB = makeTab('/b.md');
      const state = makeState({ contentTabs: [tabA, tabB], activeContentTabPath: '/b.md' });
      const next = reducer(state, { type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: '/b.md' });
      expect(next).toEqual(state);
    });
  });

  describe('CLOSE_OTHER_CONTENT_TABS', () => {
    test('keeps only target tab', () => {
      const tabA = makeTab('/a.md');
      const tabB = makeTab('/b.md');
      const state = makeState({ contentTabs: [tabA, tabB] });
      const next = reducer(state, { type: 'CLOSE_OTHER_CONTENT_TABS', filePath: '/a.md' });
      expect(next.contentTabs.length).toBe(1);
      expect(next.activeContentTabPath).toBe('/a.md');
    });

    test('single tab returns unchanged', () => {
      const tabA = makeTab('/a.md');
      const state = makeState({ contentTabs: [tabA] });
      const next = reducer(state, { type: 'CLOSE_OTHER_CONTENT_TABS', filePath: '/a.md' });
      expect(next).toEqual(state);
    });

    test('tab not found returns unchanged', () => {
      const tabA = makeTab('/a.md');
      const state = makeState({ contentTabs: [tabA] });
      const next = reducer(state, { type: 'CLOSE_OTHER_CONTENT_TABS', filePath: '/z.md' });
      expect(next).toEqual(state);
    });
  });

  describe('CLOSE_ALL_CONTENT_TABS', () => {
    test('with tabs clears all', () => {
      const state = makeState({ contentTabs: [makeTab('/a.md')], activeContentTabPath: '/a.md' });
      const next = reducer(state, { type: 'CLOSE_ALL_CONTENT_TABS' });
      expect(next.contentTabs).toEqual([]);
      expect(next.currentFile).toBeNull();
    });

    test('empty tabs returns unchanged', () => {
      const state = makeState({ contentTabs: [] });
      const next = reducer(state, { type: 'CLOSE_ALL_CONTENT_TABS' });
      expect(next).toEqual(state);
    });
  });

  test('WORKSPACE_UNAVAILABLE resets state', () => {
    const state = makeState({ currentFile: '/a.md', contentHtml: 'x', focusMode: true, fileList: sampleFileList });
    const next = reducer(state, {
      type: 'WORKSPACE_UNAVAILABLE',
      workspacePath: '/gone',
      workspaceName: 'Gone',
      reason: 'notFound',
    });
    expect(next.currentFile).toBeNull();
    expect(next.workspaceUnavailablePath).toBe('/gone');
    expect(next.workspaceUnavailableReason).toBe('notFound');
    expect(next.contentTabs).toEqual([]);
    expect(next.focusMode).toBe(false);
  });

  test('WORKSPACE_UNAVAILABLE preserves optional fields', () => {
    const state = makeState({ appVersion: '1.0', appRuntime: 'desktop', hostPlatform: 'windows', recentWorkspaces: [{ name: 'x', path: '/x', lastOpened: 1 }] });
    const next = reducer(state, {
      type: 'WORKSPACE_UNAVAILABLE',
      workspacePath: '/gone',
      workspaceName: 'Gone',
      reason: 'notFound',
      appRuntime: 'vscode',
      appVersion: '2.0',
      hostPlatform: 'mac',
    });
    expect(next.appRuntime).toBe('vscode');
    expect(next.appVersion).toBe('2.0');
    expect(next.hostPlatform).toBe('mac');
  });

  test('SET_LOADING with label and detail', () => {
    const state = makeState();
    const next = reducer(state, { type: 'SET_LOADING', label: 'Opening...', detail: 'file.md' });
    expect(next.isLoading).toBe(true);
    expect(next.loadingLabel).toBe('Opening...');
    expect(next.loadingDetail).toBe('file.md');
  });

  test('SET_LOADING without label defaults', () => {
    const state = makeState();
    const next = reducer(state, { type: 'SET_LOADING' });
    expect(next.loadingLabel).toBe('Loading docs...');
    expect(next.loadingDetail).toBe('');
  });

  test('SET_UPDATE_STATE merges with empty', () => {
    const state = makeState();
    const next = reducer(state, { type: 'SET_UPDATE_STATE', updateState: { status: 'downloading', progressPercent: 50 } } as any);
    expect(next.updateState.status).toBe('downloading');
    expect(next.updateState.progressPercent).toBe(50);
    expect(next.updateState.version).toBe('');
  });

  test('TOGGLE_SIDEBAR', () => {
    const state = makeState({ sidebarCollapsed: false });
    expect(reducer(state, { type: 'TOGGLE_SIDEBAR' }).sidebarCollapsed).toBe(true);
    expect(reducer(makeState({ sidebarCollapsed: true }), { type: 'TOGGLE_SIDEBAR' }).sidebarCollapsed).toBe(false);
  });

  describe('TOGGLE_TOC', () => {
    test('with writeTocStorage callback', () => {
      const writeFn = vi.fn();
      const state = makeState({ tocCollapsed: false });
      const next = reducer(state, { type: 'TOGGLE_TOC' }, writeFn);
      expect(next.tocCollapsed).toBe(true);
      expect(writeFn).toHaveBeenCalledWith('markdown-explorer-toc-collapsed', 'true');
    });

    test('without writeTocStorage', () => {
      const state = makeState({ tocCollapsed: true });
      const next = reducer(state, { type: 'TOGGLE_TOC' });
      expect(next.tocCollapsed).toBe(false);
    });
  });

  test('SET_THEME', () => {
    const state = makeState();
    const next = reducer(state, { type: 'SET_THEME', theme: 'dark' });
    expect(next.theme).toBe('dark');
    expect(next.hasThemePreference).toBe(true);
  });

  test('SET_THEME_STYLE', () => {
    const state = makeState({ settings: { ...initialState.settings, activeCustomThemeId: 'x' } });
    const next = reducer(state, { type: 'SET_THEME_STYLE', themeStyle: 'glass' });
    expect(next.themeStyle).toBe('glass');
    expect(next.hasThemeStylePreference).toBe(true);
    expect(next.settings.activeCustomThemeId).toBeUndefined();
  });

  describe('SELECT_CUSTOM_THEME', () => {
    test('with valid themeId', () => {
      const theme = { id: 't1', baseStyle: 'glass' as const, colorMode: 'light' as const, name: 'T', createdAt: 0, updatedAt: 0 };
      const state = makeState({ settings: { ...initialState.settings, customThemes: [theme] as any, themeStyle: 'default' } });
      const next = reducer(state, { type: 'SELECT_CUSTOM_THEME', themeId: 't1' });
      expect(next.themeStyle).toBe('glass');
      expect(next.hasThemeStylePreference).toBe(true);
      expect(next.settings.activeCustomThemeId).toBe('t1');
    });

    test('with undefined clears active theme', () => {
      const state = makeState({ settings: { ...initialState.settings, activeCustomThemeId: 'old' } });
      const next = reducer(state, { type: 'SELECT_CUSTOM_THEME', themeId: undefined });
      expect(next.settings.activeCustomThemeId).toBeUndefined();
      expect(next.hasThemeStylePreference).toBe(false);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    test('fileTabs false clears tabs', () => {
      const state = makeState({ contentTabs: [makeTab('/a.md')], activeContentTabPath: '/a.md', settings: { ...initialState.settings, fileTabs: true } });
      const next = reducer(state, { type: 'UPDATE_SETTINGS', settings: { fileTabs: false } });
      expect(next.contentTabs).toEqual([]);
      expect(next.activeContentTabPath).toBeNull();
    });

    test('fileTabs true from false creates tab from state', () => {
      const state = makeState({
        currentFile: '/docs/a.md',
        contentHtml: '<p>x</p>',
        markdownSource: null,
        frontmatter: {},
        toc: [],
        relativePath: 'a.md',
        settings: { ...initialState.settings, fileTabs: false },
      });
      const next = reducer(state, { type: 'UPDATE_SETTINGS', settings: { fileTabs: true } });
      expect(next.contentTabs.length).toBe(1);
      expect(next.activeContentTabPath).toBe('/docs/a.md');
    });

    test('fileTabs true when already true just updates setting', () => {
      const state = makeState({ settings: { ...initialState.settings, fileTabs: true } });
      const next = reducer(state, { type: 'UPDATE_SETTINGS', settings: { fileTabs: true } });
      expect(next).not.toBe(state);
      expect(next.settings.fileTabs).toBe(true);
    });

    test('fileTabs creation uses the newly selected CSV preview mode', () => {
      const state = makeState({
        currentFile: '/docs/downloads.md',
        contentHtml: '<p>stale preview</p>',
        markdownSource: '```csv\nname,count\nDesktop,10\n```',
        frontmatter: {},
        toc: [],
        relativePath: 'downloads.md',
        settings: { ...initialState.settings, fileTabs: false, defaultCsvPreview: true },
      });

      const next = reducer(state, {
        type: 'UPDATE_SETTINGS',
        settings: { fileTabs: true, defaultCsvPreview: false },
      });

      expect(next.contentHtml).toContain('mdn-csv-preview-wrap');
      expect(next.contentHtml).toContain('data-mode="code"');
      expect(next.contentTabs).toHaveLength(1);
      expect(next.contentTabs[0].contentHtml).toContain('data-mode="code"');
    });

    test('customThemes normalization', () => {
      const state = makeState();
      const customThemes = [{ id: 'a', name: 'A', baseStyle: 'default' as const, colorMode: 'auto' as const, createdAt: 0, updatedAt: 0 }];
      const next = reducer(state, { type: 'UPDATE_SETTINGS', settings: { customThemes: customThemes as any } });
      expect(next.settings.customThemes.length).toBe(1);
    });

    test('activeCustomThemeId resolution', () => {
      const theme = { id: 't1', name: 'T', baseStyle: 'glass' as const, colorMode: 'light' as const, createdAt: 0, updatedAt: 0 };
      const state = makeState({ settings: { ...initialState.settings, customThemes: [theme] as any } });
      const next = reducer(state, { type: 'UPDATE_SETTINGS', settings: { activeCustomThemeId: 't1' } });
      expect(next.settings.activeCustomThemeId).toBe('t1');
      expect(next.themeStyle).toBe('glass');
    });
  });

  test('SET_MAXIMIZED', () => {
    const state = makeState({ isMaximized: false });
    expect(reducer(state, { type: 'SET_MAXIMIZED', isMaximized: true }).isMaximized).toBe(true);
  });

  test('TOGGLE_FOCUS_MODE', () => {
    const state = makeState({ focusMode: false });
    expect(reducer(state, { type: 'TOGGLE_FOCUS_MODE' }).focusMode).toBe(true);
    expect(reducer(makeState({ focusMode: true }), { type: 'TOGGLE_FOCUS_MODE' }).focusMode).toBe(false);
  });

  test('SET_SIDEBAR_ACTIVE_TAB', () => {
    const state = makeState({ sidebarActiveTab: 'files' });
    expect(reducer(state, { type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'search' }).sidebarActiveTab).toBe('search');
  });

  test('SET_SIDEBAR_COLLAPSED', () => {
    const state = makeState({ sidebarCollapsed: false });
    expect(reducer(state, { type: 'SET_SIDEBAR_COLLAPSED', collapsed: true }).sidebarCollapsed).toBe(true);
  });

  describe('WORKSPACE_FILES_CHANGED', () => {
    test('updates fileList and tree', () => {
      const state = makeState({ isLoading: false });
      const newFileList: MdFile[] = [
        { fsPath: 'C:/docs/new.md', relativePath: 'new.md', fileName: 'new.md', title: 'New' },
      ];
      const newTree: FolderNode = { name: 'docs', path: 'docs', files: newFileList, children: [] };
      const result = reducer(state, {
        type: 'WORKSPACE_FILES_CHANGED',
        fileList: newFileList,
        tree: newTree,
        workspaceName: 'docs',
        workspacePath: 'C:/docs',
      });
      expect(result.fileList).toEqual(newFileList);
      expect(result.tree).toEqual(newTree);
    });

    test('preserves active scan state for incremental snapshots', () => {
      const state = makeState({ isWorkspaceScanning: true });
      const result = reducer(state, {
        type: 'WORKSPACE_FILES_CHANGED',
        fileList: [],
        tree: null,
        workspaceName: 'docs',
        workspacePath: 'C:/docs',
      });
      expect(result.isWorkspaceScanning).toBe(true);
    });

    test('reconciles scope focus with new file list', () => {
      const state = makeState({
        settings: {
          ...initialState.settings,
          scopeFocus: { default: ['removed-file.md'] },
        },
      });
      const result = reducer(state, {
        type: 'WORKSPACE_FILES_CHANGED',
        fileList: [{ fsPath: 'C:/kept.md', relativePath: 'kept.md', fileName: 'kept.md', title: 'Kept' }],
        tree: null,
        workspaceName: 'ws',
        workspacePath: 'C:/ws',
      });
      expect(result.settings.scopeFocus).toBeDefined();
    });
  });

  test('unknown action returns unchanged state', () => {
    const state = makeState();
    expect(reducer(state, { type: 'UNKNOWN_ACTION' } as any)).toEqual(state);
  });
});
