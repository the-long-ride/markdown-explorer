export interface InsightsWorkspaceEntry {
  readonly relativePath: string;
  readonly canonicalRelativePath: string;
  readonly kind: 'file' | 'directory';
  readonly sizeBytes: number;
  readonly mtimeMs: number;
  readonly extension?: string;
  readonly isSymlink?: boolean;
}

export interface InsightsScanRequest {
  readonly requestId: string;
  readonly workspaceOperationId?: string;
  readonly userPatterns?: readonly string[];
  readonly oversizedPatterns?: readonly string[];
  readonly builtInExclusionVersion?: number;
}

export interface InsightsScanBatch {
  readonly requestId: string;
  readonly entries: readonly InsightsWorkspaceEntry[];
  readonly scannedEntries: number;
  readonly excludedEntries: number;
}

export interface InsightsScanComplete {
  readonly requestId: string;
  readonly totalEntries: number;
  readonly excludedEntries: number;
  readonly skippedEntries: number;
  readonly truncated: boolean;
  readonly truncatedReason?: string;
  readonly cancelled?: boolean;
}

export type InsightsSourceStatus =
  | 'ok'
  | 'missing'
  | 'outside-workspace'
  | 'unreadable'
  | 'unsupported'
  | 'too-large';

export interface InsightsSourceResult {
  readonly requestId: string;
  readonly relativePath: string;
  readonly status: InsightsSourceStatus;
  readonly source?: string;
  readonly sizeBytes?: number;
  readonly mtimeMs?: number;
  readonly contentHash?: string;
  readonly hardLimit?: boolean;
}

export type WorkspaceResourceProbeStatus =
  | 'exists'
  | 'missing'
  | 'outside-workspace'
  | 'unreadable'
  | 'unsupported';

export interface WorkspaceResourceProbeResult {
  readonly status: WorkspaceResourceProbeStatus;
  readonly relativePath?: string;
  readonly kind?: 'file' | 'directory';
  readonly sizeBytes?: number;
  readonly mimeType?: string;
}

export type InsightsFsDelta =
  | { readonly kind: 'add' | 'update'; readonly entry: InsightsWorkspaceEntry }
  | { readonly kind: 'delete'; readonly relativePath: string }
  | {
      readonly kind: 'rename';
      readonly previousRelativePath: string;
      readonly entry: InsightsWorkspaceEntry;
      readonly confidence: 'high' | 'low';
    };

export interface InsightsRuntimeCapabilities {
  readonly fileChanges: 'native' | 'polling' | 'unsupported';
  readonly externalLinkChecking: boolean;
  readonly documentPreviewReuse: boolean;
}

export type ExternalLinkCheckStatus =
  | 'reachable'
  | 'reachable-auth-required'
  | 'broken'
  | 'rate-limited'
  | 'server-error'
  | 'unreachable'
  | 'unchecked'
  | 'unsupported';

export interface ExternalLinkCheckRequest {
  readonly requestId: string;
  readonly urls: readonly string[];
  readonly timeoutMs: number;
  readonly recheck?: boolean;
  readonly approvedPrivateOrigins?: readonly string[];
}

export interface ExternalLinkCheckResult {
  readonly requestId: string;
  readonly url: string;
  readonly status: ExternalLinkCheckStatus;
  readonly httpStatus?: number;
  readonly finalUrl?: string;
  readonly checkedAt?: string;
  readonly insecureDowngrade?: boolean;
  readonly reason?: string;
  readonly retryAfterMs?: number;
  readonly privateOrigin?: string;
  readonly requiresPrivateOriginConfirmation?: boolean;
}
