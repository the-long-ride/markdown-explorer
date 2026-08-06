import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('sidebar pin and sort pure helpers exist with required modes and limits', async () => {
  const [prefs, ordering, types] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarWorkspacePreferences.ts'),
    read('ui/src/components/Sidebar/sidebarTreeOrdering.ts'),
    read('ui/src/types/files.ts'),
  ]);

  assert.match(prefs, /DEFAULT_MAX_PINNED_ITEMS\s*=\s*10/);
  assert.match(prefs, /Math\.min\(15,\s*Math\.max\(1,/);
  assert.match(prefs, /toggleWorkspacePin/);
  assert.match(prefs, /reconcileWorkspacePins/);
  assert.match(ordering, /orderSidebarLevel/);
  for (const mode of ['name-asc', 'name-desc', 'modified-desc', 'modified-asc']) {
    assert.match(types, new RegExp(mode));
  }
});

test('sidebar toolbar exposes clear pins and sort controls', async () => {
  const [toolbar, sidebar, icons, pinsHook] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarFilesActions.tsx'),
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/components/Sidebar/sidebarPinIcons.tsx'),
    read('ui/src/components/Sidebar/useSidebarPinnedSorting.ts'),
  ]);

  assert.match(toolbar, /onClearPins/);
  assert.match(toolbar, /onSortChange/);
  assert.match(toolbar, /ClearPinsIcon/);
  assert.match(toolbar, /SortIcon/);
  assert.match(`${sidebar}\n${pinsHook}`, /sidebarPinnedItems/);
  assert.match(`${sidebar}\n${pinsHook}`, /sidebarSortModes/);
  assert.match(icons, /fill="currentColor"/);
  assert.match(icons, /UnpinIcon/);
});

test('sidebar sort menu revokes active sort back to default when clicked', async () => {
  const sortMenuSource = await read('ui/src/components/Sidebar/SidebarSortMenu.tsx');
  assert.match(sortMenuSource, /onChange\(mode === value \? DEFAULT_SIDEBAR_SORT_MODE : mode\)/);
});

test('sidebar toolbar places buttons in order 3, 2, 1, 4, 5 (sort, clear-pins, locate, collapse, expand)', async () => {
  const toolbarSource = await read('ui/src/components/Sidebar/SidebarFilesActions.tsx');
  const sortIndex = toolbarSource.indexOf('sidebar__files-action--sort');
  const clearPinsIndex = toolbarSource.indexOf('sidebar__files-action--clear-pins');
  const locateIndex = toolbarSource.indexOf('sidebar__files-action--locate');
  const collapseIndex = toolbarSource.indexOf('sidebar__files-action--collapse');
  const expandIndex = toolbarSource.indexOf('sidebar__files-action--expand');

  assert.ok(sortIndex < clearPinsIndex, 'sort should be before clear-pins');
  assert.ok(clearPinsIndex < locateIndex, 'clear-pins should be before locate');
  assert.ok(locateIndex < collapseIndex, 'locate should be before collapse');
  assert.ok(collapseIndex < expandIndex, 'collapse should be before expand');
});

test('sidebar icons and unpin item menu utilize UnpinIcon', async () => {
  const [iconsSource, itemMenuSource] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarPinIcons.tsx'),
    read('ui/src/components/Sidebar/sidebarItemMenuItems.tsx'),
  ]);
  assert.match(iconsSource, /viewBox="0 0 512 512"/);
  assert.match(iconsSource, /var\(--accent, #EF4136\)/);
  assert.match(itemMenuSource, /id:\s*'unpin'[\s\S]*icon:\s*<UnpinIcon \/>/);
});

test('settings persist workspace pins sort modes and maximum pin count', async () => {
  const [themeTypes, effects, importExport, settingsPanel] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/settings/settingsImportExport.ts'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
  ]);
  assert.match(themeTypes, /sidebarPinnedItems/);
  assert.match(themeTypes, /sidebarSortModes/);
  assert.match(themeTypes, /maxPinnedItems/);
  assert.match(effects, /sidebarPinnedItems:\s*state\.settings\.sidebarPinnedItems/);
  assert.match(effects, /sidebarSortModes:\s*state\.settings\.sidebarSortModes/);
  assert.match(importExport, /normalizeSidebarPinnedItems/);
  assert.match(importExport, /normalizeSidebarSortModes/);
  assert.match(settingsPanel, /maxPinnedItems/);
  assert.match(settingsPanel, /min=\{1\}/);
  assert.match(settingsPanel, /max=\{15\}/);
});

test('workspace scanners expose modifiedAt and folder tree builders derive it', async () => {
  const files = await Promise.all([
    read('ui/src/types/files.ts'),
    read('electron/workspace/scanner.js'),
    read('vscode/src/core/scanner.ts'),
    read('vscode/src/types.ts'),
    read('chromium-xtension/src/scanner.ts'),
    read('tauri/src/workspace/scanner.rs'),
    read('tauri/src/workspace/tree_builder.rs'),
  ]);
  for (const source of files) assert.match(source, /modifiedAt|modified_at/);
  assert.match(files[3], /interface MdFile[\s\S]*readonly modifiedAt\?: number;/);
  assert.match(files[3], /interface FolderNode[\s\S]*modifiedAt\?: number;/);
  assert.match(files[1], /Math\.max/);
  assert.match(files[2], /Math\.max/);
  assert.match(files[4], /Math\.max/);
  assert.match(files[6], /max/);
});

test('pure sidebar ordering and pin helpers enforce behavior', async () => {
  const prefs = await import('../../ui/src/components/Sidebar/sidebarWorkspacePreferences.ts');
  const ordering = await import('../../ui/src/components/Sidebar/sidebarTreeOrdering.ts');
  const files = [
    { fsPath: '/z.md', relativePath: 'z.md', parts: ['z.md'], fileName: 'z.md', title: 'Zulu', modifiedAt: 10 },
    { fsPath: '/a.md', relativePath: 'a.md', parts: ['a.md'], fileName: 'a.md', title: 'Alpha', modifiedAt: 30 },
  ];
  const folders = [
    { name: 'Beta', path: 'beta', files: [], children: [], modifiedAt: 20 },
  ];
  const pinnedKeys = new Set(['file:/z.md']);
  assert.deepEqual(
    ordering.orderSidebarLevel(files, folders, { sortMode: 'name-asc', pinnedKeys, showTitle: true }).map(item => item.key),
    ['file:/z.md', 'folder:beta', 'file:/a.md'],
  );
  assert.deepEqual(
    ordering.orderSidebarLevel(files, folders, { sortMode: 'modified-desc', pinnedKeys: new Set(), showTitle: true }).map(item => item.key),
    ['folder:beta', 'file:/a.md', 'file:/z.md'],
  );
  assert.deepEqual(
    ordering.orderSidebarLevel(files, folders, { sortMode: 'name-desc', pinnedKeys: new Set(), showTitle: true }).map(item => item.key),
    ['folder:beta', 'file:/z.md', 'file:/a.md'],
  );
  assert.deepEqual(
    ordering.orderSidebarLevel(files, folders, { sortMode: 'modified-asc', pinnedKeys: new Set(), showTitle: true }).map(item => item.key),
    ['folder:beta', 'file:/z.md', 'file:/a.md'],
  );
  assert.deepEqual(
    ordering.orderSidebarLevel(files, folders, {
      sortMode: 'name-desc',
      pinnedKeys: new Set(['folder:beta', 'file:/a.md']),
      showTitle: true,
    }).map(item => item.key),
    ['folder:beta', 'file:/a.md', 'file:/z.md'],
  );
  let map = {};
  for (let index = 0; index < 10; index += 1) {
    map = prefs.toggleWorkspacePin(map, 'workspace', { kind: 'file', path: `/${index}.md` }, 10);
  }
  const blocked = prefs.toggleWorkspacePin(map, 'workspace', { kind: 'folder', path: 'extra' }, 10);
  assert.equal(blocked.workspace.length, 10);
  const unpinned = prefs.toggleWorkspacePin(map, 'workspace', { kind: 'file', path: '/0.md' }, 10);
  assert.equal(unpinned.workspace.length, 9);
  assert.deepEqual(
    prefs.reconcileWorkspacePins(
      [{ kind: 'file', path: '/0.md' }, { kind: 'file', path: '/missing.md' }, { kind: 'file', path: '/0.md' }],
      new Set(['file:/0.md']),
      10,
    ),
    [{ kind: 'file', path: '/0.md' }],
  );
  assert.deepEqual(prefs.clearWorkspacePins(map, 'workspace'), {});
  assert.equal(prefs.normalizeMaxPinnedItems(99), 15);
  assert.equal(prefs.normalizeMaxPinnedItems(0), 1);
});
