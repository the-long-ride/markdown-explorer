import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('Focus mode uses a dedicated draggable surface below the native resize edge', () => {
  const appShell = read('ui/src/AppShell.tsx');
  const css = read('ui/src/styles/global/global-electron-window-controls.css');

  assert.match(appShell, /focus-mode-drag-region__surface/);
  assert.match(css, /focus-mode-drag-region__surface[\s\S]*?-webkit-app-region:\s*drag/);
  assert.match(css, /focus-mode-drag-region__surface[\s\S]*?top:\s*[1-9][0-9]*px/);
  assert.match(css, /focus-mode-drag-region__controls[\s\S]*?-webkit-app-region:\s*no-drag/);
});
