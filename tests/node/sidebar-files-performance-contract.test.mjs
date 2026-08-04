import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('sidebar resize moves the shell and handle together while locking tree layout', async () => {
  const [hook, layout, styles] = await Promise.all([
    read('ui/src/hooks/useResize.ts'),
    read('ui/src/useAppLayoutEffects.ts'),
    read('ui/src/styles/global/global-sidebar-tree-layout.css'),
  ]);

  assert.match(hook, /mode\?: 'live' \| 'deferred' \| 'synchronized'/);
  assert.match(hook, /target\.style\.width = `\$\{lastAppliedWidth\}px`/);
  assert.match(hook, /freezeContent\.style\.width = `\$\{startW\}px`/);
  assert.match(hook, /target\.classList\.add\('is-resizing-shell'\)/);
  assert.match(hook, /document\.documentElement\.style\.setProperty\(cssVar, `\$\{lastAppliedWidth\}px`\)/);
  assert.match(layout, /useResize\('sidebarResize',[\s\S]*mode: 'synchronized'[\s\S]*freezeContentId: 'sidebarTree'/);
  assert.doesNotMatch(layout, /useResize\('tocResize',[\s\S]{0,220}mode: 'synchronized'/);
  assert.match(styles, /\.sidebar\.is-resizing-shell\s*\{[\s\S]*?will-change:\s*width/);
  assert.match(styles, /\.sidebar__tree\.is-resize-width-locked/);
  assert.match(styles, /content-visibility:\s*auto/);
});

test('Files tab owns locate, collapse, expand, and scope controls', async () => {
  const [sidebar, actions, expansionHook, tree, styles] = await Promise.all([
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/components/Sidebar/SidebarFilesActions.tsx'),
    read('ui/src/components/Sidebar/useFolderExpansionCommand.ts'),
    read('ui/src/components/Sidebar/TreeNode.tsx'),
    read('ui/src/styles/global/global-sidebar-files-actions.css'),
  ]);

  assert.match(sidebar, /<SidebarFilesActions/);
  assert.match(actions, /className="sidebar__files-actions"/);
  assert.match(actions, /sidebar__files-action--locate/);
  assert.match(actions, /sidebar__files-action--collapse/);
  assert.match(actions, /sidebar__files-action--expand/);
  assert.doesNotMatch(sidebar, /sidebar__locate-btn/);
  assert.match(expansionHook, /FolderExpansionCommand/);
  assert.match(expansionHook, /version: current\.version \+ 1/);
  assert.match(sidebar, /expansionCommand=\{folderExpansionCommand\}/);
  assert.match(tree, /export interface FolderExpansionCommand/);
  assert.match(tree, /expansionCommand\?: FolderExpansionCommand/);
  assert.match(tree, /useState\(\(\) => expansionCommand\?\.expanded \?\? true\)/);
  assert.match(styles, /\.sidebar__files-actions/);
  assert.match(styles, /border-radius:\s*var\(--r\)/);
});

test('sidebar Search always targets the full workspace and renders no scope editor', async () => {
  const search = await read('ui/src/components/Sidebar/SidebarSearch.tsx');

  assert.doesNotMatch(search, /searchScopeFocus/);
  assert.doesNotMatch(search, /scopeFocusEditing/);
  assert.doesNotMatch(search, /searchScopeTree/);
  assert.doesNotMatch(search, /scopedSearchItems/);
  assert.doesNotMatch(search, /items:/);
  assert.doesNotMatch(search, /className="sidebar__scope"/);
  assert.match(search, /command: 'searchWorkspace',[\s\S]*requestId,[\s\S]*query,[\s\S]*matchCase/);
});
