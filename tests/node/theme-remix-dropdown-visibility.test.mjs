import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Theme Remix portal menus use their computed viewport position', async () => {
  const css = await readFile(
    path.join(repoRoot, 'ui/src/styles/global/global-theme-remix-dialog.css'),
    'utf8',
  );
  const portalRule = css.match(/\.theme-remix-menu--portal\s*\{[\s\S]*?\}/)?.[0] ?? '';

  assert.match(portalRule, /top\s*:\s*var\(--menu-top\)/);
  assert.match(portalRule, /left\s*:\s*var\(--menu-left\)/);
  assert.match(portalRule, /width\s*:\s*var\(--menu-width\)/);
});
