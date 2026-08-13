import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Theme Remix translated options preserve literal unions', () => {
  const source = read('ui/src/components/Settings/themeRemixTranslations.ts');
  assert.match(source, /getThemeRemixDensityOptions[\s\S]*?as const;/);
  assert.match(source, /getThemeRemixImageFitOptions[\s\S]*?as const;/);
});

test('renderer label formatting remains compatible with ES2020', () => {
  const source = read('ui/src/dom/tableUiLabels.ts');
  assert.doesNotMatch(source, /\.replaceAll\(/);
  assert.match(source, /\.split\([^)]*\)\.join\(/);
});
