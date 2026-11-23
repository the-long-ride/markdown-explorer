import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { InsightsWorkerClient } from '../../../../ui/src/insights/workerClient';
import type { InsightsWorkerOutput } from '../../../../ui/src/insights/workerProtocol';
import { useWorkspaceInsights } from '../../../../ui/src/insights/useWorkspaceInsights';

type ReadResponse = Record<string, unknown> | 'throw' | 'hang';

function entry(relativePath: string, extra: Record<string, unknown> = {}) {
  return { relativePath, canonicalRelativePath: relativePath, kind: 'file', sizeBytes: 4, mtimeMs: 1, extension: '.md', ...extra };
}

function snapshot(revision: number) {
  return {
    documents: new Map(), outboundLinks: new Map(), backlinks: new Map(), brokenLinks: [],
    tags: new Map(), headings: new Map(), titles: new Map(), revision,
  } as any;
}

function createHarness(config: {
  entries?: Record<string, unknown>[];
  reads?: Record<string, ReadResponse>;
  scanComplete?: Record<string, unknown>;
  scanHang?: boolean;
  scanError?: boolean;
} = {}) {
  const listeners = new Set<(message: any) => void>();
  const posted: any[] = [];
  const emit = (message: any) => { for (const listener of [...listeners]) listener(message); };
  const bridge: PlatformBridge = {
    postMessage(message: any) {
      posted.push(message);
      if (message.command === 'scanInsightsWorkspace' && config.scanError) throw new Error('scan exploded');
      if (message.command === 'scanInsightsWorkspace' && !config.scanHang) queueMicrotask(() => {
        emit({ command: 'insightsScanBatch', requestId: message.requestId, entries: config.entries ?? [entry('a.md')], scannedEntries: (config.entries ?? [1]).length, excludedEntries: 0 });
        emit({ command: 'insightsScanComplete', requestId: message.requestId, totalEntries: 0, excludedEntries: 0, skippedEntries: 0, truncated: false, ...config.scanComplete });
      });
      if (message.command === 'readInsightsDocumentSource') {
        const response = config.reads?.[message.relativePath] ?? { status: 'ok', source: `# ${message.relativePath}\n`, sizeBytes: 4, mtimeMs: 1 };
        if (response === 'hang') return;
        if (response === 'throw') throw new Error(`read failed ${message.relativePath}`);
        queueMicrotask(() => emit({ command: 'insightsDocumentSourceResult', requestId: message.requestId, relativePath: message.relativePath, ...response }));
      }
    },
    onMessage(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  };
  const workerListeners = new Set<(event: InsightsWorkerOutput) => void>();
  let revision = 0;
  const fire = (event: any) => { for (const listener of [...workerListeners]) listener(event); };
  const complete = (jobId: string) => fire({ type: 'complete', jobId, snapshot: snapshot(++revision) });
  const worker = {
    mode: 'worker',
    onEvent(listener: any) { workerListeners.add(listener); return () => workerListeners.delete(listener); },
    initialize: vi.fn(),
    restoreCachedDocuments: vi.fn(async (_docs: unknown, jobId = 'restore') => complete(jobId)),
    applySourceBatch: vi.fn(async (_docs: unknown, jobId = 'batch') => complete(jobId)),
    applyFsDeltaBatch: vi.fn(async (_deltas: unknown, jobId = 'delta') => complete(jobId)),
    setActiveOverlay: vi.fn(async (_doc: unknown, jobId = 'overlay') => complete(jobId)),
    clearActiveOverlay: vi.fn(async (_path: unknown, jobId = 'clear') => complete(jobId)),
    requestSnapshot: vi.fn(async (jobId = 'snapshot') => complete(jobId)),
    cancel: vi.fn(),
    dispose: vi.fn(),
  } as unknown as InsightsWorkerClient & Record<string, ReturnType<typeof vi.fn>>;
  return { bridge, worker, posted, emit, fire };
}

afterEach(() => { vi.useRealTimers(); });

describe('useWorkspaceInsights lifecycle branches', () => {
  it('is inert without a workspace key', async () => {
    const harness = createHarness();
    const factory = vi.fn(() => harness.worker);
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: null, createWorkerClient: factory }));
    await act(async () => { await result.current.open(); });
    expect(result.current.panelOpen).toBe(true);
    expect(factory).not.toHaveBeenCalled();
    await act(async () => { await result.current.refreshLocal(); });
    expect(harness.posted.some(m => m.command === 'scanInsightsWorkspace')).toBe(false);
    await act(async () => { await result.current.clearActiveOverlay('a.md'); });
  });

  it('records read warnings, skips unchanged hashes and non-ok sources', async () => {
    const harness = createHarness({
      entries: [entry('a.md'), entry('bad.md'), entry('boom.md'), entry('img.png', { extension: '.png' }), { relativePath: 'dir', kind: 'directory' }],
      reads: { 'bad.md': { status: 'too-large' }, 'boom.md': 'throw' },
    });
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const reasons = result.current.warnings.map(w => w.reason);
    expect(reasons).toContain('too-large');
    expect(reasons.some(r => r.includes('read failed boom.md'))).toBe(true);
    expect(harness.posted.filter(m => m.command === 'readInsightsDocumentSource').map(m => m.relativePath)).not.toContain('img.png');
    const batches = harness.worker.applySourceBatch.mock.calls.length;
    await act(async () => { await result.current.refreshLocal(); });
    expect(harness.worker.applySourceBatch.mock.calls.length).toBeGreaterThan(batches);
    harness.worker.applySourceBatch.mockClear();
    // a non-forced rescan with identical hashes analyzes nothing and requests a final snapshot
    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');
    await act(async () => { await result.current.open(); });
    expect(result.current.status).toBe('ready');
  });

  it('requests a final snapshot when the last batch has no valid items and reports truncation', async () => {
    const harness = createHarness({ entries: [entry('bad.md')], reads: { 'bad.md': { status: 'unreadable' } }, scanComplete: { truncated: true, totalEntries: 3 } });
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    await waitFor(() => expect(harness.worker.requestSnapshot).toHaveBeenCalled());
    expect(result.current.warnings.map(w => w.reason)).toContain('scan-truncated');
    expect(result.current.progress).toEqual({ completed: 3, total: 3, provisional: false });
  });

  it('surfaces scan errors', async () => {
    const harness = createHarness({ scanError: true });
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.open(); });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.warnings.length).toBeGreaterThan(0);
  });

  it('handles worker progress, error and snapshot debounce events', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const harness = createHarness({ scanHang: true });
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { void result.current.open(); await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.status).toBe('indexing');
    act(() => harness.fire({ type: 'progress', jobId: 'j', completed: 1, total: 4 }));
    expect(result.current.progress).toEqual({ completed: 1, total: 4, provisional: true });
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(5) }));
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(6) }));
    act(() => harness.fire({ type: 'complete', jobId: 'j' }));
    expect(result.current.snapshot.revision).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(130); });
    expect(result.current.snapshot.revision).toBe(6);
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(7) }));
    act(() => result.current.closePanel());
    expect(result.current.status).toBe('paused');
    expect(harness.worker.cancel).not.toHaveBeenCalled();
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(8) }));
    expect(result.current.snapshot.revision).toBe(8);
    await act(async () => { void result.current.open(); await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.status).not.toBe('indexing');
    act(() => harness.fire({ type: 'error', jobId: 'j', message: 'worker died' }));
    expect(result.current.status).toBe('error');
    expect(result.current.warnings).toContainEqual({ reason: 'worker died' });
  });

  it('clears a pending snapshot timer on close and dispose', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const harness = createHarness({ scanHang: true });
    const { result, unmount } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { void result.current.open(); await vi.advanceTimersByTimeAsync(1); });
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(2) }));
    act(() => result.current.closePanel());
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.snapshot.revision).toBe(0);
    await act(async () => { void result.current.open(); await vi.advanceTimersByTimeAsync(1); });
    act(() => result.current.pause());
    await act(async () => { void result.current.refreshLocal(); await vi.advanceTimersByTimeAsync(1); });
    act(() => harness.fire({ type: 'complete', jobId: 'j', snapshot: snapshot(3) }));
    act(() => result.current.dispose());
    act(() => result.current.dispose());
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(harness.worker.dispose).toHaveBeenCalledTimes(1);
    expect(await result.current.checkExternalLinks(['https://x.test'])).toEqual([]);
    await act(async () => { await result.current.open(); });
    unmount();
  });

  it('processes host fs deltas for the current workspace operation', async () => {
    const harness = createHarness({ entries: [entry('a.md'), entry('old.md')], reads: { 'gone.md': { status: 'missing' } } });
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', workspaceOperationId: 'op-1', createWorkerClient: () => harness.worker }));
    // deltas before open are ignored
    act(() => harness.emit({ command: 'insightsFsDelta', deltas: [] }));
    await act(async () => { await result.current.open(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    harness.worker.applyFsDeltaBatch.mockClear();
    harness.worker.applySourceBatch.mockClear();
    act(() => harness.emit({ command: 'insightsFsDelta', workspaceOperationId: 'other', deltas: [{ kind: 'delete', relativePath: 'a.md' }] }));
    act(() => harness.emit({ command: 'somethingElse' }));
    expect(harness.worker.applyFsDeltaBatch).not.toHaveBeenCalled();
    await act(async () => {
      harness.emit({ command: 'insightsFsDelta', workspaceOperationId: 'op-1', deltas: [
        { kind: 'delete', relativePath: 'a.md' },
        { kind: 'rename', previousRelativePath: 'old.md', entry: entry('new.md') },
        { kind: 'rename', previousRelativePath: 'pic.png', entry: entry('pic2.png', { extension: '.png' }) },
        { kind: 'upsert', entry: entry('added.md') },
        { kind: 'upsert', entry: entry('gone.md') },
        { kind: 'upsert', entry: { relativePath: 'folder', kind: 'directory' } },
      ] });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    await waitFor(() => expect(harness.worker.applySourceBatch).toHaveBeenCalled());
    expect(harness.worker.applyFsDeltaBatch.mock.calls[0][0]).toHaveLength(3);
    expect(harness.worker.applySourceBatch.mock.calls[0][0].map((d: any) => d.path).sort()).toEqual(['added.md', 'new.md']);
    harness.worker.applyFsDeltaBatch.mockClear();
    harness.worker.applySourceBatch.mockClear();
    await act(async () => {
      harness.emit({ command: 'insightsFsDelta', deltas: [{ kind: 'upsert', entry: entry('gone.md') }] });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(harness.worker.applyFsDeltaBatch).not.toHaveBeenCalled();
    expect(harness.worker.applySourceBatch).not.toHaveBeenCalled();
    act(() => result.current.dispose());
    act(() => harness.emit({ command: 'insightsFsDelta', deltas: [{ kind: 'delete', relativePath: 'x.md' }] }));
  });

  it('manages overlays, external checks and private origin approvals', async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useWorkspaceInsights({ bridge: harness.bridge, workspaceKey: '/w', createWorkerClient: () => harness.worker }));
    await act(async () => { await result.current.clearActiveOverlay('a.md'); });
    expect(harness.worker.clearActiveOverlay).not.toHaveBeenCalled();
    await act(async () => { await result.current.applyActiveOverlay({ path: 'a.md', source: '# A', revision: 'r' }); });
    await act(async () => { await result.current.clearActiveOverlay('a.md'); });
    expect(harness.worker.setActiveOverlay).toHaveBeenCalled();
    expect(harness.worker.clearActiveOverlay).toHaveBeenCalledWith('a.md', expect.any(String));
    act(() => result.current.approvePrivateOrigin('http://10.0.0.1'));
    expect(result.current.approvedPrivateOrigins.has('http://10.0.0.1')).toBe(true);
    act(() => result.current.cancelExternalChecks());
    expect(result.current.getWikiResolverContext('a.md')).toBeTruthy();
  });
});
