import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const converterPackage = '@the-long-ride/markdown-them';

test('Electron and VS Code retain markdown-them', () => {
  assert.ok(json('electron/package.json').dependencies?.[converterPackage]);
  assert.ok(json('vscode/package.json').dependencies?.[converterPackage]);
  assert.match(read('electron/render/document-converter.js'), /generateMarkdown/);
  assert.match(read('vscode/src/core/documentConversion.ts'), /generateMarkdown/);
});

test('Tauri uses an in-process native Rust converter without sidecar packaging', () => {
  const config = json('tauri/tauri.conf.json');
  const tauriPackage = json('tauri/package.json');
  const converter = read('tauri/src/render/document_converter.rs');
  const nativeConverter = read('tauri/src/render/native_document_converter/mod.rs');

  assert.match(converter, /native_document_converter::convert_file/);
  assert.match(nativeConverter, /ConversionQuality/);
  assert.equal(config.bundle.externalBin, undefined);
  assert.equal(config.bundle.resources, undefined);
  assert.equal(config.build.beforeBuildCommand, undefined);
  assert.equal(config.build.beforeDevCommand, undefined);
  assert.equal(tauriPackage.scripts?.['prepare:document-sidecar'], undefined);
  assert.doesNotMatch(read('pnpm-workspace.yaml'), /mdthem-sidecar/);
});

test('Chromium keeps document conversion disabled', () => {
  const chromium = read('chromium-xtension/src/chrome-host.ts');
  assert.match(chromium, /documentConversionEnabled:\s*false/);
});
