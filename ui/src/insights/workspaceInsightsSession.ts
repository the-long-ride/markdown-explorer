import { useEffect, useRef } from 'react';
import type { WikiDocumentDescriptor, WikiResolverContext } from '../markdown/wikiLinks';
import { analyzeDocument, type AnalyzedDocument } from './analyzeDocument';
import {
  createInsightsCacheAnalysisSignature,
  INSIGHTS_ANALYZER_COMPONENT_VERSION,
  InsightsCacheStore,
  type InsightsCachedDocument,
  type InsightsWorkspaceCache,
} from './cache';
import {
  readInsightsDocumentSource,
  scanInsightsWorkspace,
  setInsightsWatchState,
  type PlatformBridge,
} from '../platform/bridge';
import type {
  InsightsSettings,
  InsightsSettingsInput,
  InsightsWorkspaceOverrides,
} from './config';
import type {
  ExternalLinkCheckResult,
  InsightsSourceResult,
  InsightsWorkspaceEntry,
} from './contracts';
import type { WorkspaceInsightsSnapshot } from './index';
import { resolveWorkspaceIdentity } from './workspaceIdentity';
import type { InsightsWorkerClient } from './workerClient';
import type { InsightsSourceInput } from './workerProtocol';

export type WorkspaceInsightsStatus = 'idle' | 'indexing' | 'ready' | 'paused' | 'error';

export interface WorkspaceInsightsProgress {
  readonly completed: number;
  readonly total: number;
  readonly provisional: boolean;
}

export interface WorkspaceInsightsWarning {
  readonly path?: string;
  readonly reason: string;
}

export interface WorkspaceInsightsSessionViewModel {
  readonly panelOpen: boolean;
  readonly status: WorkspaceInsightsStatus;
  readonly snapshot: WorkspaceInsightsSnapshot;
  readonly progress: WorkspaceInsightsProgress;
  readonly warnings: readonly WorkspaceInsightsWarning[];
  readonly workerMode?: 'worker' | 'degraded';
  readonly externalResults: ReadonlyMap<string, ExternalLinkCheckResult>;
  readonly approvedPrivateOrigins: ReadonlySet<string>;
  open(): Promise<void>;
  closePanel(): void;
  refreshLocal(): Promise<void>;
  pause(): void;
  dispose(): void;
  applyActiveOverlay(document: InsightsSourceInput): Promise<void>;
  clearActiveOverlay(path: string): Promise<void>;
  checkExternalLinks(urls: readonly string[], options?: { readonly recheck?: boolean }): Promise<readonly ExternalLinkCheckResult[]>;
  cancelExternalChecks(): void;
  approvePrivateOrigin(origin: string): void;
  getWikiResolverContext(sourceDocumentPath: string): Promise<WikiResolverContext>;
}

export interface UseWorkspaceInsightsOptions {
  readonly bridge: PlatformBridge;
  readonly workspaceKey: string | null | undefined;
  readonly workspaceOperationId?: string;
  readonly settings?: InsightsSettingsInput;
  readonly workspaceOverrides?: InsightsWorkspaceOverrides;
  readonly createWorkerClient?: () => InsightsWorkerClient;
  readonly createCacheStore?: () => InsightsCacheStore;
}

export interface WorkspaceInsightsCacheContext {
  readonly workspaceId: string;
  readonly analyzerVersion: number;
  readonly analysisSignature: string;
}

export function createWorkspaceInsightsCacheContext(
  workspaceKey: string,
  lintRules: InsightsSettings['lintRules'],
): WorkspaceInsightsCacheContext {
  return {
    workspaceId: resolveWorkspaceIdentity({ workspacePath: workspaceKey }).key,
    analyzerVersion: INSIGHTS_ANALYZER_COMPONENT_VERSION,
    analysisSignature: createInsightsCacheAnalysisSignature(lintRules),
  };
}

export function createWorkspaceInsightsCacheStore(
  createCacheStore?: () => InsightsCacheStore,
): InsightsCacheStore | null {
  try {
    return createCacheStore?.() ?? new InsightsCacheStore();
  } catch {
    return null;
  }
}

export function persistWorkspaceInsightsCache(
  cache: InsightsCacheStore | null,
  context: WorkspaceInsightsCacheContext | null,
  documents: Iterable<InsightsCachedDocument>,
): Promise<void> {
  if (!cache || !context) return Promise.resolve();
  return cache.putWorkspace({ ...context, documents: [...documents] }).catch(() => {});
}

export function restoreWorkspaceInsightsCache(
  cache: InsightsCacheStore,
  context: WorkspaceInsightsCacheContext,
): Promise<InsightsWorkspaceCache | undefined> {
  return cache.getWorkspace(context.workspaceId, context.analyzerVersion, context.analysisSignature);
}

export function invalidateWorkspaceInsightsAnalysisCache(
  signatureRef: { current: string | null },
  nextSignature: string | null,
  opened: boolean,
  documents: Map<string, InsightsCachedDocument>,
  hashes: Map<string, string>,
): boolean {
  const previousSignature = signatureRef.current;
  signatureRef.current = nextSignature;
  if (!opened || !previousSignature || !nextSignature || previousSignature === nextSignature) return false;
  documents.clear();
  hashes.clear();
  return true;
}

interface WorkspaceInsightsSettingsLifecycleOptions {
  readonly workerRef: { current: InsightsWorkerClient | null };
  readonly settings: InsightsSettings;
  readonly analysisSignature: string | null;
  readonly openedRef: { current: boolean };
  readonly validatedCacheDocuments: Map<string, InsightsCachedDocument>;
  readonly hashes: Map<string, string>;
  readonly panelOpen: boolean;
  readonly runScan: (forceHash: boolean) => Promise<void>;
  readonly setStatus: (status: WorkspaceInsightsStatus) => void;
  readonly bridge: PlatformBridge;
  readonly workspaceOperationId?: string;
}

export function useWorkspaceInsightsSettingsLifecycle(
  options: WorkspaceInsightsSettingsLifecycleOptions,
): void {
  const signatureRef = useRef(options.analysisSignature);
  useEffect(() => {
    options.workerRef.current?.initialize(options.settings);
    if (!invalidateWorkspaceInsightsAnalysisCache(
      signatureRef,
      options.analysisSignature,
      options.openedRef.current,
      options.validatedCacheDocuments,
      options.hashes,
    )) return;
    if (options.panelOpen) {
      void options.runScan(true);
      return;
    }
    options.openedRef.current = false;
    options.setStatus('idle');
    updateWorkspaceInsightsWatchState(options.bridge, options.workspaceOperationId, false, false);
  }, [
    options.analysisSignature,
    options.bridge,
    options.hashes,
    options.openedRef,
    options.panelOpen,
    options.runScan,
    options.setStatus,
    options.settings,
    options.validatedCacheDocuments,
    options.workerRef,
    options.workspaceOperationId,
  ]);
}

export function emptyWorkspaceInsightsSnapshot(): WorkspaceInsightsSnapshot {
  return {
    documents: new Map(), outboundLinks: new Map(), backlinks: new Map(), brokenLinks: [],
    tags: new Map(), headings: new Map(), titles: new Map(), revision: 0,
  };
}

export function insightsRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function updateWorkspaceInsightsWatchState(
  bridge: PlatformBridge,
  workspaceOperationId: string | undefined,
  active: boolean,
  visible: boolean,
): void {
  setInsightsWatchState(bridge, {
    requestId: insightsRequestId('insights-watch'), workspaceOperationId, active, visible,
  });
}

export function isMarkdownInsightsEntry(entry: InsightsWorkspaceEntry): boolean {
  return /\.mdx?$/i.test(entry.relativePath) || /^\.mdx?$/i.test(entry.extension ?? '');
}

export function createValidatedCacheDocument(
  entry: InsightsWorkspaceEntry,
  result: InsightsSourceResult,
  contentHash: string,
  analyzed: AnalyzedDocument,
): InsightsCachedDocument {
  return {
    path: entry.relativePath,
    sizeBytes: result.sizeBytes ?? entry.sizeBytes,
    mtimeMs: result.mtimeMs ?? entry.mtimeMs,
    contentHash,
    persisted: analyzed.persisted,
    lastAccessedAt: Date.now(),
  };
}

export function workspaceWikiDescriptors(snapshot: WorkspaceInsightsSnapshot): WikiDocumentDescriptor[] {
  return [...snapshot.documents.values()].map(document => ({
    path: document.path,
    canonicalPath: document.path,
    title: document.title,
    aliases: document.aliases,
    anchors: [...document.anchors],
  }));
}

export async function buildLazyWorkspaceWikiCatalog(
  bridge: PlatformBridge,
  workspaceOperationId: string | undefined,
  settings: InsightsSettings,
): Promise<WikiDocumentDescriptor[]> {
  const sources: InsightsSourceInput[] = [];
  const reads: Promise<void>[] = [];
  const scan = scanInsightsWorkspace(bridge, {
    requestId: insightsRequestId('wiki-catalog'), workspaceOperationId,
    userPatterns: settings.userPatterns, oversizedPatterns: settings.oversizedPatterns,
  }, batch => {
    for (const entry of batch.entries) {
      if (entry.kind !== 'file' || !isMarkdownInsightsEntry(entry)) continue;
      reads.push(readInsightsDocumentSource(bridge, {
        requestId: insightsRequestId('wiki-source'), relativePath: entry.relativePath,
        softLimitBytes: settings.sourceSoftLimitBytes, hardLimitBytes: settings.sourceHardLimitBytes,
      }).then(result => {
        if (result.status !== 'ok' || result.source === undefined) return;
        sources.push({
          path: result.relativePath,
          source: result.source,
          revision: result.contentHash ?? `${result.mtimeMs ?? 0}:${result.sizeBytes ?? 0}`,
        });
      }));
    }
  });
  await scan.done;
  await Promise.all(reads);
  return sources.map(source => {
    const document = analyzeDocument(source);
    return {
      path: document.path,
      canonicalPath: document.path,
      title: document.title,
      aliases: document.aliases,
      anchors: [...document.anchors],
    };
  });
}

export async function buildWorkspaceWikiResolverContext(
  sourceDocumentPath: string,
  snapshot: WorkspaceInsightsSnapshot,
  bridge: PlatformBridge,
  workspaceOperationId: string | undefined,
  settings: InsightsSettings,
): Promise<WikiResolverContext> {
  const live = workspaceWikiDescriptors(snapshot);
  return {
    sourceDocumentPath,
    documents: live.length ? live : await buildLazyWorkspaceWikiCatalog(bridge, workspaceOperationId, settings),
  };
}
