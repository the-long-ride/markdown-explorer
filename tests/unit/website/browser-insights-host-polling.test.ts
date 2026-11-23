import { describe, expect, it, vi } from 'vitest';
import { createBrowserInsightsHost } from '../../../website-app/src/browser-insights-host';
import { MemoryFolder, memoryFile } from './memory-file-system';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Browser Insights polling', () => {
  it('never overlaps recursive workspace snapshots when a poll is slow', async () => {
    const gates: ReturnType<typeof deferred>[] = [];
    let activeSnapshots = 0;
    let maxActiveSnapshots = 0;
    const root = {
      kind: 'directory',
      name: 'root',
      async *entries() {
        activeSnapshots += 1;
        maxActiveSnapshots = Math.max(maxActiveSnapshots, activeSnapshots);
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        activeSnapshots -= 1;
      },
    } as any;
    let tick: (() => void) | undefined;
    const host = createBrowserInsightsHost({
      getActiveHandle: () => root,
      send: vi.fn(),
      setInterval: ((callback: TimerHandler) => { tick = callback as () => void; return 1; }) as any,
      clearInterval: vi.fn() as any,
      pollIntervalMs: 1,
    });

    host.setInsightsWatchState({ requestId: 'watch', active: true, visible: true });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    tick?.();
    tick?.();
    await Promise.resolve();

    expect(maxActiveSnapshots).toBe(1);
    for (const gate of gates) gate.resolve();
    host.dispose();
  });

  it('reports added, updated and deleted files and stops when the view is hidden', async () => {
    const send = vi.fn();
    const clear = vi.fn();
    const root = new MemoryFolder('docs');
    const edited = memoryFile('change.md', 'A');
    root.children.set('change.md', edited);
    root.children.set('removed.md', memoryFile('removed.md', 'B'));
    const tick = vi.fn();
    const host = createBrowserInsightsHost({
      getActiveHandle: () => root.asHandle(),
      send,
      setInterval: ((handler: () => void) => { tick.mockImplementation(handler); return 42; }) as typeof window.setInterval,
      clearInterval: clear,
    });
    const visible = { requestId: 'watch', workspaceOperationId: 'operation', active: true, visible: true };
    host.setInsightsWatchState(visible);
    const delta = (payload: unknown[]) => expect.objectContaining({ command: 'insightsFsDelta', requestId: 'watch', workspaceOperationId: 'operation', deltas: payload });
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(delta([
      expect.objectContaining({ kind: 'add', entry: expect.objectContaining({ relativePath: 'change.md' }) }),
      expect.objectContaining({ kind: 'add', entry: expect.objectContaining({ relativePath: 'removed.md' }) }),
    ])));
    const writer = await edited.createWritable();
    await writer.write('Z');
    await writer.close();
    root.children.delete('removed.md');
    tick();
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(delta([
      expect.objectContaining({ kind: 'update', entry: expect.objectContaining({ relativePath: 'change.md', sizeBytes: 1 }) }),
      expect.objectContaining({ kind: 'delete', relativePath: 'removed.md' }),
    ])));
    host.setInsightsWatchState({ ...visible, visible: false });
    expect(clear).toHaveBeenCalledExactlyOnceWith(42);
    tick();
    expect(send.mock.calls.flat().filter((message) => message.command === 'insightsFsDelta')).toHaveLength(2);
    host.dispose();
  });
});
