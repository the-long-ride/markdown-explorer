import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

async function readSearchComponents() {
  return (await Promise.all([
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/components/Search/SearchOverlayResults.tsx'),
    read('ui/src/components/Search/SearchOverlayWorkspaceList.tsx'),
    read('ui/src/components/Search/SearchDocumentPreview.tsx'),
  ])).join('\n');
}

test('search overlay remains a bounded modal with three resizable information columns', async () => {
  const [component, css] = await Promise.all([
    readSearchComponents(),
    read('ui/src/styles/global/global-search-overlay.css'),
  ]);
  assert.match(component, /search-overlay-workspaces/);
  assert.match(component, /search-overlay-results-panel/);
  assert.match(component, /search-overlay-preview/);
  assert.match(css, /width:\s*min\(1560px, calc\(100vw - 64px\)\)/);
  assert.match(css, /grid-template-columns:[\s\S]*var\(--search-workspaces-width\)[\s\S]*minmax\(300px, 1fr\)[\s\S]*var\(--search-preview-width\)/);
  assert.equal((await read('ui/src/components/Search/SearchOverlay.tsx')).match(/className="search-overlay-resize-handle/g)?.length, 2);
});

test('result rows select previews while tooltip arrow buttons open documents', async () => {
  const component = await read('ui/src/components/Search/SearchOverlayResults.tsx');
  assert.match(component, /onClick=\{\(\) => onSelect\(key\)\}/);
  assert.match(component, /className="search-result-row__open"/);
  assert.match(component, /event\.stopPropagation\(\);\s*onOpen\(item\);/s);
  assert.match(component, /tooltip=\{t\.openResult\}/);
});

test('all search surfaces expose one Match case toggle and forward matchCase', async () => {
  const [overlay, find, sidebar] = await Promise.all([
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/components/Search/FindInFilePanel.tsx'),
    read('ui/src/components/Sidebar/SidebarSearch.tsx'),
  ]);
  assert.match(overlay, /search-overlay-case-toggle/);
  assert.match(overlay, /command: 'searchWorkspace'[\s\S]*matchCase/);
  assert.match(overlay, /command: 'searchAcrossWorkspaces'[\s\S]*matchCase/);
  assert.match(find, /highlightFindMatches\(query, matchCase\)/);
  assert.match(sidebar, /command: 'searchWorkspace'[\s\S]*matchCase/);
});

test('all nine locales define the complete search translation domain', async () => {
  const data = await read('ui/src/contexts/translationsData.ts');
  assert.equal(data.match(/\n    search: \{/g)?.length, 9);
  for (const key of [
    'dialogLabel', 'matchCase', 'openResult', 'findDialogLabel', 'sidebarInputLabel',
    'includeWorkspace', 'excludeWorkspace', 'checkAllWorkspaces', 'uncheckAllWorkspaces',
    'resizeWorkspaces', 'resizePreview', 'loadingPreview', 'previewUnavailable',
  ]) {
    assert.equal(data.match(new RegExp(`\\n      ${key}:`, 'g'))?.length, 9, key);
  }
});

test('search jump state retains match-case navigation context', async () => {
  const types = await read('ui/src/desktop/types.ts');
  assert.match(types, /interface PendingSearchJump[\s\S]*matchCase\?: boolean/);
});

test('search preview defaults on, hides row open buttons, and requests full document previews', async () => {
  const [overlay, results, preview] = await Promise.all([
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/components/Search/SearchOverlayResults.tsx'),
    read('ui/src/components/Search/SearchDocumentPreview.tsx'),
  ]);
  assert.match(overlay, /useState\(persistentSearchPreviewEnabled\)/);
  assert.match(overlay, /className=\{`search-overlay-preview-toggle/);
  assert.match(results, /previewEnabled\s*\?\s*null\s*:/s);
  assert.match(preview, /command:\s*'loadSearchPreview'/);
  assert.match(preview, /renderMarkdownClientSide/);
  assert.match(preview, /scrollToRenderedSearchMatchInRoot/);
});

test('search modal exposes themed workspace checkboxes and workspace filtering', async () => {
  const [overlay, workspaces, css] = await Promise.all([
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/components/Search/SearchOverlayWorkspaceList.tsx'),
    read('ui/src/styles/global/global-search-overlay.css'),
  ]);
  assert.match(workspaces, /type="checkbox"/);
  assert.match(overlay, /checkedWorkspaceIds/);
  assert.match(overlay, /tabIds:\s*enabledWorkspaceIds/);
  assert.match(css, /\.search-overlay-workspace__checkbox/);
  assert.match(css, /cursor:\s*col-resize/);
});

test('search modal uses application tooltips and removes the active result rail', async () => {
  const [component, results, css] = await Promise.all([
    read('ui/src/components/Search/SearchOverlay.tsx'),
    read('ui/src/components/Search/SearchOverlayResults.tsx'),
    read('ui/src/styles/global/global-search-overlay.css'),
  ]);
  assert.match(component, /<TooltipButton[\s\S]*tooltip=\{t\.tooltips\.closeModal\}/);
  assert.match(component, /tooltip=\{t\.search\.openResult\}/);
  assert.match(results, /tooltip=\{t\.openResult\}/);
  assert.doesNotMatch(css, /\.search-overlay \.search-result-row\.is-active[\s\S]{0,240}box-shadow:\s*inset\s+2px\s+0\s+var\(--accent\)/);
  assert.match(css, /\.search-overlay-results\s*\{[\s\S]*scrollbar-width:\s*thin/);
});

test('sidebar match-case control is compact, inset, and borderless', async () => {
  const css = await read('ui/src/styles/global/global-sidebar-tree-layout.css');
  assert.match(css, /\.sidebar__search-case\s*\{[\s\S]*width:\s*20px[\s\S]*border:\s*0[\s\S]*outline:\s*0/);
  assert.match(css, /\.sidebar__search-case\.is-active[\s\S]*border:\s*0[\s\S]*background:/);
});

test('search overlay buttons match theme border radius and borderless close button', async () => {
  const css = await read('ui/src/styles/global/global-search-overlay.css');
  assert.match(css, /\.search-overlay-close[\s\S]*border-radius:\s*var\(--r\)/);
  assert.match(css, /\.search-overlay-close\s*\{[\s\S]*border:\s*none/);
  assert.match(css, /\.search-overlay\s+\.search-result-row\s*\{[\s\S]*border-radius:\s*var\(--r\)/);
});

test('search overlay stabilizes preview against scan batches', async () => {
  const component = await read('ui/src/components/Search/SearchOverlay.tsx');
  const preview = await read('ui/src/components/Search/SearchDocumentPreview.tsx');

  // selectedResult must be memoized keyed on selectedResultKey so object reference
  // doesn't change on every scan batch (the real root cause of repeated re-fetches)
  assert.match(component, /selectedResult\s*=\s*useMemo/);
  assert.match(component, /\[selectedResultKey\]/);

  // The fetch effect must NOT have `item` in its dep array (only itemKey)
  // so a new object reference on the same key does not trigger a re-fetch
  assert.match(preview, /\[bridge,\s*itemKey\]/);

  // SearchDocumentPreview must be wrapped in React.memo to shield it from parent re-renders
  assert.match(preview, /memo\(SearchDocumentPreviewInner\)/);
});

