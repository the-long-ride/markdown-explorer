import type { InsightsSettings } from './config.ts';
import type { InsightsFsDelta } from './contracts.ts';
import type { AnalyzedDocument, PersistedAnalyzedDocument } from './analyzeDocument.ts';
import type { WorkspaceInsightsSnapshot } from './index.ts';

export interface InsightsSourceInput { readonly path: string; readonly source: string; readonly revision: string; }

export type InsightsWorkerInput =
  | { readonly type: 'initialize'; readonly settings?: Partial<InsightsSettings> }
  | { readonly type: 'restoreCachedDocuments'; readonly jobId: string; readonly documents: readonly PersistedAnalyzedDocument[] }
  | { readonly type: 'applySourceBatch'; readonly jobId: string; readonly documents: readonly InsightsSourceInput[] }
  | { readonly type: 'applyFsDeltaBatch'; readonly jobId: string; readonly deltas: readonly InsightsFsDelta[] }
  | { readonly type: 'setActiveOverlay'; readonly jobId: string; readonly document: InsightsSourceInput }
  | { readonly type: 'clearActiveOverlay'; readonly jobId: string; readonly path: string }
  | { readonly type: 'updateConfig'; readonly settings: Partial<InsightsSettings> }
  | { readonly type: 'requestSnapshot'; readonly jobId: string }
  | { readonly type: 'cancel'; readonly jobId?: string };

export type InsightsWorkerOutput =
  | { readonly type: 'progress'; readonly jobId: string; readonly completed: number; readonly total: number }
  | { readonly type: 'documentResults'; readonly jobId: string; readonly documents: readonly AnalyzedDocument[] }
  | { readonly type: 'snapshotDelta'; readonly jobId: string; readonly snapshot: WorkspaceInsightsSnapshot }
  | { readonly type: 'complete'; readonly jobId: string; readonly snapshot: WorkspaceInsightsSnapshot }
  | { readonly type: 'cancelled'; readonly jobId: string }
  | { readonly type: 'error'; readonly jobId?: string; readonly message: string };
