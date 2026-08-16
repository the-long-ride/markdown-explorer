import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('font family dropdown measures real content and prefers below within Settings modal bounds', async () => {
  const source = await read('ui/src/components/Settings/FontSearchDropdown.tsx');
  assert.match(source, /closest\(['"]\.settings-card--settings['"]\)/);
  assert.match(source, /menuRef\.current[\s\S]*?scrollHeight/);
  assert.match(source, /roomBelow/);
  assert.match(source, /roomAbove/);
  assert.match(source, /desiredHeight\s*>\s*roomBelow/);
  assert.match(source, /openUp\s*=\s*desiredHeight\s*>\s*roomBelow[\s\S]*?roomAbove\s*>\s*roomBelow/);
  assert.match(source, /\{open\s*&&\s*createPortal\(/);
  assert.doesNotMatch(source, /\{open\s*&&\s*position\s*&&\s*createPortal\(/);
});

test('font family dropdown hides its portal until collision-aware coordinates are ready', async () => {
  const [source, css] = await Promise.all([
    read('ui/src/components/Settings/FontSearchDropdown.tsx'),
    read('ui/src/styles/global/global-settings-typography.css'),
  ]);
  assert.match(source, /--menu-visibility/);
  assert.match(css, /visibility:\s*var\(--menu-visibility/);
});
