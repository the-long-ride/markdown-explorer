import assert from 'node:assert/strict';
import test from 'node:test';

const modelUrl = new URL('../../ui/src/bookmarks/bookmarkModel.ts', import.meta.url);
const storeUrl = new URL('../../ui/src/bookmarks/bookmarkStore.ts', import.meta.url);

const baseDraft = {
  name: 'Install section',
  workspaceKey: '/work/a',
  workspaceName: 'A',
  workspacePath: '/work/a',
  filePath: '/work/a/readme.md',
  selectedText: 'Install now',
  matchOrdinal: 1,
  matchIndex: 17,
  prefix: 'Before ',
  suffix: ' after',
};

test('captures selection ordinal, index, and nearby context', async () => {
  const { captureBookmarkSelection } = await import(modelUrl);
  const text = 'Install now. Before Install now after.';
  assert.deepEqual(captureBookmarkSelection(text, 'Install now', 20), {
    selectedText: 'Install now',
    matchOrdinal: 1,
    matchIndex: 20,
    prefix: 'Install now. Before ',
    suffix: ' after.',
  });
});

test('resolves exact and context-preserved targets without choosing unrelated text', async () => {
  const { resolveBookmarkTarget } = await import(modelUrl);
  const bookmark = { ...baseDraft, matchIndex: 20, prefix: 'Install now. Before ', suffix: ' after.' };
  assert.deepEqual(resolveBookmarkTarget(bookmark, 'Install now. Before Install now after.'), {
    status: 'resolved', sourceStart: 20, sourceEnd: 31, occurrence: 1, kind: 'text',
  });
  assert.deepEqual(resolveBookmarkTarget(bookmark, 'Install now appears elsewhere only.'), { status: 'targetChanged' });
});

test('filters by name or selected text and sorts deterministically', async () => {
  const { filterAndSortBookmarks } = await import(modelUrl);
  const items = [
    { ...baseDraft, id: 'b', name: 'Zulu', selectedText: 'needle', createdAt: 20, updatedAt: 20 },
    { ...baseDraft, id: 'a', name: 'Alpha', selectedText: 'other', createdAt: 10, updatedAt: 10 },
  ];
  assert.deepEqual(filterAndSortBookmarks(items, 'needle', 'name-asc').map((item) => item.id), ['b']);
  assert.deepEqual(filterAndSortBookmarks(items, '', 'name-asc').map((item) => item.id), ['a', 'b']);
  assert.deepEqual(filterAndSortBookmarks(items, '', 'created-desc').map((item) => item.id), ['b', 'a']);
});

test('groups only bookmarks belonging to open workspaces and marks the active group', async () => {
  const { groupBookmarksByOpenWorkspace } = await import(modelUrl);
  const items = [
    { ...baseDraft, id: 'a', createdAt: 1, updatedAt: 1 },
    { ...baseDraft, id: 'b', workspaceKey: '/closed', workspacePath: '/closed', createdAt: 2, updatedAt: 2 },
  ];
  const groups = groupBookmarksByOpenWorkspace(items, [
    { id: 'tab-a', workspaceKey: '/work/a', workspaceName: 'A', workspacePath: '/work/a' },
    { id: 'tab-empty', workspaceKey: '/work/empty', workspaceName: 'Empty', workspacePath: '/work/empty' },
  ], '/work/a');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].active, true);
  assert.deepEqual(groups[0].bookmarks.map((item) => item.id), ['a']);
  assert.deepEqual(groups[1].bookmarks, []);
});

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('bookmark store persists add, rename, delete, and reload', async () => {
  const { createBookmarkStore } = await import(storeUrl);
  const storage = new MemoryStorage();
  const first = createBookmarkStore(storage);
  first.add({ ...baseDraft, id: 'one', createdAt: 100, updatedAt: 100 });
  first.rename('one', '  Renamed  ', 200);
  assert.equal(first.getSnapshot().items[0].name, 'Renamed');

  const second = createBookmarkStore(storage);
  assert.equal(second.getSnapshot().items[0].updatedAt, 200);
  second.remove('one');
  assert.deepEqual(createBookmarkStore(storage).getSnapshot().items, []);
});

test('bookmark store falls back safely for corrupt or unknown documents', async () => {
  const { BOOKMARKS_STORAGE_KEY, createBookmarkStore } = await import(storeUrl);
  const storage = new MemoryStorage();
  storage.setItem(BOOKMARKS_STORAGE_KEY, '{bad json');
  assert.deepEqual(createBookmarkStore(storage).getSnapshot(), { version: 2, items: [] });
  storage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify({ version: 99, items: [baseDraft] }));
  assert.deepEqual(createBookmarkStore(storage).getSnapshot(), { version: 2, items: [] });
});

test('bookmark setting persists, imports, renders, and has all language records', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const [types, model, effects, importExport, panel, translationTypes, inline, data] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/settings/settingsImportExport.ts'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/contexts/translationTypes.ts'),
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  assert.match(types, /bookmarksEnabled:\s*boolean/);
  assert.match(model, /bookmarksEnabled:\s*false/);
  assert.match(effects, /bookmarksEnabled:\s*state\.settings\.bookmarksEnabled/);
  assert.match(importExport, /bookmarksEnabled:\s*raw\.bookmarksEnabled === true/);
  assert.match(panel, /updateSettings\(\{ bookmarksEnabled: event\.target\.checked \}\)/);
  assert.match(translationTypes, /bookmarks:\s*\{/);
  assert.match(inline, /bookmarksEnabledDesc/);
  assert.equal((data.match(/bookmarks:\s*\{/g) || []).length, 9);
});

test('bookmark sidebar exposes conditional tab, grouped panel, dialogs, menus, and supplied icons', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const paths = [
    'ui/src/components/Sidebar/Sidebar.tsx',
    'ui/src/components/Sidebar/SidebarTabsHeader.tsx',
    'ui/src/components/Bookmarks/BookmarksPanel.tsx',
    'ui/src/components/Bookmarks/BookmarkDialog.tsx',
    'ui/src/components/Bookmarks/BookmarkIcons.tsx',
    'ui/src/contexts/appStateModel.ts',
  ];
  const [sidebar, tabsHeader, panel, dialog, icons, model] = await Promise.all(paths.map(read));
  const sidebarSurface = `${sidebar}\n${tabsHeader}`;
  assert.match(sidebarSurface, /bookmarksEnabled/);
  assert.match(tabsHeader, /onSelect\('bookmarks'\)/);
  assert.match(sidebar, /<BookmarksPanel/);
  assert.match(panel, /groupBookmarksByOpenWorkspace/);
  assert.match(panel, /onDoubleClick/);
  assert.match(panel, /onContextMenu/);
  assert.match(panel, /renameBookmarkWithVerification/);
  assert.match(panel, /bookmarkStore\.remove/);
  assert.match(panel, /sortNameAsc/);
  assert.match(panel, /collapseAll/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /autoFocus/);
  assert.match(icons, /viewBox="0 0 367 511\.499"/);
  assert.match(icons, /viewBox="0 0 91\.5 122\.88"/);
  assert.match(model, /'files' \| 'search' \| 'bookmarks'/);
});

test('creates a complete bookmark record from a selected document occurrence', async () => {
  const { createBookmarkRecord } = await import(modelUrl);
  const record = createBookmarkRecord({
    id: 'fixed',
    name: '  Setup  ',
    workspaceName: 'Docs',
    workspacePath: '/docs',
    filePath: '/docs/readme.md',
    documentText: 'First setup. Second setup.',
    selectedText: 'setup',
    selectedStart: 20,
    now: 123,
  });
  assert.equal(record.name, 'Setup');
  assert.equal(record.workspaceKey, '/docs');
  assert.equal(record.matchOrdinal, 1);
  assert.equal(record.matchIndex, 20);
  assert.equal(record.createdAt, 123);
});

test('content selection and app navigation wire bookmark creation to search-jump highlighting', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const [content, selectionHook, selectionMenu, app, bookmarkNavigation, appView, searchEffects] = await Promise.all([
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/useBookmarkSelection.ts'),
    read('ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx'),
    read('ui/src/App.tsx'),
    read('ui/src/hooks/useBookmarkNavigation.ts'),
    read('ui/src/AppView.tsx'),
    read('ui/src/useAppSearchEffects.ts'),
  ]);
  assert.match(content, /onBookmarkContextMenu: handleBookmarkContextMenu/);
  assert.match(selectionHook, /captureDomBookmarkTarget/);
  assert.match(content, /<BookmarkSelectionMenu/);
  assert.match(selectionMenu, /AddBookmarkIcon/);
  assert.match(selectionMenu, /saveBookmarkCapture/);
  assert.match(selectionMenu, /state\?\.presentation === 'dialog'/);
  assert.match(app, /handleBookmarkNavigate/);
  assert.match(bookmarkNavigation, /resolveBookmarkTarget/);
  assert.match(bookmarkNavigation, /queueBookmarkJump/);
  assert.match(appView, /bookmarkWorkspaces=/);
  assert.match(appView, /onBookmarkNavigate=/);
  assert.match(searchEffects, /failureMessage/);
  assert.match(searchEffects, /markdown-explorer-action-notice/);
});

test('bookmark and user-manual production modules are mapped to their dependency-light contracts', async () => {
  const { coverageManifest } = await import(new URL('../../tests/manifest/coverage-manifest.ts', import.meta.url));
  const expected = {
    'ui/src/bookmarks/bookmarkCommands.ts': ['tests/node/bookmark-save-feedback.test.mjs'],
    'ui/src/bookmarks/bookmarkDefaultName.ts': ['tests/node/bookmark-save-feedback.test.mjs'],
    'ui/src/bookmarks/bookmarkModel.ts': ['tests/node/bookmarks.test.mjs'],
    'ui/src/bookmarks/bookmarkStore.ts': ['tests/node/bookmarks.test.mjs'],
    'ui/src/bookmarks/types.ts': ['tests/node/bookmarks.test.mjs'],
    'ui/src/bookmarks/useBookmarks.ts': ['tests/node/bookmarks.test.mjs'],
    'ui/src/bookmarks/bookmarkDomAnchors.ts': ['tests/node/bookmark-source-metadata.test.mjs'],
    'ui/src/components/Bookmarks/BookmarkDialog.tsx': ['tests/node/bookmarks.test.mjs'],
    'ui/src/components/Bookmarks/BookmarkIcons.tsx': ['tests/node/bookmark-sidebar-ui.test.mjs'],
    'ui/src/components/Bookmarks/BookmarkItemMenu.tsx': ['tests/node/bookmarks.test.mjs'],
    'ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx': ['tests/node/bookmark-interactions.test.mjs'],
    'ui/src/components/Bookmarks/BookmarksPanel.tsx': ['tests/node/bookmark-sidebar-ui.test.mjs'],
    'ui/src/components/Bookmarks/BookmarkBatchDeleteDialog.tsx': ['tests/node/bookmark-sidebar-ui.test.mjs'],
    'ui/src/components/Sidebar/sidebarSearchScope.ts': ['tests/node/sidebar-focus-search-layout.test.mjs'],
    'ui/src/components/Content/useBookmarkSelection.ts': ['tests/node/bookmark-interactions.test.mjs'],
    'ui/src/components/Content/UserManualTab.tsx': ['tests/node/user-manual-home.test.mjs'],
    'ui/src/contexts/userManualTranslations.ts': ['tests/node/user-manual-home.test.mjs'],
    'ui/src/hooks/useBookmarkNavigation.ts': ['tests/node/bookmark-navigation.test.mjs'],
    'ui/src/hooks/useUserManualActions.ts': ['tests/node/user-manual-home.test.mjs'],
    'ui/src/markdown/sourceMapping.ts': ['tests/node/bookmark-source-metadata.test.mjs'],
    'ui/src/utils/actionNotice.ts': ['tests/node/bookmark-save-feedback.test.mjs'],
    'ui/src/utils/bookmarkJump.ts': ['tests/node/bookmark-navigation.test.mjs'],
  };
  for (const [path, suites] of Object.entries(expected)) {
    assert.deepEqual(coverageManifest[path], suites, path);
  }
});

test('bookmark UI stylesheet loads before rules and uses the app theme contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const [globalCss, bookmarkCss, dialog] = await Promise.all([
    read('ui/src/styles/global.css'),
    read('ui/src/styles/global/global-bookmarks.css'),
    read('ui/src/components/Bookmarks/BookmarkDialog.tsx'),
  ]);
  const lines = globalCss.split(/\r?\n/);
  const bookmarkImportLine = lines.findIndex((line) => line.includes('global-bookmarks.css'));
  const firstRuleLine = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('@import') && trimmed.includes('{');
  });
  assert.ok(bookmarkImportLine >= 0, 'bookmark stylesheet must be imported');
  assert.ok(bookmarkImportLine < firstRuleLine, 'all @import rules must precede normal CSS rules');
  assert.doesNotMatch(bookmarkCss, /var\(--tx-(?:m|s)\)/);
  assert.match(bookmarkCss, /var\(--tx2\)/);
  assert.match(bookmarkCss, /var\(--txm\)/);
  assert.match(dialog, /className="btn btn--accent"/);
});

test('bookmark selection menu uses right-click coordinates and standard themed context-menu behavior', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const [selectionHook, selectionMenu] = await Promise.all([
    read('ui/src/components/Content/useBookmarkSelection.ts'),
    read('ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx'),
  ]);
  assert.match(selectionHook, /event\.clientX/);
  assert.match(selectionHook, /event\.clientY/);
  assert.match(selectionMenu, /mdn-link-context-menu bookmark-selection-menu/);
  assert.match(selectionMenu, /window\.innerWidth/);
  assert.match(selectionMenu, /window\.innerHeight/);
  assert.match(selectionMenu, /pointerdown/);
  assert.match(selectionMenu, /event\.key === 'Escape'/);
});
