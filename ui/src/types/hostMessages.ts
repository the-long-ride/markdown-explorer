import type { FolderNode, MdFile, RecentWorkspace } from './files';
import type { DocumentRevisionToken, RenderContentMessage, WorkspaceOperationMetadata } from './content';
import type { AppRuntime, HostPlatform, UpdateState, WorkspaceUnavailableReason } from './settings';
import type { DesktopFontFamily } from '../desktop/fonts/fontModel';
import type { GitCapability, GitRevisionSnapshot, GitRevisionSummary } from '../history/contracts';
import type {
  ExternalLinkCheckResult,
  InsightsFsDelta,
  InsightsRuntimeCapabilities,
  InsightsScanBatch,
  InsightsScanComplete,
  InsightsSourceResult,
  WorkspaceResourceProbeResult,
} from '../insights/contracts';

export interface ReadyAckMessage extends WorkspaceOperationMetadata {
  readonly command: 'readyAck';
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly theme: string;
  readonly themeStyle?: string;
  readonly defaultExpanded: boolean;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly appVersion?: string;
  readonly appRuntime?: AppRuntime;
  readonly hostPlatform?: HostPlatform;
  readonly hostArch?: string;
  readonly canInstallUpdates?: boolean;
  readonly documentConversionEnabled?: boolean;
  readonly isMaximized?: boolean;
  readonly isFullscreen?: boolean;
}

export interface WorkspaceFilesChangedMessage extends WorkspaceOperationMetadata {
  readonly command: 'workspaceFilesChanged';
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly documentConversionEnabled?: boolean;
}

export interface CurrentFileChangedMessage extends WorkspaceOperationMetadata {
  readonly command: 'currentFileChanged';
  readonly filePath: string;
}

export interface RecentWorkspacesChangedMessage {
  readonly command: 'recentWorkspacesChanged';
  readonly recentWorkspaces: readonly RecentWorkspace[];
}

export interface WindowStateChangedMessage { readonly command: 'window-state-changed'; readonly isMaximized: boolean; }
export interface FullscreenStateChangedMessage { readonly command: 'fullscreenChanged'; readonly isFullscreen: boolean; }
export type ExternalOpenRequest =
  | { readonly mode: 'file'; readonly filePath: string }
  | { readonly mode: 'folder'; readonly folderPath: string }
  | { readonly mode: 'file-with-parent-workspace'; readonly filePath: string; readonly folderPath: string };
export interface ExternalOpenRequestMessage { readonly command: 'externalOpenRequest'; readonly request: ExternalOpenRequest; }
export interface ExternalOpenPathMessage { readonly command: 'externalOpenPath'; readonly path: string; }

export interface CrossTabSearchResult {
  readonly tabId: string;
  readonly tabLabel: string;
  readonly fsPath: string;
  readonly title: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly excerpt?: string;
  readonly matchIndex?: number;
  readonly matchOrdinal?: number;
}

export interface WorkspaceSearchResult {
  readonly fsPath: string;
  readonly title: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly excerpt?: string;
  readonly matchIndex?: number;
  readonly matchOrdinal?: number;
  readonly matchLength?: number;
  readonly lineNumber?: number;
}

export interface CrossTabSearchResultsMessage {
  readonly command: 'crossTabSearchResults';
  readonly requestId: string;
  readonly results: readonly CrossTabSearchResult[];
  readonly done?: boolean;
  readonly total?: number;
  readonly truncated?: boolean;
  readonly cancelled?: boolean;
  readonly error?: string;
}

export interface WorkspaceSearchResultsMessage {
  readonly command: 'workspaceSearchResults';
  readonly requestId: string;
  readonly results: readonly WorkspaceSearchResult[];
}

export interface SearchPreviewResultMessage {
  readonly command: 'searchPreviewResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly filePath: string;
  readonly markdownSource?: string;
  readonly reason?: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported' | 'too-large';
}

export interface WorkspaceSearchIndexLoadedMessage {
  readonly command: 'workspaceSearchIndexLoaded';
  readonly tabs: readonly { readonly tabId: string; readonly workspacePath: string; readonly fileList: MdFile[]; readonly tree: FolderNode | null }[];
}

export interface SetLoadingMessage extends WorkspaceOperationMetadata {
  readonly command: 'setLoading';
  readonly label?: string;
  readonly detail?: string;
}

export interface WorkspaceScanProgressMessage extends WorkspaceOperationMetadata {
  readonly command: 'workspaceScanProgress';
  readonly scannedFiles: number;
  readonly active: boolean;
}

export interface WorkspaceOpenCancelledMessage extends WorkspaceOperationMetadata { readonly command: 'workspaceOpenCancelled'; }
export interface UpdateStateChangedMessage { readonly command: 'updateStateChanged'; readonly state: UpdateState; }
export interface NavNotFoundMessage { readonly command: 'navNotFound'; readonly href: string; }

export interface WorkspaceUnavailableMessage extends WorkspaceOperationMetadata {
  readonly command: 'workspaceUnavailable';
  readonly workspacePath: string;
  readonly workspaceName: string;
  readonly reason: WorkspaceUnavailableReason;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly appVersion?: string;
  readonly appRuntime?: AppRuntime;
  readonly hostPlatform?: HostPlatform;
  readonly hostArch?: string;
  readonly canInstallUpdates?: boolean;
  readonly isMaximized?: boolean;
}

export interface DesktopFontsResultMessage {
  readonly command: 'desktopFontsResult';
  readonly requestId: string;
  readonly fonts: readonly DesktopFontFamily[];
  readonly importedId?: string;
  readonly error?: string;
}

export interface WorkspaceTextResourceResultMessage {
  readonly command: 'workspaceTextResourceResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly content?: string;
  readonly resolvedPath?: string;
  readonly reason?: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported';
}

export type ExportWorkspaceResourceHostFailureReason =
  | 'outside-workspace'
  | 'missing'
  | 'unreadable'
  | 'unsupported'
  | 'too-large';

export interface WorkspaceExportResourceResultMessage {
  readonly command: 'workspaceExportResourceResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly relativePath?: string;
  readonly mimeType?: string;
  readonly dataBase64?: string;
  readonly reason?: ExportWorkspaceResourceHostFailureReason;
}

export interface SaveDocumentResultMessage {
  readonly command: 'saveDocumentResult';
  readonly requestId: string;
  readonly filePath: string;
  readonly ok: boolean;
  readonly revision?: DocumentRevisionToken;
  readonly diskSource?: string;
  readonly diskRevision?: DocumentRevisionToken;
  readonly reason?: 'conflict' | 'permission-denied' | 'missing' | 'outside-workspace' | 'read-only' | 'write-failed';
  readonly error?: string;
}

export interface GitCapabilityResultMessage {
  readonly command: 'gitCapabilityResult';
  readonly requestId: string;
  readonly capability: GitCapability;
}

export interface DocumentHistoryResultMessage {
  readonly command: 'documentHistoryResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly revisions: readonly GitRevisionSummary[];
  readonly reason?: string;
}

export interface GitRevisionResultMessage {
  readonly command: 'gitRevisionResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly snapshot?: GitRevisionSnapshot;
  readonly reason?: string;
}

export interface GitComparisonResultMessage {
  readonly command: 'gitComparisonResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly leftSource?: string;
  readonly rightSource?: string;
  readonly leftLabel?: string;
  readonly rightLabel?: string;
  readonly reason?: string;
}

export interface InsightsScanBatchMessage extends InsightsScanBatch { readonly command: 'insightsScanBatch'; }
export interface InsightsScanCompleteMessage extends InsightsScanComplete { readonly command: 'insightsScanComplete'; }
export interface InsightsDocumentSourceResultMessage extends InsightsSourceResult { readonly command: 'insightsDocumentSourceResult'; }
export interface WorkspaceResourceProbeResultMessage extends WorkspaceResourceProbeResult {
  readonly command: 'workspaceResourceProbeResult';
  readonly requestId: string;
}
export interface InsightsFsDeltaMessage {
  readonly command: 'insightsFsDelta';
  readonly requestId: string;
  readonly workspaceOperationId?: string;
  readonly deltas: readonly InsightsFsDelta[];
}
export interface InsightsRuntimeCapabilitiesMessage {
  readonly command: 'insightsRuntimeCapabilities';
  readonly requestId: string;
  readonly capabilities: InsightsRuntimeCapabilities;
}
export interface ExternalLinkCheckResultMessage extends ExternalLinkCheckResult { readonly command: 'externalLinkCheckResult'; }
export interface ExternalLinkCheckCompleteMessage {
  readonly command: 'externalLinkCheckComplete';
  readonly requestId: string;
  readonly cancelled: boolean;
}

export interface ChartPngSaveResultMessage {
  readonly command: 'chartPngSaveResult';
  readonly ok: boolean;
  readonly path?: string;
  readonly error?: string;
  readonly requestId?: string;
}

export type HostMessage =
  | RenderContentMessage | ReadyAckMessage | WorkspaceFilesChangedMessage
  | CurrentFileChangedMessage | RecentWorkspacesChangedMessage | NavNotFoundMessage
  | WorkspaceUnavailableMessage | SetLoadingMessage | WorkspaceScanProgressMessage
  | WorkspaceOpenCancelledMessage | UpdateStateChangedMessage | WindowStateChangedMessage
  | FullscreenStateChangedMessage | ExternalOpenRequestMessage | ExternalOpenPathMessage | CrossTabSearchResultsMessage
  | WorkspaceSearchResultsMessage | SearchPreviewResultMessage | WorkspaceSearchIndexLoadedMessage
  | WorkspaceTextResourceResultMessage | WorkspaceExportResourceResultMessage | SaveDocumentResultMessage
  | GitCapabilityResultMessage | DocumentHistoryResultMessage | GitRevisionResultMessage | GitComparisonResultMessage
  | InsightsScanBatchMessage | InsightsScanCompleteMessage | InsightsDocumentSourceResultMessage
  | WorkspaceResourceProbeResultMessage | InsightsFsDeltaMessage | InsightsRuntimeCapabilitiesMessage
  | ExternalLinkCheckResultMessage | ExternalLinkCheckCompleteMessage
  | DesktopFontsResultMessage | ChartPngSaveResultMessage;
