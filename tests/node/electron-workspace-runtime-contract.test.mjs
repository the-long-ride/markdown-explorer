import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

test('Electron workspace runtime exposes cancellation and passes cancellation into the scanner', async () => {
  const [handlers, main] = await Promise.all([
    read('electron/core/runtime-workspace-handlers.js'),
    read('electron/main.js'),
  ]);

  assert.match(handlers, /return \{[\s\S]*cancelWorkspaceScan[\s\S]*cancelAllWorkspaceScans[\s\S]*\};/);
  assert.match(main, /DesktopScanner\.scan\(wsPath, \{[\s\S]*isCurrent,/);
  assert.equal((handlers.match(/const idx = ensureSearchIndex\(\);/g) ?? []).length, 2);
});
