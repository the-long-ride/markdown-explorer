import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('bookmark sidebar exposes count, wider layout, and two-row controls', async () => {
  const [header, panel, styles, tabsStyles, sidebar] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarTabsHeader.tsx'),
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
    read('ui/src/styles/global/global-bookmarks.css'),
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
    read('ui/src/components/Sidebar/Sidebar.tsx'),
  ]);
  assert.match(header, /bookmarkCount/);
  assert.match(header, /isBookmarks[\s\S]*sidebar__count/);
  assert.match(panel, /bookmarks-panel__search-row/);
  assert.match(panel, /bookmarks-panel__action-row/);
  assert.match(sidebar, /has-bookmarks-feature/);
  assert.match(styles, /sidebar\.has-bookmarks-feature/);
  assert.match(styles, /min-width:\s*300px/);
  assert.doesNotMatch(styles, /grid-template-columns/);
  assert.match(tabsStyles, /\.sidebar__tab-btn\s*\{[\s\S]*?flex:\s*0 0 auto/);
  assert.match(header, /offsetLeft/);
  assert.match(header, /offsetWidth/);
});

test('bookmark panel supports selection mode, select all, and atomic batch delete', async () => {
  const [panel, filesActions, filesStyles] = await Promise.all([
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
    read('ui/src/components/Sidebar/SidebarFilesActions.tsx'),
    read('ui/src/styles/global/global-sidebar-files-actions.css'),
  ]);
  assert.match(panel, /selectionMode/);
  assert.match(panel, /selectedIds/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /bookmarkStore\.removeMany/);
  assert.match(panel, /translations\.selectAll/);
  assert.match(panel, /translations\.toggleSelection/);
  assert.match(panel, /translations\.deleteSelected/);
  assert.match(panel, /selectAllBookmarks/);
  assert.match(panel, /disabled=\{visibleBookmarks\.length === 0\}/);
  assert.match(panel, /disabled=\{selectedIds\.size === 0\}/);

  // Assert Select all and delete selected are enclosed within selectionMode check
  assert.match(panel, /\{selectionMode && \(\s*<>\s*<TooltipButton[^>]*selectAll[\s\S]*<TooltipButton[^>]*deleteSelected/);

  // Assert button order: selectAll -> deleteSelected -> toggleSelection -> sort -> collapseAll -> expandAll
  const selectAllPos = panel.indexOf('translations.selectAll');
  const deleteSelectedPos = panel.indexOf('translations.deleteSelected');
  const toggleSelectionPos = panel.indexOf('translations.toggleSelection');
  const sortPos = panel.indexOf('translations.sortLabel');
  const collapseAllPos = panel.indexOf('translations.collapseAll');
  const expandAllPos = panel.indexOf('translations.expandAll');

  assert.ok(selectAllPos < deleteSelectedPos, 'Select all comes before delete selected');
  assert.ok(deleteSelectedPos < toggleSelectionPos, 'delete selected comes before Toggle selection');
  assert.ok(toggleSelectionPos < sortPos, 'Toggle selection comes before sort');
  assert.ok(sortPos < collapseAllPos, 'sort comes before collapse all');
  assert.ok(collapseAllPos < expandAllPos, 'collapse all comes before expand all');

  // Assert Files tab actions have identical button styles and sort status
  assert.match(filesActions, /btn btn--icon sidebar__files-action/);
  assert.match(filesActions, /sidebar__sort-status/);
  assert.match(filesStyles, /sidebar__sort-status/);
  assert.match(filesStyles, /width:\s*26px/);
});

test('bookmark and edit icons use supplied currentColor SVG paths and groups reuse chevrons', async () => {
  const [icons, menu, panel] = await Promise.all([
    read('ui/src/components/Bookmarks/BookmarkIcons.tsx'),
    read('ui/src/components/Bookmarks/BookmarkItemMenu.tsx'),
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
  ]);
  assert.match(icons, /viewBox="0 0 367 511\.499"/);
  assert.match(icons, /M52\.353 0h249\.874/);
  assert.match(icons, /export function EditBookmarkIcon/);
  assert.match(icons, /export function SelectAllIcon/);
  assert.match(menu, /EditBookmarkIcon/);
  assert.match(panel, /SelectAllIcon/);
  assert.match(panel, /BookmarkGroupChevron/);
  assert.doesNotMatch(panel, /'▾'|'▸'/);
});
test('sidebar supports directional tab body movement animations based on target tab index', async () => {
  const [sidebar, css] = await Promise.all([
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
  ]);
  assert.match(sidebar, /slideDirection/);
  assert.match(sidebar, /is-\$\{slideDirection\}/);
  assert.match(css, /sidebar-panel-enter-from-right/);
  assert.match(css, /sidebar-panel-enter-from-left/);
  assert.match(css, /\.sidebar__tab-panel\.is-active\.is-from-right/);
  assert.match(css, /\.sidebar__tab-panel\.is-active\.is-from-left/);
});

test('minimized sort status renders SVG icon only without text labels', async () => {
  const [pinIcons, filesActions, panel, styles] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarPinIcons.tsx'),
    read('ui/src/components/Sidebar/SidebarFilesActions.tsx'),
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
    read('ui/src/styles/global/global-sidebar-files-actions.css'),
  ]);
  assert.match(pinIcons, /export function SortNameAscIcon/);
  assert.match(pinIcons, /export function SortNameDescIcon/);
  assert.match(pinIcons, /export function SortClockIcon/);
  assert.match(pinIcons, /export function SortArrowUpIcon/);
  assert.match(pinIcons, /export function SortArrowDownIcon/);
  assert.match(pinIcons, /export function SortStatusIcon/);

  // Assert FilesActions and BookmarksPanel render SortStatusIcon inside sidebar__sort-status without label text
  assert.match(filesActions, /<SortStatusIcon mode=\{sortMode\} size=\{14\} \/>/);
  assert.doesNotMatch(filesActions, /sidebar__sort-status-label/);
  assert.match(panel, /<SortStatusIcon mode=\{sortMode\} size=\{14\} \/>/);
  assert.doesNotMatch(panel, /sidebar__sort-status-label/);
  assert.match(styles, /\.sidebar__sort-status\s*\{[\s\S]*?justify-content:\s*center/);
});

test('files tab items support right-click context menu and theme border-radius tokens', async () => {
  const [treeNode, treeCss, bookmarkCss] = await Promise.all([
    read('ui/src/components/Sidebar/TreeNode.tsx'),
    read('ui/src/styles/global/global-sidebar-tree-layout.css'),
    read('ui/src/styles/global/global-bookmarks.css'),
  ]);
  assert.match(treeNode, /onContextMenu=\{/);
  assert.match(treeNode, /onRequestItemMenu/);
  assert.match(treeCss, /border-radius:\s*var\(--r-s,\s*var\(--r\)\);/);
  assert.match(bookmarkCss, /border-radius:\s*var\(--r-s,\s*var\(--r\)\);/);
});

test('topbar document header actions use section collapse/expand tooltips', async () => {
  const [headerGroup, translations] = await Promise.all([
    read('ui/src/components/shared/HeaderActionGroups.tsx'),
    read('ui/src/contexts/translations.ts'),
  ]);
  assert.match(headerGroup, /tooltip=\{t\.topbar\.collapseAll\}/);
  assert.match(headerGroup, /tooltip=\{t\.topbar\.expandAll\}/);
  assert.match(translations, /collapseAll:\s*"Collapse all sections"/);
  assert.match(translations, /expandAll:\s*"Expand all sections"/);
});

