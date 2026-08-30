import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { createInsightsWorkerClient } from '../../../../ui/src/insights/workerClient';

describe('Insights worker client', () => {
  it('reports degraded mode when Worker construction fails', () => {
    const client = createInsightsWorkerClient({ createWorker: () => { throw new Error('blocked'); } });
    expect(client.mode).toBe('degraded');
    client.dispose();
  });

  it('fallback batches source work and emits provisional results before complete', async () => {
    const client = createInsightsWorkerClient({ createWorker: () => { throw new Error('blocked'); }, yieldControl: async () => {} });
    const events: any[] = [];
    client.onEvent(event => events.push(event));
    await client.applySourceBatch([
      { path: 'a.md', source: '# A', revision: '1' },
      { path: 'b.md', source: '# B', revision: '1' },
    ], 'job');
    expect(events.some(event => event.type === 'documentResults')).toBe(true);
    expect(events.at(-1)?.type).toBe('complete');
    client.dispose();
  });

  it('restores persisted documents provisionally and live disk analysis replaces them', async () => {
    const client = createInsightsWorkerClient({ createWorker: () => { throw new Error('blocked'); }, yieldControl: async () => {} });
    const events: any[] = [];
    client.onEvent(event => events.push(event));
    const cached = analyzeDocument({ path: 'a.md', source: '# Cached\nold body', revision: 'cache' });

    await (client as any).restoreCachedDocuments([cached.persisted], 'restore');
    let snapshot = events.at(-1).snapshot;
    expect(snapshot.documents.get('a.md')).toEqual(expect.objectContaining({
      revision: 'cache',
      title: 'Cached',
      terminology: [],
    }));
    expect(snapshot.documents.get('a.md').sections[0].text).toBe('');

    await client.applySourceBatch([{ path: 'a.md', source: '# Live\nnew body', revision: 'disk' }], 'live');
    snapshot = events.at(-1).snapshot;
    expect(snapshot.documents.get('a.md').revision).toBe('disk');
    expect(snapshot.documents.get('a.md').title).toBe('Live');
    expect(snapshot.documents.get('a.md').sections[0].text).toBe('new body');
    client.dispose();
  });

  it('fallback supports active overlay replacement and cancellation', async () => {
    const client = createInsightsWorkerClient({ createWorker: () => { throw new Error('blocked'); }, yieldControl: async () => {} });
    const events: any[] = [];
    client.onEvent(event => events.push(event));
    await client.applySourceBatch([{ path: 'a.md', source: '[[B]]', revision: 'disk' }], 'seed');
    await client.setActiveOverlay({ path: 'a.md', source: '[[C]]', revision: 'overlay' }, 'overlay');
    const snapshot = events.at(-1).snapshot;
    expect(snapshot.documents.get('a.md').revision).toBe('overlay');
    client.cancel('cancelled');
    client.dispose();
  });
});
