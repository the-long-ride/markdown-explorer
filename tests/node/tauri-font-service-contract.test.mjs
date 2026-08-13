import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Tauri owns a native font service with SFNT metadata parsing and managed imports', async () => {
  const source = await read('tauri/src/fonts.rs');
  assert.match(source, /pub fn inspect_font_file/);
  assert.match(source, /pub fn list_fonts/);
  assert.match(source, /pub fn import_font_files/);
  assert.match(source, /pub fn remove_imported_font/);
  assert.match(source, /JetBrainsMono-VariableFont_wght\.ttf/);
  assert.match(source, /JetBrainsMono-Italic-VariableFont_wght\.ttf/);
  assert.match(source, /LOCALAPPDATA/);
  assert.match(source, /Microsoft.*Windows.*Fonts/s);
});

test('Tauri dispatcher supports desktop font list/import/remove and single-file font picker', async () => {
  const [external, handlers] = await Promise.all([
    read('tauri/src/dispatcher/commands_external.rs'),
    read('tauri/src/dispatcher/handlers.rs'),
  ]);
  for (const command of ['listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont']) {
    assert.match(external, new RegExp(`"${command}"`));
  }
  assert.match(handlers, /blocking_pick_file\(\)/);
  assert.doesNotMatch(handlers, /blocking_pick_files\(\)/);
});

test('Tauri local-file protocol permits app-managed fonts and serves font MIME types', async () => {
  const source = await read('tauri/src/local_file.rs');
  assert.match(source, /app_data_dir/);
  assert.match(source, /join\("fonts"\)/);
  assert.match(source, /"ttf"\s*=>\s*"font\/ttf"/);
  assert.match(source, /"otf"\s*=>\s*"font\/otf"/);
});


test('Tauri system discovery covers Windows user fonts and macOS font collections', async () => {
  const source = await read('tauri/src/fonts.rs');
  assert.match(source, /LOCALAPPDATA/);
  assert.match(source, /Microsoft.*Windows.*Fonts/);
  assert.match(source, /ttc/);
  assert.match(source, /otc/);
});
