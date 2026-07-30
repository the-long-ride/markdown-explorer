import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

for (const filePath of [
  'ui/src/components/Content/ContentTabItem.tsx',
  'ui/src/components/Desktop/DesktopTabItem.tsx',
]) {
  test(`${filePath} callback ref returns void`, async () => {
    const source = await read(filePath);
    assert.match(source, /ref=\{\(element\) => \{/);
    assert.doesNotMatch(source, /ref=\{\(element\) => element \?/);
  });
}
