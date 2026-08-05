import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const scopeUrl = new URL('../../ui/src/components/Sidebar/sidebarSearchScope.ts', import.meta.url);

test('workspace search filters unfocused files and changes revision when focus changes', async () => {
  const { filterWorkspaceSearchResultsByScope, getScopeSearchRevision } = await import(scopeUrl);
  const results = [
    { fsPath: '/docs/a.md', line: 1, lineText: 'alpha' },
    { fsPath: '/docs/b.md', line: 1, lineText: 'beta' },
  ];
  assert.deepEqual(filterWorkspaceSearchResultsByScope(results, false, new Set(['/docs/a.md'])), results);
  assert.deepEqual(filterWorkspaceSearchResultsByScope(results, true, new Set(['/docs/a.md'])), [results[0]]);
  assert.notEqual(getScopeSearchRevision(new Set(['/docs/a.md'])), getScopeSearchRevision(new Set(['/docs/a.md', '/docs/b.md'])));
});

test('sidebar search reruns for focus changes and the files scope controls occupy row two', async () => {
  const [sidebar, search, treeCss, scopeCss] = await Promise.all([
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/components/Sidebar/SidebarSearch.tsx'),
    read('ui/src/styles/global/global-sidebar-tree-layout.css'),
    read('ui/src/styles/global/global-sidebar-search-controls.css'),
  ]);
  assert.match(sidebar, /selectedFilePaths=\{selectedFilePaths\}/);
  assert.match(sidebar, /hasScopeEntry=\{hasScopeEntry\}/);
  assert.match(sidebar, /sidebar__files-second-row/);
  assert.match(search, /getScopeSearchRevision/);
  assert.match(search, /filterWorkspaceSearchResultsByScope/);
  assert.match(search, /scopeRevision/);
  assert.match(search, /\[bridge, query, matchCase, scopeRevision\]/);
  assert.match(treeCss, /--sidebar-search-height/);
  assert.match(scopeCss, /sidebar__files-second-row/);
});

test('sidebar tabs fit their labels, animate one shared indicator, and bookmark actions are icon tooltips', async () => {
  const [header, panel, icons, tabsCss, bookmarkCss] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarTabsHeader.tsx'),
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
    read('ui/src/components/Bookmarks/BookmarkIcons.tsx'),
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
    read('ui/src/styles/global/global-bookmarks.css'),
  ]);
  assert.match(header, /offsetLeft/);
  assert.match(header, /offsetWidth/);
  assert.match(header, /useLayoutEffect/);
  assert.match(tabsCss, /flex:\s*0 0 auto/);
  assert.match(tabsCss, /\.sidebar__tab-btn\s*\{[\s\S]*?min-width:\s*0/);
  assert.doesNotMatch(bookmarkCss, /grid-template-columns/);
  assert.match(panel, /<TooltipButton/);
  assert.match(panel, /SelectionModeIcon/);
  assert.match(panel, /TrashIcon/);
  assert.match(icons, /viewBox="0 0 122\.47 122\.88"/);
  assert.match(tabsCss, /sidebar-panel-enter/);
});
