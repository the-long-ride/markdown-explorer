import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Electron wires host-managed desktop font commands through runtime and IPC', async () => {
  const [main, runtime, handlers, ipc, pkg] = await Promise.all([
    read('electron/main.js'),
    read('electron/core/main-runtime.js'),
    read('electron/core/runtime-command-handlers.js'),
    read('electron/core/ipc-handlers.js'),
    read('electron/package.json'),
  ]);
  assert.match(main, /createFontService/);
  assert.match(main, /app\.getPath\(['"]userData['"]\)/);
  assert.match(runtime, /handleListDesktopFonts/);
  assert.match(runtime, /handleImportDesktopFonts/);
  assert.match(runtime, /handleRemoveImportedDesktopFont/);
  assert.match(handlers, /desktopFontsResult/);
  assert.match(handlers, /showOpenDialogSync/);
  assert.doesNotMatch(handlers, /properties:\s*\[['"]openFile['"],\s*['"]multiSelections['"]\]/);
  for (const command of ['listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont']) {
    assert.match(ipc, new RegExp(`case ["']${command}["']`));
  }
  assert.match(pkg, /"fonts\/\*\*\/\*\.js"/);
});


test('desktop font parsers recognize variable italic axes', async () => {
  const [electron, tauri] = await Promise.all([
    read('electron/fonts/font-service.js'),
    read('tauri/src/fonts.rs'),
  ]);
  assert.match(electron, /axisTag === ['"]ital['"]/);
  assert.match(electron, /axisTag === ['"]slnt['"]/);
  assert.match(electron, /expandItalicAxis/);
  assert.match(tauri, /Some\(['"]ital['"]\)/);
  assert.match(tauri, /Some\(['"]slnt['"]\)/);
  assert.match(tauri, /expand_italic_axis/);
});
