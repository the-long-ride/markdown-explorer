import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(path.resolve('ui/src/styles/global/global-export-center.css'), 'utf8');

test('Export Center stays viewport-bounded at app zoom and uses theme radii', () => {
  assert.doesNotMatch(css, /min-height:\s*520px/);
  assert.match(css, /100dvh/);
  assert.match(css, /var\(--topbar-h/);
  assert.match(css, /border-radius:\s*var\(--r-lg\)/);
  assert.match(css, /border-radius:\s*var\(--r-md\)/);
  assert.doesNotMatch(css, /border-radius:\s*(?:6|7|8|10)px/);
});

test('Export Center close control follows the borderless Settings modal pattern', () => {
  assert.match(css, /\.export-center__close\s*\{[\s\S]*?background:\s*none;[\s\S]*?border:\s*none;/);
});
