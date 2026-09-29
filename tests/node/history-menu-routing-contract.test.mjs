import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('More Actions History event routes to the repository History sidebar', async () => {
  const [appShell, toolbarMenu] = await Promise.all([
    read('ui/src/AppShell.tsx'),
    read('ui/src/components/shared/ToolbarActionMenu.tsx'),
  ]);

  assert.match(toolbarMenu, /DOCUMENT_HISTORY_OPEN_EVENT/);
  assert.match(toolbarMenu, /window\.dispatchEvent\(new Event\(DOCUMENT_HISTORY_OPEN_EVENT\)\)/);
  assert.match(appShell, /DOCUMENT_HISTORY_OPEN_EVENT/);
  assert.match(appShell, /openRepositoryHistorySidebar/);
  assert.match(appShell, /window\.addEventListener\(DOCUMENT_HISTORY_OPEN_EVENT/);
});

test('Document item and tab context menus route to document history', async () => {
  const [sidebarItems, tabItems, contentTabs, splitContent, historyContext] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarItemMenuItems.tsx'),
    read('ui/src/components/Content/contentTabContextMenuItems.tsx'),
    read('ui/src/components/Content/ContentTabs.tsx'),
    read('ui/src/components/Content/SplitContent.tsx'),
    read('ui/src/contexts/HistoryContext.tsx'),
  ]);

  assert.match(sidebarItems, /id:\s*['"]history['"]/);
  assert.match(sidebarItems, /requestOpenDocumentHistory\(target\.path\)/);
  assert.match(tabItems, /action:\s*['"]history['"]/);
  assert.match(contentTabs, /case\s*['"]history['"]:/);
  assert.match(contentTabs, /requestOpenDocumentHistory\(contextMenu\.filePath\)/);
  assert.match(splitContent, /case\s*['"]history['"]:/);
  assert.match(splitContent, /requestOpenDocumentHistory\(filePath\)/);
  assert.match(historyContext, /openHistory\(detail\.filePath\)/);
});
