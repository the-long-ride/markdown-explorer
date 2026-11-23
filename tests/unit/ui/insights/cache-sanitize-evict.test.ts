import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createInsightsCacheAnalysisSignature, InsightsCacheStore } from '../../../../ui/src/insights/cache';

const sparse = { path: 7, revision: null, headings: [null, { text: 'H', level: '2', sourceStart: 'x', sourceEnd: 9 }], sections: [{}], diagrams: [null, { status: 'invalid', code: 'graph', sourceStart: 1, sourceEnd: 2, fingerprint: 'f' }], references: [{ to: 'b' }], dynamicReferences: [{ x: 1 }], lint: [{ rule: 'r' }], aliases: [1], tags: ['t'], anchors: ['a'], terminologySignatures: [2] };

describe('InsightsCacheStore sanitization and eviction', () => {
  it('requires IndexedDB', () => {
    const original = globalThis.indexedDB;
    (globalThis as any).indexedDB = undefined;
    try {
      expect(() => new InsightsCacheStore()).toThrow('IndexedDB is unavailable');
    } finally {
      (globalThis as any).indexedDB = original;
    }
  });

  it('normalizes sparse persisted documents', async () => {
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'sparse', now: () => 42 });
    await store.putWorkspace({ workspaceId: 'w', documents: [
      { path: 'a.md', sizeBytes: -5, mtimeMs: 'x', persisted: sparse, lastAccessedAt: 'bad' } as any,
      { path: 'b.md', sizeBytes: 1, mtimeMs: 1, contentHash: 'h', persisted: {} } as any,
    ] } as any);
    const cached = await store.getWorkspace('w');
    expect(cached?.updatedAt).toBe(42);
    const [a, b] = cached!.documents;
    expect(a).toMatchObject({ sizeBytes: 0, mtimeMs: 0, lastAccessedAt: 0 });
    expect(a.persisted).toMatchObject({ path: '7', revision: '', aliases: ['1'], terminologySignatures: ['2'], references: [{ to: 'b' }], lint: [{ rule: 'r' }] });
    expect((a.persisted as any).headings[0]).toMatchObject({ text: '', level: 0 });
    expect((a.persisted as any).diagrams[1]).toMatchObject({ status: 'invalid', code: 'graph' });
    expect((a.persisted as any).diagrams[0]).toMatchObject({ status: 'valid', code: undefined });
    expect(b.contentHash).toBe('h');
    expect(b.persisted).toMatchObject({ aliases: [], headings: [], sections: [], diagrams: [], references: [], lint: [] });
    await store.clear();
    expect(await store.getWorkspace('w')).toBeUndefined();
    await store.close();
    await store.close();
  });

  it('drops caches written for another analysis signature', async () => {
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'sig' });
    await store.putWorkspace({ workspaceId: 'w', documents: [] } as any);
    const other = createInsightsCacheAnalysisSignature({ lintRules: { x: { enabled: false } } } as any);
    expect(await store.getWorkspace('w', undefined, other)).toBeUndefined();
    expect(await store.getWorkspace('w')).toBeUndefined();
  });

  it('evicts older workspaces first, then least recently used active documents', async () => {
    const big = (n: number) => ({ path: `d${n}.md`, sizeBytes: 1, mtimeMs: 1, lastAccessedAt: n, persisted: { title: 'x'.repeat(400) } });
    let clock = 0;
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'cap', capBytes: 1200, now: () => ++clock });
    await store.putWorkspace({ workspaceId: 'old', documents: [big(1), big(2)] } as any);
    await store.putWorkspace({ workspaceId: 'active', documents: [big(3), big(1), big(2)] } as any);
    expect(await store.getWorkspace('old')).toBeUndefined();
    const active = await store.getWorkspace('active');
    expect(active?.documents.length).toBeLessThan(3);
    expect(active?.documents.map(d => d.path)).not.toContain('d1.md');
  });
});
