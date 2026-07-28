import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('open built-in theme menu stacks above onboarding theme cards', async () => {
  const css = await readFile(
    path.join(repoRoot, 'ui/src/styles/global/global-theme-picker-styles.css'),
    'utf8',
  );
  const openDropdown = css.match(/\.theme-group-dropdown\.is-open\s*\{[\s\S]*?\}/)?.[0] ?? '';
  const menu = css.match(/\.theme-group-menu\s*\{[\s\S]*?\}/)?.[0] ?? '';

  assert.match(openDropdown, /z-index\s*:\s*20/);
  assert.match(menu, /z-index\s*:\s*21/);
});
