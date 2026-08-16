import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { READING_PROGRESS_STORAGE_KEY } from '../../../ui/src/constants/storage';

type Store = typeof import('../../../ui/src/readingProgress/readingProgressStore');

async function importStore(): Promise<Store> {
  // The store keeps module-level state; import a fresh copy per test.
  vi.resetModules();
  return import('../../../ui/src/readingProgress/readingProgressStore');
}

describe('readingProgressStore', () => {
  let store: Store;
  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    store = await importStore();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('round-trips scroll positions after flush', () => {
    store.rememberScrollPosition('ws', '/tmp/a.md', 432);
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBe(432);
    vi.advanceTimersByTime(600);
    const raw = localStorage.getItem(READING_PROGRESS_STORAGE_KEY);
    expect(raw).toContain('/tmp/a.md');
  });

  test('round-trips heading state as map entries', () => {
    store.rememberHeadingState('ws', '/tmp/a.md', new Map([['sec-1', false], ['sec-2', true]]));
    vi.advanceTimersByTime(600);
    expect(store.getHeadingState('ws', '/tmp/a.md'))
      .toEqual(new Map([['sec-1', false], ['sec-2', true]]));
  });

  test('caps files per workspace to most recent 100', () => {
    for (let i = 0; i < 130; i += 1) {
      store.rememberScrollPosition('ws', `/tmp/f${i}.md`, i);
      vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(600);
    expect(store.getScrollPosition('ws', '/tmp/f0.md')).toBeUndefined();
    expect(store.getScrollPosition('ws', '/tmp/f129.md')).toBe(129);
  });

  test('corrupted storage resets silently', () => {
    localStorage.setItem(READING_PROGRESS_STORAGE_KEY, '{not json');
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBeUndefined();
    store.rememberScrollPosition('ws', '/tmp/a.md', 10);
    vi.advanceTimersByTime(600);
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBe(10);
  });

  test('flushReadingProgress writes synchronously', () => {
    store.rememberScrollPosition('ws', '/tmp/a.md', 77);
    store.flushReadingProgress();
    expect(localStorage.getItem(READING_PROGRESS_STORAGE_KEY)).toContain('77');
  });
});
