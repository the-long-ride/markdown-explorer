import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const jumpUrl = new URL('../../ui/src/utils/bookmarkJump.ts', import.meta.url);
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('maps exact third repeated source occurrence to its rendered offsets', async () => {
  const { sourceRangeToRenderedOffsets } = await import(jumpUrl);
  const source = 'Hello Hello Hello Hello';
  const start = source.indexOf('Hello', source.indexOf('Hello', 6) + 6);
  assert.deepEqual(sourceRangeToRenderedOffsets(source, start, start + 5), { start: 12, end: 17 });
});

test('bookmark navigation queues a bookmark-specific jump and targetChanged never navigates', async () => {
  const [navigation, effects] = await Promise.all([
    read('ui/src/hooks/useBookmarkNavigation.ts'),
    read('ui/src/useAppSearchEffects.ts'),
  ]);
  assert.match(navigation, /queueBookmarkJump/);
  assert.match(navigation, /resolved\?\.status === 'targetChanged'/);
  assert.match(effects, /scrollToBookmarkTarget/);
  assert.match(effects, /resolveBookmarkTarget/);
  assert.match(effects, /pendingSearchJump\.bookmark/);
});

test('bookmark jump uses source metadata, exact ranges, transient mark, and object kind', async () => {
  const source = await read('ui/src/utils/bookmarkJump.ts');
  assert.match(source, /data-mdn-source-start/);
  assert.match(source, /data-mdn-bookmark-kind/);
  assert.match(source, /mdn-bookmark-jump-mark/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /clearBookmarkJumpMarks/);
});
