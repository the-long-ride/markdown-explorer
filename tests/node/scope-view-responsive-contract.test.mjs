import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(path.resolve('ui/src/styles/global/global-scope-view.css'), 'utf8');

test('Scope View stays below the app header and remains viewport-bounded under zoom', () => {
  assert.match(css, /\.scope-view\s*\{[\s\S]*?padding:\s*calc\(var\(--topbar-h/);
  assert.match(css, /\.scope-view__card\s*\{[\s\S]*?100dvh/);
  assert.match(css, /\.scope-view__card\s*\{[\s\S]*?min-height:\s*0;/);
  assert.doesNotMatch(css, /min-height:\s*420px/);
});

test('Scope View uses the current theme radius and a compact header', () => {
  assert.match(css, /\.scope-view__card\s*\{[\s\S]*?border-radius:\s*var\(--r-lg\)/);
  assert.match(css, /\.scope-view__header\s*\{[\s\S]*?min-height:\s*40px/);
  assert.match(css, /@media\s*\(max-height:\s*620px\)/);
});
