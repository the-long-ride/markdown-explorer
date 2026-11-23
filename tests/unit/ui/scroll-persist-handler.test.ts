import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { READING_PROGRESS_STORAGE_KEY } from '../../../ui/src/constants/storage';

type Store = typeof import('../../../ui/src/readingProgress/readingProgressStore');
type PersistModule = typeof import('../../../ui/src/components/Content/useReadingProgressPersistence');

async function importModules(): Promise<{ store: Store; persist: PersistModule }> {
  // The store keeps module-level state; import a fresh copy per test.
  vi.resetModules();
  const store = await import('../../../ui/src/readingProgress/readingProgressStore');
  const persist = await import('../../../ui/src/components/Content/useReadingProgressPersistence');
  return { store, persist };
}

function fakeScrollRef(scrollTop: number) {
  return { current: { scrollTop } as HTMLDivElement | null };
}

describe('createScrollPersistHandler lifecycle flush', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('flush writes the latest scrollTop even when the last persist was throttled', async () => {
    const { store, persist } = await importModules();
    const scrollRef = fakeScrollRef(0);

    const handler = persist.createScrollPersistHandler(scrollRef, 'ws', '/tmp/a.md');

    // First capture at t=0 writes immediately.
    scrollRef.current!.scrollTop = 100;
    handler.persist();
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBe(100);

    // A second capture within the 400ms throttle window is dropped by the
    // throttle. Without a lifecycle flush, this position would be lost.
    vi.advanceTimersByTime(50);
    scrollRef.current!.scrollTop = 300;
    handler.persist();
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBe(100);

    // Lifecycle cleanup (hide/close/unmount) must flush the latest position.
    handler.flush();
    store.flushReadingProgress();
    expect(store.getScrollPosition('ws', '/tmp/a.md')).toBe(300);
    const raw = localStorage.getItem(READING_PROGRESS_STORAGE_KEY);
    expect(raw).toContain('300');
    expect(raw).not.toMatch(/"\/tmp\/a\.md":\s*100\b/);
  });

  test('flush is a no-op when there is no current file', async () => {
    const { persist } = await importModules();
    const scrollRef = fakeScrollRef(500);
    const handler = persist.createScrollPersistHandler(scrollRef, 'ws', null);
    expect(() => handler.flush()).not.toThrow();
  });

  test('restores a saved offset once per file and render version after the scroll element mounts', async () => {
    const { store, persist } = await importModules();
    const scrollRef = fakeScrollRef(0);
    const element = scrollRef.current!;
    scrollRef.current = null;
    store.rememberScrollPosition('ws', '/tmp/a.md', 120);
    const args = {
      scrollRef, workspaceKey: 'ws', currentFile: '/tmp/a.md', renderVersion: 1,
      positions: {}, lastFileRef: { current: null }, lastVersionRef: { current: null },
    };
    persist.restoreScrollPosition(args);
    expect(args.lastVersionRef.current).toBeNull();
    scrollRef.current = element;
    persist.restoreScrollPosition(args);
    expect(element.scrollTop).toBe(120);
    expect(args.positions).toEqual({ '/tmp/a.md': 120 });
    element.scrollTop = 300;
    persist.restoreScrollPosition(args);
    expect(element.scrollTop).toBe(300);
    persist.restoreScrollPosition({ ...args, currentFile: null });
    expect(element.scrollTop).toBe(0);
  });

  test('rehydrates heading state without replacing an in-memory change', async () => {
    const { store, persist } = await importModules();
    const saved = new Map([['intro', false]]);
    const updated = new Map([['intro', true]]);
    const states = new Map<string, typeof saved>();
    store.rememberHeadingState('ws', '/tmp/a.md', saved);
    persist.seedHeadingStateForFile(states, 'ws', null);
    expect(states.size).toBe(0);
    persist.seedHeadingStateForFile(states, 'ws', '/tmp/a.md');
    expect(states.get('/tmp/a.md')).toEqual(saved);
    states.set('/tmp/a.md', updated);
    persist.seedHeadingStateForFile(states, 'ws', '/tmp/a.md');
    expect(states.get('/tmp/a.md')).toBe(updated);
  });
});
