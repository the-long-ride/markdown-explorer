import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import {
  createInsightsCacheAnalysisSignature,
  INSIGHTS_ANALYZER_COMPONENT_VERSION,
  InsightsCacheStore,
} from '../../../../ui/src/insights/cache';

describe('InsightsCacheStore', () => {
  it('persists the sanitized analyzed document without source, readable section text, or session-only state', async () => {
    const factory = new IDBFactory();
    const store = new InsightsCacheStore({ indexedDB: factory, dbName: 'privacy-test' });
    const analyzed = analyzeDocument({
      path: 'a.md',
      source: '# A\nCACHE_SOURCE_BODY_SECRET unique readable terminology',
      revision: 'hash-a',
    });

    await store.putWorkspace({
      workspaceId: 'w',
      documents: [{ path: 'a.md', sizeBytes: 48, mtimeMs: 1, contentHash: 'hash-a', persisted: analyzed.persisted } as any],
      source: '# secret',
      externalSession: { url: 'https://x' },
      privateApprovals: { approved: true },
    });

    const cached = await store.getWorkspace('w');
    const serialized = JSON.stringify(cached);
    expect(cached?.documents[0]).toEqual(expect.objectContaining({
      path: 'a.md',
      contentHash: 'hash-a',
      persisted: expect.objectContaining({ title: 'A', revision: 'hash-a' }),
    }));
    expect(serialized).not.toContain('CACHE_SOURCE_BODY_SECRET');
    expect(serialized).not.toContain('unique readable terminology');
    expect(serialized).not.toContain('# secret');
    expect(serialized).not.toContain('externalSession');
    expect(serialized).not.toContain('privateApprovals');
    expect((cached?.documents[0] as any)?.persisted?.sections?.[0]).not.toHaveProperty('text');
    expect((cached?.documents[0] as any)?.persisted).not.toHaveProperty('terminology');
    await store.close();
  });

  it('invalidates incompatible analyzer components and defaults to a 500 MiB cap', async () => {
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'version-test' });
    expect(store.capBytes).toBe(500 * 1024 * 1024);
    await store.putWorkspace({ workspaceId: 'w', analyzerVersion: 1, documents: [] });
    expect(await store.getWorkspace('w', 2)).toBeUndefined();
    await store.close();
  });

  it('invalidates derived cache when analysis-affecting lint configuration changes', async () => {
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'analysis-signature-test' });
    const warningSignature = createInsightsCacheAnalysisSignature({
      'heading/skipped-level': { enabled: true, severity: 'warning' },
    });
    const errorSignature = createInsightsCacheAnalysisSignature({
      'heading/skipped-level': { enabled: true, severity: 'error' },
    });

    await store.putWorkspace({ workspaceId: 'w', analysisSignature: warningSignature, documents: [] });
    expect(await store.getWorkspace('w', INSIGHTS_ANALYZER_COMPONENT_VERSION, warningSignature)).toBeDefined();
    expect(await store.getWorkspace('w', INSIGHTS_ANALYZER_COMPONENT_VERSION, errorSignature)).toBeUndefined();
    await store.close();
  });

  it('creates stable analysis signatures regardless of lint-rule property order', () => {
    const left = createInsightsCacheAnalysisSignature({
      beta: { enabled: false, severity: 'error' },
      alpha: { enabled: true, severity: 'warning' },
    });
    const right = createInsightsCacheAnalysisSignature({
      alpha: { enabled: true, severity: 'warning' },
      beta: { enabled: false, severity: 'error' },
    });
    expect(left).toBe(right);
  });

  it('evicts older inactive workspace caches before the active workspace', async () => {
    let now = 1;
    const store = new InsightsCacheStore({ indexedDB: new IDBFactory(), dbName: 'lru-test', capBytes: 1200, now: () => now++ });
    const doc = (path: string) => {
      const persisted = analyzeDocument({ path, source: `# ${'x'.repeat(350)}`, revision: path }).persisted;
      return { path, sizeBytes: 1, mtimeMs: 1, persisted } as any;
    };
    await store.putWorkspace({ workspaceId: 'old', documents: [doc('old.md')] });
    await store.putWorkspace({ workspaceId: 'active', documents: [doc('active.md')] });
    expect(await store.getWorkspace('active')).toBeDefined();
    await store.close();
  });
});
