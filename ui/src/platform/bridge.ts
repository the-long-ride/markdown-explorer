// =============================================================================
// platform/bridge.ts — Platform-agnostic communication interface
// =============================================================================

import type { HostMessage, WebviewMessage } from '../types';
import { createAsyncLimiter, type AsyncLimiter } from '../insights/concurrency';
import type {
  ExternalLinkCheckRequest,
  ExternalLinkCheckResult,
  InsightsScanBatch,
  InsightsScanComplete,
  InsightsScanRequest,
  InsightsSourceResult,
  WorkspaceResourceProbeResult,
} from '../insights/contracts';

/**
 * Abstract bridge between the UI and the host process.
 * Implemented by VsCodeBridge (extension) and ElectronBridge (desktop).
 */
export interface PlatformBridge {
  /** Send a message to the host process */
  postMessage(msg: WebviewMessage): void;

  /** Register a handler for messages from the host. Returns unsubscribe fn. */
  onMessage(handler: (msg: HostMessage) => void): () => void;

  /** Get persisted UI state */
  getState<T>(): T | undefined;

  /** Persist UI state */
  setState<T>(state: T): void;

  /** Copy text to clipboard (delegated to host) */
  copyToClipboard(text: string): void | Promise<void>;
}

export interface WorkspaceTextResourceResponse {
  ok: boolean;
  content?: string;
  resolvedPath?: string;
  reason?: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported' | 'timeout';
}

/** Request a workspace-local text resource through the active host bridge. */
export function readWorkspaceTextResource(
  bridge: PlatformBridge,
  documentPath: string,
  resourcePath: string,
  timeoutMs = 5000,
): Promise<WorkspaceTextResourceResponse> {
  const requestId = `html-resource-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'workspaceTextResourceResult' || message.requestId !== requestId) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve({
        ok: message.ok,
        content: message.content,
        resolvedPath: message.resolvedPath,
        reason: message.reason,
      });
    });
    const timer = window.setTimeout(() => {
      if (settled) return;
      unsubscribe();
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    bridge.postMessage({ command: 'readWorkspaceTextResource', requestId, documentPath, resourcePath });
  });
}

export interface InsightsScanHandle {
  readonly done: Promise<InsightsScanComplete>;
  cancel(): void;
}

export interface ExternalLinkCheckHandle {
  readonly done: Promise<{ readonly requestId: string; readonly cancelled: boolean }>;
  cancel(): void;
}

export interface ReadInsightsDocumentSourceRequest {
  readonly requestId: string;
  readonly relativePath: string;
  readonly softLimitBytes: number;
  readonly hardLimitBytes?: number;
}

export interface ProbeWorkspaceResourceRequest {
  readonly requestId: string;
  readonly documentPath: string;
  readonly resourcePath: string;
}

export interface SetInsightsWatchStateRequest {
  readonly requestId: string;
  readonly workspaceOperationId?: string;
  readonly active: boolean;
  readonly visible: boolean;
}

const pendingScanCancels = new WeakMap<PlatformBridge, Map<string, () => void>>();
const pendingExternalCancels = new WeakMap<PlatformBridge, Map<string, () => void>>();
const insightsSourceReadLimiters = new WeakMap<PlatformBridge, AsyncLimiter>();

function pendingMap(
  store: WeakMap<PlatformBridge, Map<string, () => void>>,
  bridge: PlatformBridge,
): Map<string, () => void> {
  let map = store.get(bridge);
  if (!map) {
    map = new Map();
    store.set(bridge, map);
  }
  return map;
}

function insightsSourceReadLimiter(bridge: PlatformBridge): AsyncLimiter {
  let limiter = insightsSourceReadLimiters.get(bridge);
  if (!limiter) {
    limiter = createAsyncLimiter();
    insightsSourceReadLimiters.set(bridge, limiter);
  }
  return limiter;
}

export function scanInsightsWorkspace(
  bridge: PlatformBridge,
  request: InsightsScanRequest,
  onBatch?: (batch: InsightsScanBatch) => void,
): InsightsScanHandle {
  let resolveDone!: (result: InsightsScanComplete) => void;
  const done = new Promise<InsightsScanComplete>((resolve) => { resolveDone = resolve; });
  let settled = false;
  let unsubscribe = () => {};

  const finish = (result: InsightsScanComplete): void => {
    if (settled) return;
    settled = true;
    unsubscribe();
    pendingMap(pendingScanCancels, bridge).delete(request.requestId);
    resolveDone(result);
  };

  unsubscribe = bridge.onMessage((message) => {
    if (message.command === 'insightsScanBatch') {
      if (message.requestId !== request.requestId) return;
      onBatch?.({
        requestId: message.requestId,
        entries: message.entries,
        scannedEntries: message.scannedEntries,
        excludedEntries: message.excludedEntries,
      });
      return;
    }
    if (message.command === 'insightsScanComplete') {
      if (message.requestId !== request.requestId) return;
      finish({
        requestId: message.requestId,
        totalEntries: message.totalEntries,
        excludedEntries: message.excludedEntries,
        skippedEntries: message.skippedEntries,
        truncated: message.truncated,
        truncatedReason: message.truncatedReason,
        cancelled: message.cancelled,
      });
    }
  });

  pendingMap(pendingScanCancels, bridge).set(request.requestId, () => {
    finish({
      requestId: request.requestId,
      totalEntries: 0,
      excludedEntries: 0,
      skippedEntries: 0,
      truncated: false,
      cancelled: true,
    });
  });

  bridge.postMessage({ command: 'scanInsightsWorkspace', ...request });
  return {
    done,
    cancel: () => cancelInsightsScan(bridge, request.requestId),
  };
}

export function cancelInsightsScan(bridge: PlatformBridge, requestId: string): void {
  pendingScanCancels.get(bridge)?.get(requestId)?.();
  bridge.postMessage({ command: 'cancelInsightsScan', requestId });
}

export function readInsightsDocumentSource(
  bridge: PlatformBridge,
  request: ReadInsightsDocumentSourceRequest,
): Promise<InsightsSourceResult> {
  return insightsSourceReadLimiter(bridge)(() => new Promise((resolve) => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'insightsDocumentSourceResult' || message.requestId !== request.requestId) return;
      unsubscribe();
      resolve({
        requestId: message.requestId,
        relativePath: message.relativePath,
        status: message.status,
        source: message.source,
        sizeBytes: message.sizeBytes,
        mtimeMs: message.mtimeMs,
        contentHash: message.contentHash,
      });
    });
    bridge.postMessage({ command: 'readInsightsDocumentSource', ...request });
  }));
}

export function probeWorkspaceResource(
  bridge: PlatformBridge,
  request: ProbeWorkspaceResourceRequest,
): Promise<WorkspaceResourceProbeResult> {
  return new Promise((resolve) => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'workspaceResourceProbeResult' || message.requestId !== request.requestId) return;
      unsubscribe();
      resolve({
        status: message.status,
        relativePath: message.relativePath,
        kind: message.kind,
        sizeBytes: message.sizeBytes,
        mimeType: message.mimeType,
      });
    });
    bridge.postMessage({ command: 'probeWorkspaceResource', ...request });
  });
}

export function setInsightsWatchState(
  bridge: PlatformBridge,
  request: SetInsightsWatchStateRequest,
): void {
  bridge.postMessage({ command: 'setInsightsWatchState', ...request });
}

export function checkExternalLinks(
  bridge: PlatformBridge,
  request: ExternalLinkCheckRequest,
  onResult?: (result: ExternalLinkCheckResult) => void,
): ExternalLinkCheckHandle {
  let resolveDone!: (result: { readonly requestId: string; readonly cancelled: boolean }) => void;
  const done = new Promise<{ readonly requestId: string; readonly cancelled: boolean }>((resolve) => {
    resolveDone = resolve;
  });
  let settled = false;
  let unsubscribe = () => {};

  const finish = (result: { readonly requestId: string; readonly cancelled: boolean }): void => {
    if (settled) return;
    settled = true;
    unsubscribe();
    pendingMap(pendingExternalCancels, bridge).delete(request.requestId);
    resolveDone(result);
  };

  unsubscribe = bridge.onMessage((message) => {
    if (message.command === 'externalLinkCheckResult') {
      if (message.requestId !== request.requestId) return;
      onResult?.({
        requestId: message.requestId,
        url: message.url,
        status: message.status,
        httpStatus: message.httpStatus,
        finalUrl: message.finalUrl,
        checkedAt: message.checkedAt,
        insecureDowngrade: message.insecureDowngrade,
        reason: message.reason,
        retryAfterMs: message.retryAfterMs,
        privateOrigin: message.privateOrigin,
        requiresPrivateOriginConfirmation: message.requiresPrivateOriginConfirmation,
      });
      return;
    }
    if (message.command === 'externalLinkCheckComplete') {
      if (message.requestId !== request.requestId) return;
      finish({ requestId: message.requestId, cancelled: message.cancelled });
    }
  });

  pendingMap(pendingExternalCancels, bridge).set(request.requestId, () => {
    finish({ requestId: request.requestId, cancelled: true });
  });

  bridge.postMessage({ command: 'checkExternalLinks', ...request });
  return {
    done,
    cancel: () => cancelExternalLinkChecks(bridge, request.requestId),
  };
}

export function cancelExternalLinkChecks(bridge: PlatformBridge, requestId: string): void {
  pendingExternalCancels.get(bridge)?.get(requestId)?.();
  bridge.postMessage({ command: 'cancelExternalLinkChecks', requestId });
}
