import { describe, expect, test, vi, afterEach } from 'vitest';

import { createWorkspaceWatchController } from '../../../desktop/workspace-watch.js';

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
});
