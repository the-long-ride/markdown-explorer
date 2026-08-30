import { analyzeDocument, restorePersistedAnalyzedDocument, type PersistedAnalyzedDocument } from './analyzeDocument.ts';
import { normalizeInsightsSettings, type InsightsSettings } from './config.ts';
import { WorkspaceInsightsIndex } from './index.ts';
import type { InsightsFsDelta } from './contracts.ts';
import type { InsightsWorkerInput, InsightsWorkerOutput, InsightsSourceInput } from './workerProtocol.ts';

interface WorkerLike {
  postMessage(message: InsightsWorkerInput): void;
  terminate(): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<InsightsWorkerOutput>) => void): void;
  removeEventListener?(type: 'message', listener: (event: MessageEvent<InsightsWorkerOutput>) => void): void;
}

export interface InsightsWorkerClient {
  readonly mode: 'worker' | 'degraded';
  onEvent(listener: (event: InsightsWorkerOutput) => void): () => void;
  initialize(settings?: Partial<InsightsSettings>): void;
  restoreCachedDocuments(documents: readonly PersistedAnalyzedDocument[], jobId?: string): Promise<void>;
  applySourceBatch(documents: readonly InsightsSourceInput[], jobId?: string): Promise<void>;
  applyFsDeltaBatch(deltas: readonly InsightsFsDelta[], jobId?: string): Promise<void>;
  setActiveOverlay(document: InsightsSourceInput, jobId?: string): Promise<void>;
  clearActiveOverlay(path: string, jobId?: string): Promise<void>;
  requestSnapshot(jobId?: string): Promise<void>;
  cancel(jobId?: string): void;
  dispose(): void;
}

export interface CreateInsightsWorkerClientOptions {
  readonly createWorker?: () => WorkerLike;
  readonly yieldControl?: () => Promise<void>;
}

function id(prefix = 'insights'): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function defaultYield(): Promise<void> {
  const scheduler = (globalThis as any).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
}

function createDegradedClient(yieldControl: () => Promise<void>): InsightsWorkerClient {
  const listeners = new Set<(event: InsightsWorkerOutput) => void>();
  const index = new WorkspaceInsightsIndex();
  let settings = normalizeInsightsSettings();
  const cancelled = new Set<string>();
  let disposed = false;
  const emit = (event: InsightsWorkerOutput) => { if (!disposed) for (const listener of listeners) listener(event); };

  const apply = async (documents: readonly InsightsSourceInput[], jobId = id('batch')) => {
    cancelled.delete(jobId);
    const batch = [];
    for (let i = 0; i < documents.length; i += 1) {
      if (cancelled.has(jobId) || disposed) { emit({ type: 'cancelled', jobId }); return; }
      const analyzed = analyzeDocument({ ...documents[i], lintRules: settings.lintRules });
      index.applyDocument(analyzed); batch.push(analyzed);
      if (batch.length >= 10 || i === documents.length - 1) emit({ type: 'documentResults', jobId, documents: batch.splice(0) });
      emit({ type: 'progress', jobId, completed: i + 1, total: documents.length });
      if ((i + 1) % 10 === 0) await yieldControl();
    }
    emit({ type: 'complete', jobId, snapshot: index.snapshot() });
  };
  return {
    mode: 'degraded',
    onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    initialize(next) { settings = normalizeInsightsSettings(next ?? {}); },
    async restoreCachedDocuments(documents, jobId = id('restore-cache')) {
      for (const document of documents) index.applyDocument(restorePersistedAnalyzedDocument(document));
      emit({ type: 'complete', jobId, snapshot: index.snapshot() });
    },
    applySourceBatch: apply,
    async applyFsDeltaBatch(deltas, jobId = id('fs-delta')) { for (const delta of deltas) if (delta.kind === 'delete') index.removeDocument(delta.relativePath); emit({ type: 'complete', jobId, snapshot: index.snapshot() }); },
    async setActiveOverlay(document, jobId = id('overlay')) { index.applyActiveOverlay(analyzeDocument({ ...document, lintRules: settings.lintRules })); emit({ type: 'complete', jobId, snapshot: index.snapshot() }); },
    async clearActiveOverlay(path, jobId = id('overlay-clear')) { index.clearActiveOverlay(path); emit({ type: 'complete', jobId, snapshot: index.snapshot() }); },
    async requestSnapshot(jobId = id('snapshot')) { emit({ type: 'complete', jobId, snapshot: index.snapshot() }); },
    cancel(jobId) { if (jobId) cancelled.add(jobId); },
    dispose() { disposed = true; listeners.clear(); cancelled.clear(); },
  };
}

export function createChunkedInsightsFallback(options: Pick<CreateInsightsWorkerClientOptions, 'yieldControl'> = {}): InsightsWorkerClient {
  return createDegradedClient(options.yieldControl ?? defaultYield);
}

export function createInsightsWorkerClient(options: CreateInsightsWorkerClientOptions = {}): InsightsWorkerClient {
  let worker: WorkerLike;
  try {
    worker = options.createWorker?.() ?? new Worker(new URL('./insights.worker.ts', import.meta.url), { type: 'module', name: 'workspace-insights' });
  } catch {
    return createDegradedClient(options.yieldControl ?? defaultYield);
  }
  const listeners = new Set<(event: InsightsWorkerOutput) => void>();
  const waiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  let disposed = false;
  const handle = (event: MessageEvent<InsightsWorkerOutput>) => {
    if (disposed) return;
    const message = event.data;
    for (const listener of listeners) listener(message);
    if ('jobId' in message && (message.type === 'complete' || message.type === 'cancelled' || message.type === 'error')) {
      const waiter = waiters.get(message.jobId ?? '');
      if (waiter) {
        waiters.delete(message.jobId ?? '');
        if (message.type === 'error') waiter.reject(new Error(message.message)); else waiter.resolve();
      }
    }
  };
  worker.addEventListener('message', handle);
  const postJob = (message: InsightsWorkerInput & { jobId: string }): Promise<void> => new Promise((resolve, reject) => {
    waiters.set(message.jobId, { resolve, reject }); worker.postMessage(message);
  });
  return {
    mode: 'worker',
    onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    initialize(settings) { worker.postMessage({ type: 'initialize', settings }); },
    restoreCachedDocuments(documents, jobId = id('restore-cache')) { return postJob({ type: 'restoreCachedDocuments', jobId, documents }); },
    applySourceBatch(documents, jobId = id('batch')) { return postJob({ type: 'applySourceBatch', jobId, documents }); },
    applyFsDeltaBatch(deltas, jobId = id('fs-delta')) { return postJob({ type: 'applyFsDeltaBatch', jobId, deltas }); },
    setActiveOverlay(document, jobId = id('overlay')) { return postJob({ type: 'setActiveOverlay', jobId, document }); },
    clearActiveOverlay(path, jobId = id('overlay-clear')) { return postJob({ type: 'clearActiveOverlay', jobId, path }); },
    requestSnapshot(jobId = id('snapshot')) { return postJob({ type: 'requestSnapshot', jobId }); },
    cancel(jobId) { worker.postMessage({ type: 'cancel', ...(jobId ? { jobId } : {}) }); },
    dispose() { disposed = true; worker.removeEventListener?.('message', handle); worker.terminate(); listeners.clear(); for (const waiter of waiters.values()) waiter.reject(new Error('Insights worker disposed')); waiters.clear(); },
  };
}
