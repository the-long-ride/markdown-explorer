import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(path.resolve('ui/src/styles/global/global-export-center.css'), 'utf8');

test('Export Center is centered in the viewport', () => {
  assert.match(css, /\.export-center\s*\{[\s\S]*?align-items:\s*center;/);
  assert.match(css, /\.export-center\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.doesNotMatch(css, /\.export-center\s*\{[\s\S]*?align-items:\s*flex-start;/);
});
