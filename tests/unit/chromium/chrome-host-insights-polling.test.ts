import { describe, expect, it, vi } from 'vitest';
import { createChromeInsightsHost } from '../../../chromium-xtension/src/chrome-host-insights';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Chromium Insights polling', () => {
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
    const host = createChromeInsightsHost({
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
});
