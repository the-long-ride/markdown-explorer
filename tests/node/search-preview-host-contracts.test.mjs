import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('every supported host routes full-file search preview requests', async () => {
  const hosts = await Promise.all([
    read('electron/core/runtime-command-search-handlers.js'),
    read('tauri/src/dispatcher/search.rs'),
    Promise.all([read('vscode/src/core/panel.ts'), read('vscode/src/core/panelSearchPreview.ts')]).then((parts) => parts.join('\n')),
    read('chromium-xtension/src/chrome-host-search.ts'),
    Promise.all([read('website-app/src/web-file-utility-router.ts'), read('website-app/src/web-test-message-router.ts')]).then((parts) => parts.join('\n')),
  ]);
  for (const source of hosts) {
    assert.match(source, /loadSearchPreview|handle_load_search_preview|handleLoadSearchPreview|_loadSearchPreview/);
    assert.match(source, /searchPreviewResult/);
    assert.match(source, /outside-workspace/);
    assert.match(source, /markdownSource|markdown_source/);
  }
});

test('desktop cross-workspace search filters indexed items by checked tab IDs', async () => {
  const [electronController, electronWorker, tauriDispatcher, tauriWorker] = await Promise.all([
    read('electron/search/search-worker-controller.js'),
    read('electron/search/search-worker.js'),
    read('tauri/src/dispatcher/search.rs'),
    read('tauri/src/search/worker.rs'),
  ]);
  assert.match(electronController, /tabIds/);
  assert.match(electronWorker, /selectedTabIds[\s\S]*filter/);
  assert.match(tauriDispatcher, /tab_ids:\s*Option<Vec<String>>/);
  assert.match(tauriWorker, /enabled\.contains\(tab_id\)/);
});
