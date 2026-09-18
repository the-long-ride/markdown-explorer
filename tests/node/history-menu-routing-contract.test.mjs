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
