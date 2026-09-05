import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyzedDocument } from './analyzeDocument';
import type { InsightsCachedDocument, InsightsCacheStore } from './cache';
import {
  checkExternalLinks as startExternalLinkChecks,
  readInsightsDocumentSource,
  scanInsightsWorkspace,
  type ExternalLinkCheckHandle,
  type InsightsScanHandle,
} from '../platform/bridge';
import { resolveInsightsSettings } from './config';
import type {
  ExternalLinkCheckResult,
  InsightsFsDelta,
  InsightsWorkspaceEntry,
} from './contracts';
import type { WorkspaceInsightsSnapshot } from './index';
import {
  createInsightsWorkerClient,
  type InsightsWorkerClient,
} from './workerClient';
import type { InsightsSourceInput, InsightsWorkerOutput } from './workerProtocol';
import {
  buildWorkspaceWikiResolverContext,
  createValidatedCacheDocument,
  createWorkspaceInsightsCacheContext,
  createWorkspaceInsightsCacheStore,
  emptyWorkspaceInsightsSnapshot as emptySnapshot,
  insightsRequestId as requestId,
  isMarkdownInsightsEntry as isMarkdownEntry,
  persistWorkspaceInsightsCache,
  restoreWorkspaceInsightsCache,
  updateWorkspaceInsightsWatchState,
  useWorkspaceInsightsSettingsLifecycle,
  type UseWorkspaceInsightsOptions,
  type WorkspaceInsightsProgress,
  type WorkspaceInsightsSessionViewModel,
  type WorkspaceInsightsStatus,
  type WorkspaceInsightsWarning,
} from './workspaceInsightsSession';

export type {
  UseWorkspaceInsightsOptions,
  WorkspaceInsightsProgress,
  WorkspaceInsightsSessionViewModel,
  WorkspaceInsightsStatus,
  WorkspaceInsightsWarning,
} from './workspaceInsightsSession';

export function useWorkspaceInsights(options: UseWorkspaceInsightsOptions): WorkspaceInsightsSessionViewModel {
  const settings = useMemo(
    () => resolveInsightsSettings(options.settings ?? {}, options.workspaceOverrides ?? {}),
    [options.settings, options.workspaceOverrides],
  );
  const cacheContext = useMemo(() => options.workspaceKey
    ? createWorkspaceInsightsCacheContext(options.workspaceKey, settings.lintRules)
    : null, [options.workspaceKey, settings.lintRules]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<WorkspaceInsightsStatus>('idle');
  const [snapshot, setSnapshot] = useState<WorkspaceInsightsSnapshot>(() => emptySnapshot());
  const [progress, setProgress] = useState<WorkspaceInsightsProgress>({ completed: 0, total: 0, provisional: false });
  const [warnings, setWarnings] = useState<WorkspaceInsightsWarning[]>([]);
  const [workerMode, setWorkerMode] = useState<'worker' | 'degraded' | undefined>();
  const [externalResults, setExternalResults] = useState<Map<string, ExternalLinkCheckResult>>(() => new Map());
  const [approvedPrivateOrigins, setApprovedPrivateOrigins] = useState<Set<string>>(() => new Set());

  const workerRef = useRef<InsightsWorkerClient | null>(null);
  const workerUnsubscribeRef = useRef<(() => void) | null>(null);
  const hostUnsubscribeRef = useRef<(() => void) | null>(null);
  const scanRef = useRef<InsightsScanHandle | null>(null);
  const externalRef = useRef<ExternalLinkCheckHandle | null>(null);
  const workerJobRef = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const hashesRef = useRef(new Map<string, string>());
  const cacheRef = useRef<InsightsCacheStore | null>(null);
  const cacheLoadedRef = useRef(false);
  const provisionalPathsRef = useRef(new Set<string>());
  const validatedCacheDocumentsRef = useRef(new Map<string, InsightsCachedDocument>());
  const documentResultsByJobRef = useRef(new Map<string, AnalyzedDocument[]>());
  const openedRef = useRef(false);
  const disposedRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  const handleWorkerEvent = useCallback((event: InsightsWorkerOutput) => {
    if (event.type === 'progress') {
      setProgress({ completed: event.completed, total: event.total, provisional: true });
    } else if (event.type === 'documentResults') {
      const previous = documentResultsByJobRef.current.get(event.jobId) ?? [];
      documentResultsByJobRef.current.set(event.jobId, [...previous, ...event.documents]);
      setProgress(current => ({ ...current, provisional: true }));
    } else if (event.type === 'complete') {
      snapshotRef.current = event.snapshot;
      setSnapshot(event.snapshot);
    } else if (event.type === 'error') {
      setStatus('error');
      setWarnings(current => [...current, { reason: event.message }]);
    }
  }, []);

  const ensureCache = useCallback((): InsightsCacheStore | null => {
    if (!cacheRef.current) cacheRef.current = createWorkspaceInsightsCacheStore(options.createCacheStore);
    return cacheRef.current;
  }, [options.createCacheStore]);

  const persistValidatedCache = useCallback(() => persistWorkspaceInsightsCache(
    cacheRef.current,
    cacheContext,
    validatedCacheDocumentsRef.current.values(),
  ), [cacheContext]);

  const restoreCache = useCallback(async (worker: InsightsWorkerClient): Promise<void> => {
    if (!cacheContext || cacheLoadedRef.current) return;
    cacheLoadedRef.current = true;
    const cache = ensureCache();
    if (!cache) return;
    try {
      const cached = await Promise.race([
        restoreWorkspaceInsightsCache(cache, cacheContext),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 1500)),
      ]);
      if (!cached?.documents.length || disposedRef.current) return;
      provisionalPathsRef.current = new Set(cached.documents.map(document => document.path));
      setProgress({ completed: 0, total: cached.documents.length, provisional: true });
      await Promise.race([
        worker.restoreCachedDocuments(
          cached.documents.map(document => document.persisted),
          requestId('insights-cache-restore'),
        ),
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Ignore cache restore errors and continue with authoritative disk validation.
    }
  }, [cacheContext, ensureCache]);

  const readEntry = useCallback(async (
    entry: InsightsWorkspaceEntry,
    worker: InsightsWorkerClient,
    forceHash: boolean,
  ): Promise<void> => {
    try {
      const result = await readInsightsDocumentSource(options.bridge, {
        requestId: requestId('insights-source'),
        relativePath: entry.relativePath,
        softLimitBytes: settings.sourceSoftLimitBytes,
        hardLimitBytes: settings.sourceHardLimitBytes,
      });
      if (disposedRef.current) return;
      if (result.status !== 'ok' || result.source === undefined) {
        setWarnings(current => [...current, { path: entry.relativePath, reason: result.status }]);
        hashesRef.current.delete(entry.relativePath);
        validatedCacheDocumentsRef.current.delete(entry.relativePath);
        if (provisionalPathsRef.current.delete(entry.relativePath)) {
          await worker.applyFsDeltaBatch(
            [{ kind: 'delete', relativePath: entry.relativePath }],
            requestId('insights-cache-invalid'),
          ).catch(() => {});
        }
        return;
      }
      const nextHash = result.contentHash ?? `${result.mtimeMs ?? entry.mtimeMs}:${result.sizeBytes ?? entry.sizeBytes}`;
      if (!forceHash && hashesRef.current.get(entry.relativePath) === nextHash) return;
      const jobId = requestId('insights-document');
      documentResultsByJobRef.current.delete(jobId);
      workerJobRef.current = jobId;
      await worker.applySourceBatch([{
        path: result.relativePath,
        source: result.source,
        revision: nextHash,
      }], jobId);
      if (workerJobRef.current === jobId) workerJobRef.current = null;
      hashesRef.current.set(entry.relativePath, nextHash);
      provisionalPathsRef.current.delete(entry.relativePath);
      const analyzed = documentResultsByJobRef.current.get(jobId)?.find(document => document.path === result.relativePath);
      documentResultsByJobRef.current.delete(jobId);
      if (analyzed) {
        validatedCacheDocumentsRef.current.set(
          entry.relativePath,
          createValidatedCacheDocument(entry, result, nextHash, analyzed),
        );
      }
    } catch (err) {
      setWarnings(current => [...current, { path: entry.relativePath, reason: String(err) }]);
    }
  }, [options.bridge, settings.sourceHardLimitBytes, settings.sourceSoftLimitBytes]);

  const processFsDeltas = useCallback(async (deltas: readonly InsightsFsDelta[]) => {
    const worker = workerRef.current;
    if (!worker || disposedRef.current) return;
    const structural: InsightsFsDelta[] = [];
    const reads: Promise<void>[] = [];
    for (const delta of deltas) {
      if (delta.kind === 'delete') {
        hashesRef.current.delete(delta.relativePath);
        provisionalPathsRef.current.delete(delta.relativePath);
        validatedCacheDocumentsRef.current.delete(delta.relativePath);
        structural.push(delta);
      } else if (delta.kind === 'rename') {
        hashesRef.current.delete(delta.previousRelativePath);
        validatedCacheDocumentsRef.current.delete(delta.previousRelativePath);
        if (provisionalPathsRef.current.delete(delta.previousRelativePath)) {
          provisionalPathsRef.current.add(delta.entry.canonicalRelativePath || delta.entry.relativePath);
        }
        structural.push(delta);
        if (delta.entry.kind === 'file' && isMarkdownEntry(delta.entry)) {
          reads.push(readEntry(delta.entry, worker, true));
        }
      } else if (delta.entry.kind === 'file' && isMarkdownEntry(delta.entry)) {
        reads.push(readEntry(delta.entry, worker, false));
      }
    }
    if (structural.length) await worker.applyFsDeltaBatch(structural, requestId('insights-fs'));
    await Promise.all(reads);
    await persistValidatedCache();
  }, [persistValidatedCache, readEntry]);

  const ensureWorker = useCallback((): InsightsWorkerClient => {
    if (workerRef.current) return workerRef.current;
    const worker = options.createWorkerClient?.() ?? createInsightsWorkerClient();
    workerRef.current = worker;
    setWorkerMode(worker.mode);
    worker.initialize(settings);
    workerUnsubscribeRef.current = worker.onEvent(handleWorkerEvent);
    hostUnsubscribeRef.current = options.bridge.onMessage(message => {
      if (message.command !== 'insightsFsDelta' || !openedRef.current) return;
      if (options.workspaceOperationId
        && message.workspaceOperationId
        && message.workspaceOperationId !== options.workspaceOperationId) return;
      void processFsDeltas(message.deltas);
    });
    return worker;
  }, [handleWorkerEvent, options.bridge, options.createWorkerClient, options.workspaceOperationId, processFsDeltas, settings]);

  const runScan = useCallback(async (forceHash: boolean): Promise<void> => {
    if (!options.workspaceKey || disposedRef.current) return;
    const generation = ++generationRef.current;
    const worker = ensureWorker();
    openedRef.current = true;
    setStatus('indexing');
    setWarnings([]);
    setProgress({ completed: 0, total: 0, provisional: true });
    try {
      await restoreCache(worker);
      if (generation !== generationRef.current || disposedRef.current) return;
      updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, true, true);
      const reads: Promise<void>[] = [];
      let discovered = 0;
      const scan = scanInsightsWorkspace(options.bridge, {
        requestId: requestId('insights-scan'), workspaceOperationId: options.workspaceOperationId,
        userPatterns: settings.userPatterns, oversizedPatterns: settings.oversizedPatterns,
      }, batch => {
        discovered = Math.max(discovered, batch.scannedEntries);
        setProgress(current => ({ ...current, total: Math.max(current.total, batch.scannedEntries), provisional: true }));
        for (const entry of batch.entries) {
          if (entry.kind !== 'file' || !isMarkdownEntry(entry)) continue;
          reads.push(readEntry(entry, worker, forceHash));
        }
      });
      scanRef.current = scan;
      const complete = await scan.done;
      await Promise.all(reads);
      if (generation !== generationRef.current || disposedRef.current) return;
      scanRef.current = null;
      if (complete.truncated) setWarnings(current => [...current, { reason: complete.truncatedReason ?? 'scan-truncated' }]);
      if (complete.cancelled) { setStatus('paused'); return; }
      if (!complete.truncated) {
        const stalePaths = [...provisionalPathsRef.current];
        provisionalPathsRef.current.clear();
        if (stalePaths.length) {
          await worker.applyFsDeltaBatch(stalePaths.map(relativePath => ({ kind: 'delete' as const, relativePath })), requestId('insights-cache-stale')).catch(() => {});
        }
        await persistValidatedCache().catch(() => {});
      }
      setProgress({ completed: complete.totalEntries || discovered, total: complete.totalEntries || discovered, provisional: false });
      setStatus('ready');
    } catch (error) {
      if (generation !== generationRef.current || disposedRef.current) return;
      scanRef.current = null;
      setWarnings(current => [...current, { reason: String(error) }]);
      setStatus('error');
    }
  }, [ensureWorker, options.bridge, options.workspaceKey, options.workspaceOperationId, persistValidatedCache, readEntry, restoreCache, settings.oversizedPatterns, settings.userPatterns]);

  const open = useCallback(async () => {
    if (!options.workspaceKey || disposedRef.current) return;
    setPanelOpen(true);
    if (openedRef.current && workerRef.current && status !== 'idle') {
      updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, true, true);
      if (status === 'paused') setStatus(snapshotRef.current.revision > 0 ? 'ready' : 'idle');
      return;
    }
    await runScan(false);
  }, [options.bridge, options.workspaceKey, options.workspaceOperationId, runScan, status]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, openedRef.current, false);
    if (status === 'indexing') {
      scanRef.current?.cancel();
      if (workerJobRef.current) workerRef.current?.cancel(workerJobRef.current);
      setStatus('paused');
    }
  }, [options.bridge, options.workspaceOperationId, status]);

  const pause = useCallback(() => {
    scanRef.current?.cancel();
    if (workerJobRef.current) workerRef.current?.cancel(workerJobRef.current);
    updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, false, false);
    if (openedRef.current) setStatus('paused');
  }, [options.bridge, options.workspaceOperationId]);

  const refreshLocal = useCallback(async () => {
    await runScan(true);
  }, [runScan]);

  const applyActiveOverlay = useCallback(async (document: InsightsSourceInput) => {
    const worker = ensureWorker();
    const jobId = requestId('insights-overlay');
    await worker.setActiveOverlay(document, jobId);
  }, [ensureWorker]);

  const clearActiveOverlay = useCallback(async (path: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    await worker.clearActiveOverlay(path, requestId('insights-overlay-clear'));
  }, []);

  const cancelExternalChecks = useCallback(() => {
    externalRef.current?.cancel();
    externalRef.current = null;
  }, []);

  const checkExternalLinks = useCallback(async (
    urls: readonly string[],
    checkOptions: { readonly recheck?: boolean } = {},
  ): Promise<readonly ExternalLinkCheckResult[]> => {
    if (!settings.externalLinks.enabled || disposedRef.current) return [];
    const unique = [...new Set(urls.filter(url => /^https?:\/\//i.test(url)))];
    if (!unique.length) return [];
    const results: ExternalLinkCheckResult[] = [];
    const handle = startExternalLinkChecks(options.bridge, {
      requestId: requestId('insights-external'), urls: unique,
      timeoutMs: settings.externalLinks.timeoutMs,
      recheck: checkOptions.recheck,
      approvedPrivateOrigins: [...approvedPrivateOrigins],
    }, result => {
      results.push(result);
      setExternalResults(current => {
        const next = new Map(current);
        next.set(result.url, result);
        return next;
      });
    });
    externalRef.current = handle;
    await handle.done;
    if (externalRef.current === handle) externalRef.current = null;
    return results;
  }, [approvedPrivateOrigins, options.bridge, settings.externalLinks.enabled, settings.externalLinks.timeoutMs]);

  const approvePrivateOrigin = useCallback((origin: string) => {
    setApprovedPrivateOrigins(current => new Set(current).add(origin));
  }, []);

  const getWikiResolverContext = useCallback((sourceDocumentPath: string) => (
    buildWorkspaceWikiResolverContext(
      sourceDocumentPath,
      snapshotRef.current,
      options.bridge,
      options.workspaceOperationId,
      settings,
    )
  ), [options.bridge, options.workspaceOperationId, settings]);

  const dispose = useCallback(() => {
    if (disposedRef.current) return;
    disposedRef.current = true;
    generationRef.current += 1;
    scanRef.current?.cancel();
    externalRef.current?.cancel();
    if (workerJobRef.current) workerRef.current?.cancel(workerJobRef.current);
    updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, false, false);
    workerUnsubscribeRef.current?.();
    hostUnsubscribeRef.current?.();
    workerRef.current?.dispose();
    workerRef.current = null;
    const cache = cacheRef.current;
    cacheRef.current = null;
    if (cache) void cache.close().catch(() => {});
    cacheLoadedRef.current = false;
    provisionalPathsRef.current.clear();
    validatedCacheDocumentsRef.current.clear();
    documentResultsByJobRef.current.clear();
    openedRef.current = false;
    hashesRef.current.clear();
    setApprovedPrivateOrigins(new Set());
    setExternalResults(new Map());
  }, [options.bridge, options.workspaceOperationId]);

  useEffect(() => {
    disposedRef.current = false;
    return () => dispose();
  }, [options.workspaceKey, dispose]);

  useWorkspaceInsightsSettingsLifecycle({
    workerRef, settings, analysisSignature: cacheContext?.analysisSignature ?? null,
    openedRef, validatedCacheDocuments: validatedCacheDocumentsRef.current,
    hashes: hashesRef.current, panelOpen, runScan, setStatus,
    bridge: options.bridge, workspaceOperationId: options.workspaceOperationId,
  });

  return {
    panelOpen, status, snapshot, progress, warnings, workerMode,
    externalResults, approvedPrivateOrigins,
    open, closePanel, refreshLocal, pause, dispose,
    applyActiveOverlay, clearActiveOverlay,
    checkExternalLinks, cancelExternalChecks, approvePrivateOrigin,
    getWikiResolverContext,
  };
}
