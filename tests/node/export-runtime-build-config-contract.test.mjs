import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('export runtime does not force inlineDynamicImports when IIFE disables code splitting', async () => {
  const script = await read('ui/scripts/build-export-runtime.mjs');
  assert.doesNotMatch(script, /inlineDynamicImports\s*:/);
});
