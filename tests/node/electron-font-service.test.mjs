import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { defaultSystemFontRoots } = require('../../electron/fonts/font-service.js');
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const normal = path.join(sourceRoot, 'ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');
const italic = path.join(sourceRoot, 'ui/assets/fonts/JetBrainsMono/JetBrainsMono-Italic-VariableFont_wght.ttf');

test('Electron font service parses the bundled variable upright and italic files', async () => {
  const { inspectFontFile } = require('../../electron/fonts/font-service.js');
  const normalFaces = await inspectFontFile(normal);
  const italicFaces = await inspectFontFile(italic);
  assert.ok(normalFaces.some((face) => face.family === 'JetBrains Mono' && face.style === 'normal' && face.variable && face.maxWeight >= 700));
  assert.ok(italicFaces.some((face) => face.family === 'JetBrains Mono' && face.style === 'italic' && face.variable));
});


test('Electron detects both machine-wide and per-user Windows font roots', () => {
  const previousWindir = process.env.WINDIR;
  const previousLocalAppData = process.env.LOCALAPPDATA;
  process.env.WINDIR = 'C:\\Windows';
  process.env.LOCALAPPDATA = 'C:\\Users\\Ada\\AppData\\Local';
  try {
    const roots = defaultSystemFontRoots('win32');
    assert.deepEqual(roots, [
      path.win32.join(process.env.WINDIR, 'Fonts'),
      path.win32.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'),
    ]);
  } finally {
    if (previousWindir === undefined) delete process.env.WINDIR; else process.env.WINDIR = previousWindir;
    if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = previousLocalAppData;
  }
});

test('Electron import copies a complete family into app-managed storage and returns file URLs', async () => {
  const { createFontService } = require('../../electron/fonts/font-service.js');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'markdown-explorer-font-test-'));
  try {
    const service = createFontService({ appDataDir: temp, systemFontRoots: [], pathToFileURL });
    const imported = await service.importFontFiles([normal, italic]);
    assert.equal(imported.family, 'JetBrains Mono');
    assert.equal(imported.source, 'imported');
    assert.ok(imported.faces.every((face) => face.cssUrl?.startsWith('file:')));
    const catalog = await service.listFonts();
    assert.ok(catalog.some((family) => family.id === imported.id));
    await service.removeImportedFont(imported.id);
    assert.ok(!(await service.listFonts()).some((family) => family.id === imported.id));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('Electron accepts a single imported font file so each typography role can bind an explicit available variant', async () => {
  const { createFontService } = require('../../electron/fonts/font-service.js');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'markdown-explorer-font-test-'));
  try {
    const service = createFontService({ appDataDir: temp, systemFontRoots: [], pathToFileURL });
    const imported = await service.importFontFiles([normal]);
    assert.equal(imported.family, 'JetBrains Mono');
    assert.ok(imported.faces.some((face) => face.style === 'normal' && face.maxWeight >= 700));
    const catalog = await service.listFonts();
    assert.ok(catalog.some((family) => family.id === imported.id));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


test('detects platform system font roots and collection formats', async () => {
  const winRoots = defaultSystemFontRoots('win32');
  assert.ok(winRoots.some((root) => /Windows[\\/]Fonts$/i.test(root)));
  assert.ok(winRoots.some((root) => /Microsoft[\\/]Windows[\\/]Fonts$/i.test(root)));

  const serviceSource = await readFile(new URL('../../electron/fonts/font-service.js', import.meta.url), 'utf8');
  assert.match(serviceSource, /SYSTEM_FONT_EXTENSIONS[^\n]*['"]\.ttc['"]/);
  assert.match(serviceSource, /SYSTEM_FONT_EXTENSIONS[^\n]*['"]\.otc['"]/);
  assert.match(serviceSource, /IMPORT_FONT_EXTENSIONS[^\n]*['"]\.ttf['"][^\n]*['"]\.otf['"]/);
});
