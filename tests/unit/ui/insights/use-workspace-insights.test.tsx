import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { InsightsWorkerClient } from '../../../../ui/src/insights/workerClient';
import { WorkspaceInsightsIndex, type WorkspaceInsightsSnapshot } from '../../../../ui/src/insights/index';
import type { InsightsWorkerOutput } from '../../../../ui/src/insights/workerProtocol';
import { analyzeDocument, type PersistedAnalyzedDocument } from '../../../../ui/src/insights/analyzeDocument';
import type { InsightsWorkspaceCache } from '../../../../ui/src/insights/cache';
import { useWorkspaceInsights } from '../../../../ui/src/insights/useWorkspaceInsights';
import { createWorkspaceInsightsCacheContext } from '../../../../ui/src/insights/workspaceInsightsSession';

function emptySnapshot(revision = 0): WorkspaceInsightsSnapshot {
  return {
    documents: new Map(), outboundLinks: new Map(), backlinks: new Map(), brokenLinks: [],
    tags: new Map(), headings: new Map(), titles: new Map(), revision,
  };
}

function restoreForHarness(persisted: PersistedAnalyzedDocument) {
  return {
    path: persisted.path,
    revision: persisted.revision,
    title: persisted.title,
    aliases: persisted.aliases,
    tags: persisted.tags,
    anchors: new Set(persisted.anchors),
    headings: persisted.headings,
    references: persisted.references,
    dynamicReferences: persisted.dynamicReferences,
    sections: persisted.sections.map(section => ({ ...section, text: '' })),
    diagrams: persisted.diagrams,
    exactFingerprint: persisted.exactFingerprint,
    terminology: [],
    terminologySignatures: persisted.terminologySignatures,
    lint: persisted.lint,
    persisted,
  };
}

function createHarness(cache?: InsightsWorkspaceCache, closeImpl: () => Promise<void> = async () => {}) {
  const listeners = new Set<(message: any) => void>();
  const posted: any[] = [];
  const bridge: PlatformBridge = {
    postMessage(message) {
      posted.push(message);
      if (message.command === 'scanInsightsWorkspace') queueMicrotask(() => {
        for (const listener of listeners) listener({
          command: 'insightsScanBatch', requestId: message.requestId,
          entries: [{ relativePath: 'a.md', canonicalRelativePath: 'a.md', kind: 'file', sizeBytes: 4, mtimeMs: 1, extension: '.md' }],
          scannedEntries: 1, excludedEntries: 0,
        });
        for (const listener of listeners) listener({
          command: 'insightsScanComplete', requestId: message.requestId,
          totalEntries: 1, excludedEntries: 0, skippedEntries: 0, truncated: false,
        });
      });
      if (message.command === 'readInsightsDocumentSource') queueMicrotask(() => {
        for (const listener of listeners) listener({
          command: 'insightsDocumentSourceResult', requestId: message.requestId,
          relativePath: message.relativePath, status: 'ok', source: '# A\n', sizeBytes: 4, mtimeMs: 1, contentHash: 'hash-a',
        });
      });
      if (message.command === 'checkExternalLinks') queueMicrotask(() => {
        for (const listener of listeners) listener({
          command: 'externalLinkCheckResult', requestId: message.requestId, url: message.urls[0], status: 'reachable', checkedAt: '2026-08-28T00:00:00Z',
        });
        for (const listener of listeners) listener({ command: 'externalLinkCheckComplete', requestId: message.requestId, cancelled: false });
      });
    },
    onMessage(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  };

  const workerListeners = new Set<(event: InsightsWorkerOutput) => void>();
  const index = new WorkspaceInsightsIndex();
  let snapshot = emptySnapshot();
  const complete = (jobId: string) => {
    snapshot = index.snapshot();
    for (const listener of workerListeners) listener({ type: 'complete', jobId, snapshot });
  };
  const worker: InsightsWorkerClient & { restoreCachedDocuments: ReturnType<typeof vi.fn> } = {
    mode: 'worker',
    onEvent(listener) { workerListeners.add(listener); return () => workerListeners.delete(listener); },
    initialize: vi.fn(),
    restoreCachedDocuments: vi.fn(async (documents: readonly PersistedAnalyzedDocument[], jobId = 'restore') => {
      for (const document of documents) index.applyDocument(restoreForHarness(document));
      complete(jobId);
    }),
    applySourceBatch: vi.fn(async (documents, jobId = 'batch') => {
      const analyzedDocuments = documents.map(document => analyzeDocument(document));
      for (const document of analyzedDocuments) index.applyDocument(document);
      for (const listener of workerListeners) listener({ type: 'documentResults', jobId, documents: analyzedDocuments });
      complete(jobId);
    }),
    applyFsDeltaBatch: vi.fn(async (deltas, jobId = 'delta') => {
      for (const delta of deltas) if (delta.kind === 'delete') index.removeDocument(delta.relativePath);
      complete(jobId);
    }),
    setActiveOverlay: vi.fn(async (document, jobId = 'overlay') => {
      index.applyActiveOverlay(analyzeDocument(document));
      complete(jobId);
    }),
    clearActiveOverlay: vi.fn(async (path, jobId = 'overlay-clear') => {
      index.clearActiveOverlay(path);
      complete(jobId);
    }),
    requestSnapshot: vi.fn(async (jobId = 'snapshot') => complete(jobId)),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };

  const cacheStore = {
    getWorkspace: vi.fn(async () => cache),
    putWorkspace: vi.fn(async () => {}),
    close: vi.fn(closeImpl),
  };

  return { bridge, worker, posted, cacheStore };
}

function cachedWorkspace(): InsightsWorkspaceCache {
  const a = analyzeDocument({ path: 'a.md', source: '# Cached A\n', revision: 'hash-a' }).persisted;
  const gone = analyzeDocument({ path: 'gone.md', source: '# Gone\n', revision: 'hash-gone' }).persisted;
  return {
    workspaceId: '/workspace',
    schemaVersion: 2,
    analyzerVersion: 1,
    updatedAt: 1,
    documents: [
      { path: 'a.md', sizeBytes: 4, mtimeMs: 1, contentHash: 'hash-a', persisted: a } as any,
      { path: 'gone.md', sizeBytes: 7, mtimeMs: 1, contentHash: 'hash-gone', persisted: gone } as any,
    ],
  };
}

describe('useWorkspaceInsights', () => {
  it('does not scan or start a worker until first Insights open', () => {
    const harness = createHarness();
    const workerFactory = vi.fn(() => harness.worker);
    renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/workspace', createWorkerClient: workerFactory }));
    expect(workerFactory).not.toHaveBeenCalled();
    expect(harness.posted.some(message => message.command === 'scanInsightsWorkspace')).toBe(false);
  });

  it('streams local sources into the worker and keeps completed state warm after close', async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/workspace', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    expect(harness.worker.applySourceBatch).toHaveBeenCalled();
    expect(result.current.snapshot.documents.size).toBe(1);
    act(() => result.current.closePanel());
    expect(result.current.snapshot.documents.size).toBe(1);
    expect(harness.posted).toContainEqual(expect.objectContaining({ command: 'setInsightsWatchState', visible: false }));
  });

  it('manual Refresh remains local-only and rereads eligible Markdown source', async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/workspace', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    const readsBefore = harness.posted.filter(message => message.command === 'readInsightsDocumentSource').length;
    await act(async () => { await result.current.refreshLocal(); });
    expect(harness.posted.filter(message => message.command === 'readInsightsDocumentSource').length).toBeGreaterThan(readsBefore);
    expect(harness.posted.some(message => message.command === 'checkExternalLinks')).toBe(false);
  });

  it('restores cached documents provisionally but still validates every first-open file from disk', async () => {
    const harness = createHarness(cachedWorkspace());
    const { result } = renderHook(() => useWorkspaceInsights({
      bridge: harness.bridge,
      workspaceKey: '/workspace',
      createWorkerClient: () => harness.worker,
      createCacheStore: () => harness.cacheStore as any,
    } as any));

    await act(async () => { await result.current.open(); });

    const cacheContext = createWorkspaceInsightsCacheContext('/workspace', {});
    expect(harness.worker.restoreCachedDocuments).toHaveBeenCalledTimes(1);
    expect(harness.worker.restoreCachedDocuments.mock.invocationCallOrder[0]).toBeLessThan(harness.worker.applySourceBatch.mock.invocationCallOrder[0]);
    expect(harness.posted.filter(message => message.command === 'readInsightsDocumentSource' && message.relativePath === 'a.md')).toHaveLength(1);
    expect(result.current.snapshot.documents.get('a.md')?.title).toBe('A');
    expect(result.current.snapshot.documents.has('gone.md')).toBe(false);
    expect(harness.cacheStore.getWorkspace).toHaveBeenCalledWith(cacheContext.workspaceId, cacheContext.analyzerVersion, cacheContext.analysisSignature);
    expect(harness.cacheStore.putWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      ...cacheContext,
      documents: [expect.objectContaining({ path: 'a.md', persisted: expect.objectContaining({ title: 'A' }) })],
    }));
  });

  it('never persists an active unsaved overlay into the cache', async () => {
    const harness = createHarness(cachedWorkspace());
    const { result } = renderHook(() => useWorkspaceInsights({
      bridge: harness.bridge,
      workspaceKey: '/workspace',
      createWorkerClient: () => harness.worker,
      createCacheStore: () => harness.cacheStore as any,
    } as any));
    await act(async () => { await result.current.open(); });
    await act(async () => { await result.current.applyActiveOverlay({ path: 'a.md', source: '# Unsaved Secret\nprivate words', revision: 'dirty-1' }); });

    const serializedWrites = JSON.stringify(harness.cacheStore.putWorkspace.mock.calls);
    expect(serializedWrites).not.toContain('Unsaved Secret');
    expect(serializedWrites).not.toContain('private words');
  });

  it('closes the cache non-fatally when the hook is disposed', async () => {
    const harness = createHarness(undefined, async () => { throw new Error('close failed'); });
    const { result, unmount } = renderHook(() => useWorkspaceInsights({
      bridge: harness.bridge,
      workspaceKey: '/workspace',
      createWorkerClient: () => harness.worker,
      createCacheStore: () => harness.cacheStore as any,
    } as any));
    await act(async () => { await result.current.open(); });
    expect(() => unmount()).not.toThrow();
    expect(harness.cacheStore.close).toHaveBeenCalledTimes(1);
  });

  it('applies and clears the active unsaved overlay without rescanning the workspace', async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/workspace', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    const scansBefore = harness.posted.filter(message => message.command === 'scanInsightsWorkspace').length;
    await act(async () => { await result.current.applyActiveOverlay({ path: 'a.md', source: '# Unsaved', revision: 'dirty-1' }); });
    await act(async () => { await result.current.clearActiveOverlay('a.md'); });
    expect(harness.worker.setActiveOverlay).toHaveBeenCalled();
    expect(harness.worker.clearActiveOverlay).toHaveBeenCalledWith('a.md', expect.any(String));
    expect(harness.posted.filter(message => message.command === 'scanInsightsWorkspace')).toHaveLength(scansBefore);
  });

  it('revalidates live documents before persisting a changed lint analysis signature', async () => {
    const harness = createHarness();
    const { result, rerender } = renderHook(
      ({ severity }: { severity: 'warning' | 'error' }) => useWorkspaceInsights({
        bridge: harness.bridge,
        workspaceKey: '/workspace',
        createWorkerClient: () => harness.worker,
        createCacheStore: () => harness.cacheStore as any,
        settings: { lintRules: { 'heading/skipped-level': { enabled: true, severity } } },
      }),
      { initialProps: { severity: 'warning' as const } },
    );
    await act(async () => { await result.current.open(); });
    const readsBefore = harness.posted.filter(message => message.command === 'readInsightsDocumentSource').length;
    const writesBefore = harness.cacheStore.putWorkspace.mock.calls.length;

    await act(async () => { rerender({ severity: 'error' }); });

    const expectedContext = createWorkspaceInsightsCacheContext('/workspace', {
      'heading/skipped-level': { enabled: true, severity: 'error' },
    });
    await waitFor(() => expect(harness.posted.filter(message => message.command === 'readInsightsDocumentSource').length).toBeGreaterThan(readsBefore));
    await waitFor(() => expect(harness.cacheStore.putWorkspace).toHaveBeenCalledWith(expect.objectContaining(expectedContext)));
    expect(harness.cacheStore.putWorkspace.mock.calls.length).toBeGreaterThan(writesBefore);
  });

  it('checks unique external URLs only when enabled and explicitly requested', async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useWorkspaceInsights({
      bridge: harness.bridge,
      workspaceKey: '/workspace',
      createWorkerClient: () => harness.worker,
      settings: { externalLinks: { enabled: true, timeoutMs: 10_000 } },
    }));
    await act(async () => { await result.current.checkExternalLinks(['https://example.test', 'https://example.test']); });
    const requests = harness.posted.filter(message => message.command === 'checkExternalLinks');
    expect(requests).toHaveLength(1);
    expect(requests[0].urls).toEqual(['https://example.test']);
    expect(result.current.externalResults.get('https://example.test')?.status).toBe('reachable');
  });
});
