import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scopeCss = await readFile(
  new URL('../../ui/src/styles/global/global-scope-view.css', import.meta.url),
  'utf8',
);

test('Scope View uses the wider desktop surface without changing mobile width', () => {
  assert.match(
    scopeCss,
    /\.scope-view__card\s*\{[\s\S]*?width:\s*min\(1080px,\s*calc\(100vw - 24px\)\)/,
  );
  assert.match(
    scopeCss,
    /\.scope-view__document\s*\{[\s\S]*?width:\s*min\(100%,\s*980px\)/,
  );
  assert.match(
    scopeCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.scope-view__card\s*\{[\s\S]*?width:\s*calc\(100vw - 16px\)/,
  );
});
