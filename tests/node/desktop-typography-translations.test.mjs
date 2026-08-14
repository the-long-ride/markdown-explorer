import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const keys = [
  'typography', 'typographyDesc', 'appUiFont', 'bodyFont', 'headingFont', 'quoteFont', 'codeFont', 'mermaidFont',
  'fontDefault', 'fontDefaultDescription', 'fontSystem', 'fontImported',
  'fontImport', 'fontRemove', 'fontApply', 'fontSearchPlaceholder', 'fontNoResults',
  'fontVariant', 'fontResetRole', 'fontResetAll', 'fontNormal', 'fontItalic',
];

test('desktop typography strings exist in the translation type and all supported locale catalogs', async () => {
  const [types, data] = await Promise.all([
    read('ui/src/contexts/translationTypes.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  for (const key of keys) {
    assert.match(types, new RegExp(`\\b${key}:\\s*string;`), `${key} must be typed`);
    const count = data.match(new RegExp(`\\b${key}:`, 'g'))?.length ?? 0;
    assert.equal(count, 9, `${key} must exist in all 9 locale catalogs`);
  }
});

test('startup inline English catalog contains desktop typography strings', async () => {
  const [inline, startup] = await Promise.all([
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/desktopTypographyTranslations.ts'),
  ]);
  assert.match(inline, /\.\.\.DESKTOP_TYPOGRAPHY_EN/);
  for (const key of keys) assert.match(startup, new RegExp(`\\b${key}:`), `${key} must exist before lazy translations load`);
});

test('desktop typography component uses the typed translations contract', async () => {
  const source = await read('ui/src/components/Settings/DesktopTypographySettings.tsx');
  assert.match(source, /import type \{ Translations \} from ['"]\.\.\/\.\.\/contexts\/translationTypes['"]/);
  assert.doesNotMatch(source, /\bt:\s*any\b/);
});
