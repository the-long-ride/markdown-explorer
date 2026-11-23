import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInsightsWorkerClient } from '../../../../ui/src/insights/workerClient';

class FakeWorker {
  posted: any[] = [];
  listeners: Record<string, Set<(event: any) => void>> = { message: new Set(), error: new Set() };
  terminated = false;
  throwOnPost = false;
  postMessage(message: any) {
    if (this.throwOnPost) throw new Error('post failed');
    this.posted.push(message);
  }
  terminate() { this.terminated = true; }
  addEventListener(type: string, listener: (event: any) => void) { this.listeners[type].add(listener); }
  removeEventListener(type: string, listener: (event: any) => void) { this.listeners[type].delete(listener); }
  emit(data: any) { for (const l of this.listeners.message) l({ data }); }
  fail(event: any) { for (const l of this.listeners.error) l(event); }
}

describe('Insights worker client (worker mode)', () => {
  let worker: FakeWorker;
  beforeEach(() => { worker = new FakeWorker(); });
  afterEach(() => { vi.useRealTimers(); });

  it('posts every job type and resolves on completion', async () => {
    const client = createInsightsWorkerClient({ createWorker: () => worker });
    expect(client.mode).toBe('worker');
    const events: any[] = [];
    const off = client.onEvent((event) => events.push(event));
    client.initialize({});
    const jobs = [
      client.restoreCachedDocuments([], 'r'),
      client.applySourceBatch([], 'a'),
      client.applySourceBatch([], 'a2', { includeSnapshot: false }),
      client.analyzeBatch!([], 'b'),
      client.analyzeBatch!([], 'b2', { includeSnapshot: true }),
      client.applyFsDeltaBatch([], 'f'),
      client.setActiveOverlay({ path: 'a.md', source: '', revision: '1' }, 'o'),
      client.clearActiveOverlay('a.md', 'c'),
      client.requestSnapshot('s'),
    ];
    expect(worker.posted.map((m) => m.type)).toEqual([
      'initialize', 'restoreCachedDocuments', 'applySourceBatch', 'applySourceBatch', 'applySourceBatch',
      'applySourceBatch', 'applyFsDeltaBatch', 'setActiveOverlay', 'clearActiveOverlay', 'requestSnapshot',
    ]);
    expect(worker.posted[3].includeSnapshot).toBe(false);
    expect('includeSnapshot' in worker.posted[2]).toBe(false);
    expect(worker.posted[5].includeSnapshot).toBe(true);
    for (const id of ['r', 'a', 'a2', 'b', 'b2', 'f', 'o', 'c']) worker.emit({ type: 'complete', jobId: id, snapshot: null });
    worker.emit({ type: 'cancelled', jobId: 's' });
    worker.emit({ type: 'progress', jobId: 'x', completed: 1, total: 1 });
    worker.emit({ type: 'complete', jobId: 'unknown', snapshot: null });
    await Promise.all(jobs);
    expect(events.length).toBe(11);
    off();
    worker.emit({ type: 'progress', jobId: 'x', completed: 1, total: 1 });
    expect(events.length).toBe(11);
    client.cancel('a');
    client.cancel();
    expect(worker.posted.at(-2)).toEqual({ type: 'cancel', jobId: 'a' });
    expect(worker.posted.at(-1)).toEqual({ type: 'cancel' });
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('generates job ids when none are passed', async () => {
    const client = createInsightsWorkerClient({ createWorker: () => worker });
    const pending = [
      client.restoreCachedDocuments([]),
      client.applySourceBatch([]),
      client.analyzeBatch!([]),
      client.applyFsDeltaBatch([]),
      client.setActiveOverlay({ path: 'a.md', source: '', revision: '1' }),
      client.clearActiveOverlay('a.md'),
      client.requestSnapshot(),
    ];
    for (const message of worker.posted) worker.emit({ type: 'complete', jobId: message.jobId, snapshot: null });
    await Promise.all(pending);
    expect(worker.posted.every((m) => typeof m.jobId === 'string' && m.jobId.length > 0)).toBe(true);
    client.dispose();
  });

  it('rejects jobs on error messages, worker errors, post failures, timeouts and disposal', async () => {
    vi.useFakeTimers();
    const client = createInsightsWorkerClient({ createWorker: () => worker });
    const events: any[] = [];
    client.onEvent((event) => events.push(event));

    const errored = client.requestSnapshot('e');
    worker.emit({ type: 'error', jobId: 'e', message: 'boom' });
    await expect(errored).rejects.toThrow('boom');

    const crashed = client.requestSnapshot('w');
    worker.fail({ message: 'crash' });
    await expect(crashed).rejects.toThrow('crash');
    const crashedDefault = client.requestSnapshot('w2');
    worker.fail(new Event('error'));
    await expect(crashedDefault).rejects.toThrow('Insights worker error');
    expect(events.filter((e) => e.type === 'error').map((e) => e.message)).toEqual(['boom', 'crash', 'Insights worker error']);

    const timedOut = client.requestSnapshot('t');
    vi.advanceTimersByTime(30000);
    await expect(timedOut).rejects.toThrow('Worker job t timed out');

    worker.throwOnPost = true;
    await expect(client.requestSnapshot('p')).rejects.toThrow('post failed');
    expect(() => client.initialize()).not.toThrow();
    expect(() => client.cancel('p')).not.toThrow();
    worker.throwOnPost = false;

    const disposed = client.requestSnapshot('d');
    client.dispose();
    await expect(disposed).rejects.toThrow('Insights worker disposed');
    worker.emit({ type: 'complete', jobId: 'd', snapshot: null });
    worker.fail({ message: 'late' });
    expect(events.filter((e) => e.type === 'error').length).toBe(3);
  });

  it('wraps non-Error post failures', async () => {
    const throwing = { ...worker, postMessage() { throw 'nope'; }, addEventListener() {}, terminate() {} };
    const client = createInsightsWorkerClient({ createWorker: () => throwing as any });
    await expect(client.requestSnapshot('x')).rejects.toThrow('nope');
    client.dispose();
  });

  it('falls back to the degraded client when constructing the Worker throws', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('no workers'); } });
    const yieldSpy = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    vi.stubGlobal('scheduler', { yield: yieldSpy });
    const client = createInsightsWorkerClient();
    expect(client.mode).toBe('degraded');
    const docs = Array.from({ length: 10 }, (_, i) => ({ path: `d${i}.md`, source: `# D${i}`, revision: '1' }));
    await client.applySourceBatch(docs, 'job');
    expect(yieldSpy).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('degraded client uses setTimeout when scheduler.yield is unavailable', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('no workers'); } });
    vi.stubGlobal('scheduler', undefined);
    const client = createInsightsWorkerClient();
    const events: any[] = [];
    client.onEvent((event) => events.push(event));
    client.initialize();
    const docs = Array.from({ length: 11 }, (_, i) => ({ path: `d${i}.md`, source: `# D${i}`, revision: '1' }));
    await client.analyzeBatch!(docs);
    expect(events.filter((e) => e.type === 'documentResults').length).toBe(2);
    await client.applyFsDeltaBatch([
      { kind: 'delete', relativePath: 'd0.md' } as any,
      { kind: 'create', relativePath: 'z.md' } as any,
    ]);
    expect(events.at(-1).snapshot.documents.has('d0.md')).toBe(false);
    await client.clearActiveOverlay('d1.md');
    await client.requestSnapshot();
    await client.restoreCachedDocuments([]);
    await client.setActiveOverlay({ path: 'd1.md', source: '# o', revision: '2' });
    client.cancel();
    client.dispose();
    await client.applySourceBatch([{ path: 'x.md', source: '', revision: '1' }], 'after');
    expect(events.at(-1).type).not.toBe('cancelled');
  });

  it('degraded client emits cancelled when a job is cancelled mid-batch', async () => {
    let client!: ReturnType<typeof createInsightsWorkerClient>;
    client = createInsightsWorkerClient({
      createWorker: () => { throw new Error('blocked'); },
      yieldControl: async () => { client.cancel('job'); },
    });
    const events: any[] = [];
    client.onEvent((event) => events.push(event));
    const docs = Array.from({ length: 12 }, (_, i) => ({ path: `d${i}.md`, source: `# D${i}`, revision: '1' }));
    await client.applySourceBatch(docs, 'job');
    expect(events.at(-1)).toEqual({ type: 'cancelled', jobId: 'job' });
    client.dispose();
  });
});
