import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DESKTOP_FONT_BINDINGS,
  getDesktopFontVariantOptions,
  migrateDesktopFontBindings,
  normalizeDesktopFontBinding,
  normalizeDesktopFontSelection,
} from '../../ui/src/desktop/fonts/fontModel.ts';

test('font selection normalization rejects malformed imported references', () => {
  assert.deepEqual(normalizeDesktopFontSelection({ source: 'imported', family: 'Example' }), { source: 'default' });
  assert.deepEqual(normalizeDesktopFontSelection({ source: 'system', family: '  Inter  ' }), { source: 'system', family: 'Inter' });
});

test('role binding normalization keeps explicit style and weight', () => {
  assert.deepEqual(
    normalizeDesktopFontBinding({ source: 'system', family: 'Inter', style: 'italic', weight: 600 }, 'heading'),
    { source: 'system', family: 'Inter', style: 'italic', weight: 600 },
  );
  assert.deepEqual(normalizeDesktopFontBinding({ source: 'bad' }, 'quote'), DEFAULT_DESKTOP_FONT_BINDINGS.quote);
});

test('legacy app/code selections migrate only when new bindings are absent', () => {
  const migrated = migrateDesktopFontBindings(undefined, { source: 'system', family: 'Inter' }, { source: 'system', family: 'Fira Code' });
  assert.equal(migrated.appUi.family, 'Inter');
  assert.equal(migrated.body.family, 'Inter');
  assert.equal(migrated.code.family, 'Fira Code');
  assert.deepEqual(migrated.heading, DEFAULT_DESKTOP_FONT_BINDINGS.heading);
  assert.deepEqual(migrated.quote, DEFAULT_DESKTOP_FONT_BINDINGS.quote);

  const explicit = migrateDesktopFontBindings({ body: { source: 'system', family: 'Georgia', style: 'normal', weight: 400 } }, { source: 'system', family: 'Inter' }, undefined);
  assert.equal(explicit.body.family, 'Georgia');
});

test('variable font variant options expose common supported weights for each style', () => {
  const options = getDesktopFontVariantOptions({
    id: 'system:demo', family: 'Demo', source: 'system', cssFamily: 'Demo', available: true,
    faces: [
      { style: 'normal', minWeight: 350, maxWeight: 750, variable: true },
      { style: 'italic', minWeight: 400, maxWeight: 700, variable: true },
    ],
  });
  assert.deepEqual(options.filter((o) => o.style === 'normal').map((o) => o.weight), [350, 400, 500, 600, 700, 750]);
  assert.deepEqual(options.filter((o) => o.style === 'italic').map((o) => o.weight), [400, 500, 600, 700]);
});

test('static font variant options expose only discovered face weights', () => {
  const options = getDesktopFontVariantOptions({
    id: 'system:demo', family: 'Demo', source: 'system', cssFamily: 'Demo', available: true,
    faces: [
      { style: 'normal', minWeight: 400, maxWeight: 400, variable: false },
      { style: 'normal', minWeight: 700, maxWeight: 700, variable: false },
      { style: 'italic', minWeight: 400, maxWeight: 400, variable: false },
    ],
  });
  assert.deepEqual(options.map((o) => [o.style, o.weight]), [['normal', 400], ['normal', 700], ['italic', 400]]);
});
