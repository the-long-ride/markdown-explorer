import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Ctx = { postMessage: ReturnType<typeof vi.fn>; onmessage: ((event: { data: any }) => void) | null };

async function loadWorker(): Promise<Ctx> {
  const ctx: Ctx = { postMessage: vi.fn(), onmessage: null };
  vi.stubGlobal('self', ctx);
  vi.resetModules();
  await import('../../../../ui/src/insights/insights.worker');
  return ctx;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sent = (ctx: Ctx) => ctx.postMessage.mock.calls.map(([m]) => m);

describe('insights worker entry', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await loadWorker(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('analyzes batches with progress, documentResults and snapshots', async () => {
    ctx.onmessage!({ data: { type: 'initialize' } });
    ctx.onmessage!({ data: { type: 'initialize', settings: {} } });
    ctx.onmessage!({ data: { type: 'updateConfig', settings: {} } });
    const documents = Array.from({ length: 26 }, (_, i) => ({ path: `d${i}.md`, source: `# D${i}\n[[d0]]`, revision: '1' }));
    ctx.onmessage!({ data: { type: 'applySourceBatch', jobId: 'a', documents } });
    await flush(); await flush();
    const messages = sent(ctx);
    expect(messages.filter((m) => m.type === 'documentResults').length).toBe(2);
    expect(messages.filter((m) => m.type === 'progress').map((m) => m.completed)).toEqual([25, 26]);
    const complete = messages.find((m) => m.type === 'complete');
    expect(complete.snapshot.documents.size).toBe(26);

    ctx.postMessage.mockClear();
    ctx.onmessage!({ data: { type: 'analyze-batch', jobId: 'b', documents: documents.slice(0, 1), includeSnapshot: false } });
    await flush();
    const done = sent(ctx).find((m) => m.type === 'complete');
    expect(done.snapshot).toBeNull();
    expect(done.analyzed).toHaveLength(1);
  });

  it('handles cancellation, cache restore, fs deltas, overlays and snapshots', async () => {
    const documents = Array.from({ length: 30 }, (_, i) => ({ path: `d${i}.md`, source: `# D${i}`, revision: '1' }));
    ctx.onmessage!({ data: { type: 'applySourceBatch', jobId: 'c', documents } });
    ctx.onmessage!({ data: { type: 'cancel', jobId: 'c' } });
    ctx.onmessage!({ data: { type: 'cancel' } });
    await flush(); await flush();
    expect(sent(ctx).at(-1)).toEqual({ type: 'cancelled', jobId: 'c' });

    const { analyzeDocument } = await import('../../../../ui/src/insights/analyzeDocument');
    const cached = analyzeDocument({ path: 'cached.md', source: '# Cached', revision: 'r' });
    ctx.onmessage!({ data: { type: 'restoreCachedDocuments', jobId: 'r', documents: [cached.persisted] } });
    expect(sent(ctx).at(-1).snapshot.documents.has('cached.md')).toBe(true);

    ctx.onmessage!({ data: { type: 'applyFsDeltaBatch', jobId: 'f', deltas: [
      { kind: 'delete', relativePath: 'd0.md' },
      { kind: 'rename', previousRelativePath: 'd1.md', entry: { relativePath: 'moved.md', canonicalRelativePath: '' } },
      { kind: 'rename', previousRelativePath: 'd2.md', entry: { relativePath: 'x.md', canonicalRelativePath: 'canon.md' } },
      { kind: 'create', relativePath: 'new.md' },
    ] } });
    const snap = sent(ctx).at(-1).snapshot;
    expect(snap.documents.has('d0.md')).toBe(false);
    expect(snap.documents.has('moved.md')).toBe(true);
    expect(snap.documents.has('canon.md')).toBe(true);

    ctx.onmessage!({ data: { type: 'setActiveOverlay', jobId: 'o', document: { path: 'd3.md', source: '# Overlay', revision: 'o' } } });
    expect(sent(ctx).at(-1).snapshot.documents.get('d3.md').revision).toBe('o');
    ctx.onmessage!({ data: { type: 'clearActiveOverlay', jobId: 'oc', path: 'd3.md' } });
    expect(sent(ctx).at(-1).jobId).toBe('oc');
    ctx.onmessage!({ data: { type: 'requestSnapshot', jobId: 's' } });
    expect(sent(ctx).at(-1)).toEqual(expect.objectContaining({ type: 'complete', jobId: 's' }));
    ctx.onmessage!({ data: { type: 'unknown' } });
  });

  it('reports synchronous and asynchronous failures as error messages', async () => {
    ctx.onmessage!({ data: { type: 'restoreCachedDocuments', jobId: 'bad', documents: null } });
    expect(sent(ctx).at(-1)).toEqual(expect.objectContaining({ type: 'error', jobId: 'bad' }));
    ctx.onmessage!({ data: { type: 'applyFsDeltaBatch', deltas: null } });
    expect(sent(ctx).at(-1).jobId).toBeUndefined();
    ctx.onmessage!({ data: { type: 'setActiveOverlay', jobId: 'thrown', get document() { throw 'raw'; } } });
    expect(sent(ctx).at(-1)).toEqual({ type: 'error', jobId: 'thrown', message: 'raw' });
    ctx.onmessage!({ data: { type: 'applySourceBatch', jobId: 'async', documents: [null] } });
    await flush();
    expect(sent(ctx).at(-1)).toEqual(expect.objectContaining({ type: 'error', jobId: 'async' }));
  });
});
