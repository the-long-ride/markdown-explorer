import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('resize hook supports synchronized sidebar shell movement and single completion persistence', async () => {
  const source = await read('ui/src/hooks/useResize.ts');
  const moveBlock = source.match(/const onMove = \(event: PointerEvent\) => \{([\s\S]*?)const onUp/)?.[1] ?? '';

  assert.match(source, /mode\?: 'live' \| 'deferred' \| 'synchronized'/);
  assert.match(source, /freezeContentId\?: string/);
  assert.match(source, /target\.style\.width = `\$\{lastAppliedWidth\}px`/);
  assert.match(source, /freezeContent\.style\.width = `\$\{startW\}px`/);
  assert.match(source, /target\.classList\.add\('is-resizing-shell'\)/);
  assert.match(source, /target\.style\.removeProperty\('width'\)/);
  assert.doesNotMatch(moveBlock, /localStorage\.setItem/);
  assert.doesNotMatch(moveBlock, /style\.setProperty\(cssVar/);
  assert.match(source, /localStorage\.setItem\(storageKey, String\(lastAppliedWidth\)\)/);
});

test('shortcut labels use primary theme text in default and responsive layouts', async () => {
  const [layout, responsive] = await Promise.all([
    read('ui/src/styles/global/global-settings-layout.css'),
    read('ui/src/styles/global/global-settings-responsive.css'),
  ]);
  const layoutBlock = layout.match(/\.settings-shortcut-label\s*\{([^}]*)\}/s)?.[1] ?? '';
  const responsiveBlock = responsive.match(/\.settings-shortcut-label\s*\{([^}]*)\}/s)?.[1] ?? '';

  assert.match(layoutBlock, /color:\s*var\(--tx\);/);
  assert.match(responsiveBlock, /color:\s*var\(--tx\)\s*!important;/);
});
