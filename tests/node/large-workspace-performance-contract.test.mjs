import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DesktopScanner = require('../../electron/workspace/scanner.js');
const { nextIncrementalPublishCount } = require('../../electron/workspace/incremental-publish.js');
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function makeFlat(folderCount) {
  return Array.from({ length: folderCount }, (_, index) => {
    const folder = `folder-${String(index).padStart(6, '0')}`;
    const fileName = 'readme.md';
    return {
      fsPath: `/workspace/${folder}/${fileName}`,
      relativePath: `${folder}/${fileName}`,
      parts: [folder, fileName],
      fileName,
      title: folder,
      extension: '.md',
      documentKind: 'markdown',
    };
  });
}

test('tree builders use indexed child lookup while preserving the public tree shape', async () => {
  const [desktop, runtime, vscode, chromium, tauri] = await Promise.all([
    read('electron/workspace/scanner.js'),
    read('electron/core/runtime-workspace-search.js'),
    read('vscode/src/core/scanner.ts'),
    read('chromium-xtension/src/scanner.ts'),
    read('tauri/src/workspace/tree_builder.rs'),
  ]);

  assert.doesNotMatch(desktop.match(/static buildTree\(flat\) \{([\s\S]*?)\n  \}/)?.[1] ?? '', /children\.find/);
  assert.doesNotMatch(runtime.match(/function buildWorkspaceTree\(flat\) \{([\s\S]*?)\n  \}/)?.[1] ?? '', /children\.find/);
  assert.doesNotMatch(vscode.match(/static buildTree\(flat: MdFile\[\]\): FolderNode \{([\s\S]*?)\n  \}/)?.[1] ?? '', /children\.find/);
  assert.doesNotMatch(chromium.match(/static buildTree\(flat: MdFile\[\]\): FolderNode \{([\s\S]*?)\n  \}/)?.[1] ?? '', /children\.find/);
  assert.doesNotMatch(tauri.match(/fn insert_file[\s\S]*?\n\}/)?.[0] ?? '', /\.position\(/);

  const tree = DesktopScanner.buildTree(makeFlat(3));
  assert.deepEqual(tree.children.map((child) => child.name), [
    'folder-000000',
    'folder-000001',
    'folder-000002',
  ]);
  assert.equal(tree.children[1].files[0].title, 'folder-000001');
});

test('desktop scanner consumes its breadth-first queue without Array.shift', async () => {
  const source = await read('electron/workspace/scanner.js');
  assert.doesNotMatch(source, /dirQueue\.shift\(\)/);
  assert.match(source, /let dirQueueIndex = 0;/);
});

test('incremental scan publishing grows from 32 files up to 1024-file batches', async () => {
  const [helper, electron, vscode, chromium, website, tauri] = await Promise.all([
    read('electron/workspace/incremental-publish.js'),
    read('electron/core/runtime-workspace-handlers.js'),
    read('vscode/src/core/incrementalScan.ts'),
    read('chromium-xtension/src/incremental-workspace-scan.ts'),
    read('website-app/src/web-file-mode.ts'),
    read('tauri/src/dispatcher/incremental_scan.rs'),
  ]);

  assert.match(helper, /function nextIncrementalPublishCount/);
  assert.deepEqual(
    [0, 32, 64, 128, 256, 512, 1024, 2048].map((count) => nextIncrementalPublishCount(count)),
    [32, 64, 128, 256, 512, 1024, 2048, 3072],
  );
  for (const source of [electron, vscode, chromium, website]) {
    assert.match(source, /nextIncrementalPublishCount\(lastPublishedCount/);
    assert.doesNotMatch(source, /scannedFiles % WORKSPACE_SCAN_BATCH_SIZE === 0/);
  }
  assert.match(tauri, /next_incremental_publish_count/);
  assert.doesNotMatch(tauri, /scanned_files % WORKSPACE_SCAN_BATCH_SIZE == 0/);
});

test('sidebar search always omits file payloads while overlay scopes stay optional', async () => {
  const [component, overlay, messageTypes] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarSearch.tsx'),
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/types/webviewMessages.ts'),
  ]);

  assert.doesNotMatch(component, /searchScopeFocus/);
  assert.doesNotMatch(component, /scopedSearchItems/);
  assert.doesNotMatch(component, /items:/);
  assert.doesNotMatch(overlay, /items: state\.fileList\.map\(toWorkspaceSearchResult\)/);
  assert.match(messageTypes, /WorkspaceSearchMessage[^\r\n]*items\?: readonly WorkspaceSearchResult\[\]/);
});

test('normal sidebar browsing avoids recursive descendant path collection', async () => {
  const [sidebar, treeNode, filtering] = await Promise.all([
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/components/Sidebar/TreeNode.tsx'),
    read('ui/src/components/Sidebar/sidebarTreeFiltering.ts'),
  ]);

  assert.match(sidebar, /const activeFolderPaths = useMemo/);
  assert.match(treeNode, /activeFolderPaths\?: ReadonlySet<string>/);
  assert.match(treeNode, /locateRequest\?: number/);
  assert.doesNotMatch(treeNode, /window\.addEventListener\('locate-active-file'/);
  assert.match(filtering, /if \(!filter\.trim\(\) && !hideUnselected\) return true;/);
  assert.doesNotMatch(treeNode, /const descendantFilePaths = getFolderFilePaths\(node\);/);
  assert.match(treeNode, /scopeFocus\.editing\s*\? getFolderSelectionState/);
  assert.match(treeNode, /onChange=\{\(checked\) => scopeFocus\.onFolderChange\(getFolderFilePaths\(node\), checked\)\}/);
});

test('search hosts distinguish omitted all-file payloads from explicit empty scopes', async () => {
  const [electron, vscode, chromium, website, resolver] = await Promise.all([
    read('electron/core/runtime-command-search-handlers.js'),
    read('vscode/src/core/panelSearch.ts'),
    read('chromium-xtension/src/chrome-host-search.ts'),
    read('website-app/src/web-file-utility-router.ts'),
    read('chromium-xtension/src/workspace-search-items.ts'),
  ]);

  assert.match(electron, /Array\.isArray\(msg\.items\) \? msg\.items : state\.flatList/);
  assert.match(vscode, /Array\.isArray\(rawItems\) \? rawItems : flat/);
  assert.match(chromium, /resolveWorkspaceSearchItems\(message\.items, context\.flatList\)/);
  assert.match(website, /resolveWorkspaceSearchItems\(msg\.items, flatList\)/);
  assert.match(resolver, /if \(!Array\.isArray\(items\)\) return flatList;/);
  assert.match(resolver, /return flatList\.filter/);
});

test('search result derivation scales with matches instead of the whole workspace', async () => {
  const [sidebarSearch, resultTree, overlayModel] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarSearch.tsx'),
    read('ui/src/components/Sidebar/sidebarSearchResultTree.ts'),
    read('ui/src/components/Search/searchOverlayModel.tsx'),
  ]);

  assert.match(sidebarSearch, /buildSearchResultTree\(fileMap\)/);
  assert.doesNotMatch(sidebarSearch, /buildSearchResultTree\(state\.tree, fileMap\)/);
  assert.match(resultTree, /for \(const \[fsPath, matches\] of sortedFiles\)/);
  assert.doesNotMatch(resultTree, /node\.children\.flatMap/);
  assert.match(overlayModel, /const scoreBuckets/);
  assert.doesNotMatch(
    overlayModel.match(/export function buildCurrentTabResults[\s\S]*?\n\}/)?.[0] ?? '',
    /\.sort\(/,
  );
});

test('closed or unfiltered folders reuse resident arrays instead of filtering every render', async () => {
  const [treeNode, sidebarScope, sidebarSearch] = await Promise.all([
    read('ui/src/components/Sidebar/TreeNode.tsx'),
    read('ui/src/components/Sidebar/useSidebarScopeFocus.ts'),
    read('ui/src/components/Sidebar/SidebarSearch.tsx'),
  ]);

  assert.match(treeNode, /const hasVisibilityFilter = Boolean\(q\) \|\| scopeFocus\.hideUnselected;/);
  assert.match(treeNode, /const visibleFiles = !isOpen/);
  assert.match(treeNode, /: node\.files;/);
  assert.match(treeNode, /: node\.children;/);
  assert.match(sidebarScope, /if \(!hasScopeEntry\) return allFilePathSet;/);
  assert.doesNotMatch(sidebarSearch, /selectedSearchFilePaths/);
  assert.doesNotMatch(sidebarSearch, /state\.fileList/);
});
