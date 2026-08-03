import type { FolderNode, MdFile, RecentWorkspace } from './files';
import type { RenderContentMessage, WorkspaceOperationMetadata } from './content';
import type { AppRuntime, HostPlatform, UpdateState, WorkspaceUnavailableReason } from './settings';

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

export interface WorkspaceTextResourceResultMessage {
  readonly command: 'workspaceTextResourceResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly content?: string;
  readonly resolvedPath?: string;
  readonly reason?: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported';
}

export type HostMessage =
  | RenderContentMessage | ReadyAckMessage | WorkspaceFilesChangedMessage
  | CurrentFileChangedMessage | RecentWorkspacesChangedMessage | NavNotFoundMessage
  | WorkspaceUnavailableMessage | SetLoadingMessage | WorkspaceScanProgressMessage
  | WorkspaceOpenCancelledMessage | UpdateStateChangedMessage | WindowStateChangedMessage
  | FullscreenStateChangedMessage | ExternalOpenPathMessage | CrossTabSearchResultsMessage
  | WorkspaceSearchResultsMessage | SearchPreviewResultMessage | WorkspaceSearchIndexLoadedMessage
  | WorkspaceTextResourceResultMessage;
