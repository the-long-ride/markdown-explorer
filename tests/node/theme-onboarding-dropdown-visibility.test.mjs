import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('onboarding theme menus are not clipped by their section', async () => {
  const css = await readFile(
    path.join(repoRoot, 'ui/src/styles/global/global-modals-settings-a.part2.css'),
    'utf8',
  );
  const stylesSection = css.match(/\.theme-onboarding-card__section--styles\s*\{[\s\S]*?\}/)?.[0] ?? '';
  const stylesScroller = css.match(/\.theme-onboarding-card__styles\s*\{[\s\S]*?\}/)?.[0] ?? '';

  assert.ok(stylesSection, 'theme onboarding styles section rule must exist');
  assert.doesNotMatch(stylesSection, /overflow\s*:\s*hidden/);
  assert.doesNotMatch(stylesScroller, /overflow(?:-x|-y)?\s*:\s*(?:hidden|auto|scroll)/);
});
