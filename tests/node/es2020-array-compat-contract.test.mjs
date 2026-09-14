import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('editor and history sources stay compatible with the ES2020 TypeScript lib', async () => {
  const [guard, lineDiff] = await Promise.all([
    read('ui/src/editor/useUnsavedChangesGuard.tsx'),
    read('ui/src/history/lineDiff.ts'),
  ]);

  assert.doesNotMatch(guard, /\.at\s*\(/);
  assert.doesNotMatch(lineDiff, /\.at\s*\(/);
});
