import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

test('all dialog content surfaces use the shared opaque theme background', async () => {
  const [globalCss, dialogCss, tokenFiles] = await Promise.all([
    read('ui/src/styles/global.css'),
    read('ui/src/styles/global/global-dialog-surfaces.css').catch(() => ''),
    readdir(path.join(repoRoot, 'ui/src/styles/tokens')),
  ]);

  assert.match(globalCss, /@import ['"]\.\/global\/global-dialog-surfaces\.css['"];?/);
  assert.match(
    dialogCss,
    /--dialog-surface:\s*linear-gradient\(var\(--bg-e\),\s*var\(--bg-e\)\),\s*var\(--bg\)/,
  );
  for (const tokenFile of tokenFiles.filter((file) => file.endsWith('.css'))) {
    const tokens = await read(`ui/src/styles/tokens/${tokenFile}`);
    assert.doesNotMatch(tokens, /--bg:\s*(?:rgba|transparent)/, tokenFile);
  }

  for (const selector of [
    '.settings-card',
    '.search-overlay-card',
    '.find-in-file-panel',
    '.mdn-html-modal',
    '.html-local-first-warning',
  ]) {
    assert.match(dialogCss, new RegExp(selector.replaceAll('.', '\\.'), 'm'));
  }

  assert.match(dialogCss, /background:\s*var\(--dialog-surface\)\s*!important/);
  assert.doesNotMatch(dialogCss, /rgba\([^)]*,\s*0?\.[0-9]+\)/);
  assert.doesNotMatch(dialogCss, /color-mix\([^;]*transparent/);
});
