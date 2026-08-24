import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const activeFiles = [
  'electron/core/main-bootstrap.js',
  'electron/core/ipc-handlers.js',
  'ui/src/types/webviewMessages.ts',
  'ui/src/types/hostMessages.ts',
];

test('export protocol uses generic save and contains no legacy native PDF/footer fields', async () => {
  const sources = await Promise.all(activeFiles.map(async (path) => [path, await readFile(resolve(root, path), 'utf8')]));
  const forbidden = [/\bexportPdf(?:Result)?\b/, /\bPDF_FOOTER_TEXT\b/, /\bfooterEnabled\b/, /\bfooterText\b/];

  for (const [path, source] of sources) {
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${path} must not contain ${pattern}`);
  }

  const bootstrap = sources.find(([path]) => path === 'electron/core/main-bootstrap.js')?.[1] ?? '';
  const webview = sources.find(([path]) => path === 'ui/src/types/webviewMessages.ts')?.[1] ?? '';
  assert.match(bootstrap, /\bsaveExportFile\b/);
  assert.match(webview, /readonly command: 'saveExportFile'/);
});
