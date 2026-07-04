import { describe, expect, test, vi, afterEach } from 'vitest';

import { createWorkspaceWatchController, clearPendingTimerFn, closeCurrentWatcherFn, scheduleRefreshFn, bindWatcherFn, runRefreshFn, normalizeWatchFilename, createWatchChange, mergeWatchChange } from '../../../electron/workspace/workspace-watch.js';

describe('createWorkspaceWatchController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('workspace watcher debounces burst events into one refresh', async () => {
    vi.useFakeTimers();
    const watched: string[] = [];
    let refreshCount = 0;
    let watcherHandler: ((event: string, filename: string) => void) | null = null;

    const controller = createWorkspaceWatchController({
      fs: {
        watch(target: string, _options: any, handler: (event: string, filename: string) => void) {
          watcherHandler = handler;
          watched.push(target);
          return { close() {} };
        },
      } as any,
      setTimeout,
      clearTimeout,
      debounceMs: 5,
      async onRefresh() {
        refreshCount += 1;
      },
    });

    controller.watchWorkspace('C:/docs');
    watcherHandler?.('rename', 'a.md');
    watcherHandler?.('change', 'a.md');

    await vi.advanceTimersByTimeAsync(20);

    expect(watched).toEqual(['C:/docs']);
    expect(refreshCount).toBe(1);
  });

  test('workspace watcher ignores stale scheduled refreshes after workspace switch', async () => {
    vi.useFakeTimers();
    const refreshedWorkspaces: string[] = [];
    const handlers = new Map<string, (event: string, filename: string) => void>();

    const controller = createWorkspaceWatchController({
      fs: {
        watch(target: string, _options: any, handler: (event: string, filename: string) => void) {
          handlers.set(target, handler);
          return {
            close() {
              handlers.delete(target);
            },
          };
        },
      } as any,
      setTimeout,
      clearTimeout,
      debounceMs: 5,
      async onRefresh(workspacePath: string) {
        refreshedWorkspaces.push(workspacePath);
      },
    });

    controller.watchWorkspace('C:/docs-one');
    handlers.get('C:/docs-one')?.('change', 'a.md');
    controller.watchWorkspace('C:/docs-two');
    handlers.get('C:/docs-two')?.('change', 'b.md');

    await vi.advanceTimersByTimeAsync(20);

    expect(refreshedWorkspaces).toEqual(['C:/docs-two']);
  });

  test('workspace watcher passes changed file details to refresh', async () => {
    vi.useFakeTimers();
    let watcherHandler: ((event: string, filename: string) => void) | null = null;
    const refreshes: any[] = [];

    const controller = createWorkspaceWatchController({
      fs: {
        watch(_target: string, _options: any, handler: (event: string, filename: string) => void) {
          watcherHandler = handler;
          return { close() {} };
        },
      } as any,
      setTimeout,
      clearTimeout,
      debounceMs: 5,
      async onRefresh(workspacePath: string, change: any) {
        refreshes.push({ workspacePath, change });
      },
    });

    controller.watchWorkspace('C:/docs');
    watcherHandler?.('change', 'guide.md');

    await vi.advanceTimersByTimeAsync(20);

    expect(refreshes.length).toBe(1);
    expect(refreshes[0].workspacePath).toBe('C:/docs');
    expect(refreshes[0].change.eventType).toBe('change');
    expect(refreshes[0].change.relativePath).toBe('guide.md');
    expect(refreshes[0].change.fsPath.replace(/\\/g, '/')).toBe('C:/docs/guide.md');
  });

  test('dispose resets state and closes watcher', async () => {
    vi.useFakeTimers();
    let watcherClosed = false;
    let watcherHandler: ((event: string, filename: string) => void) | null = null;
    let refreshCount = 0;

    const controller = createWorkspaceWatchController({
      fs: {
        watch(_target: string, _options: any, handler: (event: string, filename: string) => void) {
          watcherHandler = handler;
          return { close() { watcherClosed = true; } };
        },
      } as any,
      setTimeout,
      clearTimeout,
      debounceMs: 5,
      async onRefresh() { refreshCount += 1; },
    });

    controller.watchWorkspace('C:/docs');
    watcherHandler?.('change', 'a.md');

    controller.dispose();

    expect(watcherClosed).toBe(true);

    await vi.advanceTimersByTimeAsync(20);
    expect(refreshCount).toBe(0);
  });
});

describe('clearPendingTimerFn', () => {
  test('clears and nullifies debounceTimer when set', () => {
    let cleared = false;
    const debounceTimer = { value: 42 };
    const mockClearTimeout = (id: number) => { cleared = id === 42; };
    clearPendingTimerFn(debounceTimer, mockClearTimeout);
    expect(debounceTimer.value).toBeNull();
    expect(cleared).toBe(true);
  });

  test('does nothing when debounceTimer is null', () => {
    const debounceTimer = { value: null };
    clearPendingTimerFn(debounceTimer, () => { throw new Error('should not call'); });
    expect(debounceTimer.value).toBeNull();
  });
});

describe('closeCurrentWatcherFn', () => {
  test('closes current watcher and sets to null', () => {
    let closed = false;
    const currentWatcher = { value: { close: () => { closed = true; } } };
    closeCurrentWatcherFn(currentWatcher, () => {});
    expect(closed).toBe(true);
    expect(currentWatcher.value).toBeNull();
  });

  test('handles null currentWatcher gracefully', () => {
    const currentWatcher = { value: null };
    closeCurrentWatcherFn(currentWatcher, () => {});
    expect(currentWatcher.value).toBeNull();
  });

  test('calls onWatchError when close throws', () => {
    let errorCaught: any = null;
    const currentWatcher = { value: { close: () => { throw new Error('close fail'); } } };
    closeCurrentWatcherFn(currentWatcher, (err: Error) => { errorCaught = err; });
    expect(errorCaught).not.toBeNull();
    expect(errorCaught.message).toBe('close fail');
    expect(currentWatcher.value).toBeNull();
  });
});

describe('runRefreshFn', () => {
  test('does nothing when generation differs', async () => {
    const refreshed: string[] = [];
    const state = {
      workspacePath: { value: 'C:/docs' },
      currentWorkspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      watchGeneration: { value: 2 },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      pendingChange: { value: null },
    };
    await runRefreshFn(state as any, async () => refreshed.push('called'));
    expect(refreshed).toEqual([]);
  });

  test('does nothing when workspacePath is empty', async () => {
    const state = {
      workspacePath: { value: null },
      currentWorkspacePath: { value: null },
      generation: { value: 1 },
      watchGeneration: { value: 1 },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      pendingChange: { value: null },
    };
    const refreshed: string[] = [];
    await runRefreshFn(state as any, async () => refreshed.push('called'));
    expect(refreshed).toEqual([]);
  });

  test('calls onRefresh when generation and path match', async () => {
    const refreshed: any[] = [];
    const state = {
      workspacePath: { value: 'C:/docs' },
      currentWorkspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      watchGeneration: { value: 1 },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      pendingChange: { value: { fsPath: 'test.md', eventType: 'change', relativePath: 'test.md' } },
    };
    await runRefreshFn(state as any, async (wp: string, change: any) => refreshed.push({ wp, change }));
    expect(refreshed.length).toBe(1);
    expect(state.pendingChange.value).toBeNull();
    expect(state.refreshInFlight.value).toBe(false);
  });

  test('sets refreshQueued when refreshInFlight is true', async () => {
    const state = {
      workspacePath: { value: 'C:/docs' },
      currentWorkspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      watchGeneration: { value: 1 },
      refreshInFlight: { value: true },
      refreshQueued: { value: false },
      pendingChange: { value: null },
    };
    await runRefreshFn(state as any, async () => {});
    expect(state.refreshQueued.value).toBe(true);
  });
});

describe('scheduleRefreshFn', () => {
  test('merges pending change and schedules timer', () => {
    vi.useFakeTimers();
    const timerIds: any[] = [];
    const state = {
      pendingChange: { value: null },
      debounceTimer: { value: null },
      workspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      watchGeneration: { value: 1 },
      currentWorkspacePath: { value: 'C:/docs' },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      debounceMs: 10,
      setTimeoutImpl: (fn: () => void, ms: number) => { timerIds.push(ms); return 42; },
      clearTimeoutImpl: () => {},
    };
    scheduleRefreshFn(state as any, async () => {}, { fsPath: 'a.md', eventType: 'change', relativePath: 'a.md' });
    expect(state.pendingChange.value).not.toBeNull();
    expect(timerIds.length).toBe(1);
    vi.useRealTimers();
  });
});

describe('bindWatcherFn', () => {
  test('assigns watcher from fs.watch', () => {
    let watcherAssigned = false;
    const state = {
      currentWatcher: { value: null },
      workspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      fs: {
        watch(target: string, opts: any, handler: Function) {
          watcherAssigned = true;
          return { close() {} };
        },
      },
      onWatchError: () => {},
      setTimeoutImpl: setTimeout,
      clearTimeoutImpl: clearTimeout,
      debounceTimer: { value: null },
      pendingChange: { value: null },
      currentWorkspacePath: { value: 'C:/docs' },
      watchGeneration: { value: 1 },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      debounceMs: 10,
    };
    bindWatcherFn(state as any, async () => {});
    expect(watcherAssigned).toBe(true);
    expect(state.currentWatcher.value).not.toBeNull();
  });

  test('sets watcher to null and calls onWatchError when watch throws', () => {
    let errorCalled = false;
    const state = {
      currentWatcher: { value: null },
      workspacePath: { value: 'C:/docs' },
      generation: { value: 1 },
      fs: {
        watch() { throw new Error('watch fail'); },
      },
      onWatchError: () => { errorCalled = true; },
      setTimeoutImpl: setTimeout,
      clearTimeoutImpl: clearTimeout,
      debounceTimer: { value: null },
      pendingChange: { value: null },
      currentWorkspacePath: { value: 'C:/docs' },
      watchGeneration: { value: 1 },
      refreshInFlight: { value: false },
      refreshQueued: { value: false },
      debounceMs: 10,
    };
    bindWatcherFn(state as any, async () => {});
    expect(state.currentWatcher.value).toBeNull();
    expect(errorCalled).toBe(true);
  });
});
