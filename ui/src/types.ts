// =============================================================================
// types.ts — Shared types for the UI layer
// Mirrors the extension host types.ts but independent (no Node imports)
// =============================================================================

import type { ThemeMode, ThemeStyle } from './themeTypes';

/** A single .md file found in the workspace */
export interface MdFile {
  readonly fsPath: string;
  readonly relativePath: string;
  readonly parts: readonly string[];
  readonly fileName: string;
  readonly title: string;
  readonly extension?: string;
  readonly documentKind?: 'markdown' | 'document';
}

/** Folder node in the sidebar tree */
export interface FolderNode {
  readonly name: string;
  readonly path: string;
  readonly children: FolderNode[];
  readonly files: MdFile[];
}

/** Table of contents entry */
export interface TocEntry {
  readonly level: number;
  readonly text: string;
  readonly id: string;
}

/** Parsed frontmatter key-value pairs */
export type Frontmatter = Record<string, string>;

export interface DocumentPreviewInfo {
  readonly kind: 'converted' | 'text';
  readonly sourceExtension: string;
  readonly sourceLabel: string;
  readonly durationMs?: number;
  readonly fromCache?: boolean;
  readonly qualityWarning?: string;
}

export interface UpdateState {
  readonly status: 'idle' | 'downloading' | 'downloaded' | 'scheduled-on-exit' | 'applying' | 'error';
  readonly version?: string;
  readonly downloadedVersion?: string;
  readonly downloadedFileName?: string;
  readonly stagedFilePath?: string;
  readonly progressPercent?: number;
  readonly error?: string;
}

// ── Host → Webview messages ─────────────────────────────────────────────────

export interface WorkspaceOperationMetadata {
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
}

export interface RenderContentMessage {
  readonly command: 'renderContent';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly html: string;
  readonly markdownSource?: string | null;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly filePath: string;
  readonly relativePath: string;
  readonly title: string;
  readonly fileList: MdFile[];
  readonly previewInfo?: DocumentPreviewInfo | null;
}

export interface ContentTab {
  readonly filePath: string;
  readonly relativePath: string;
  readonly fileName: string;
  readonly title: string;
  readonly contentHtml: string;
  readonly markdownSource: string | null;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly previewInfo: DocumentPreviewInfo | null;
}

export interface RecentWorkspace {
  readonly name: string;
  readonly path: string;
  readonly lastOpened?: number;
}

export type AppRuntime = 'desktop' | 'vscode' | 'chrome' | 'tauri';
export type HostPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export interface ReadyAckMessage {
  readonly command: 'readyAck';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
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

export interface WorkspaceFilesChangedMessage {
  readonly command: 'workspaceFilesChanged';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly documentConversionEnabled?: boolean;
}

export interface CurrentFileChangedMessage {
  readonly command: 'currentFileChanged';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly filePath: string;
}

export interface RecentWorkspacesChangedMessage {
  readonly command: 'recentWorkspacesChanged';
  readonly recentWorkspaces: readonly RecentWorkspace[];
}

export interface WindowStateChangedMessage {
  readonly command: 'window-state-changed';
  readonly isMaximized: boolean;
}

export interface FullscreenStateChangedMessage {
  readonly command: 'fullscreenChanged';
  readonly isFullscreen: boolean;
}

export interface ExternalOpenPathMessage {
  readonly command: 'externalOpenPath';
  readonly path: string;
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

export interface WorkspaceSearchIndexLoadedMessage {
  readonly command: 'workspaceSearchIndexLoaded';
  readonly tabs: readonly {
    readonly tabId: string;
    readonly workspacePath: string;
    readonly fileList: MdFile[];
    readonly tree: FolderNode | null;
  }[];
}

export interface SetLoadingMessage {
  readonly command: 'setLoading';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly label?: string;
  readonly detail?: string;
}

export interface WorkspaceScanProgressMessage {
  readonly command: 'workspaceScanProgress';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly scannedFiles: number;
  readonly active: boolean;
}

export interface UpdateStateChangedMessage {
  readonly command: 'updateStateChanged';
  readonly state: UpdateState;
}

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

export interface NavNotFoundMessage {
  readonly command: 'navNotFound';
  readonly href: string;
}

export type WorkspaceUnavailableReason = 'missing' | 'locked';

export interface WorkspaceUnavailableMessage {
  readonly command: 'workspaceUnavailable';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
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

export type HostMessage =
  | RenderContentMessage
  | ReadyAckMessage
  | WorkspaceFilesChangedMessage
  | CurrentFileChangedMessage
  | RecentWorkspacesChangedMessage
  | NavNotFoundMessage
  | WorkspaceUnavailableMessage
  | SetLoadingMessage
  | WorkspaceScanProgressMessage
  | UpdateStateChangedMessage
  | WindowStateChangedMessage
  | FullscreenStateChangedMessage
  | ExternalOpenPathMessage
  | CrossTabSearchResultsMessage
  | WorkspaceSearchResultsMessage
  | WorkspaceSearchIndexLoadedMessage;

// ── Webview → Host messages ─────────────────────────────────────────────────

export interface NavigateMessage {
  readonly command: 'navigate';
  readonly path: string;
}

export interface OpenInEditorMessage {
  readonly command: 'openInEditor';
  readonly path: string;
}

export interface WebviewReadyMessage {
  readonly command: 'ready';
  readonly documentConversionEnabled?: boolean;
}

export interface CopyCodeMessage {
  readonly command: 'copyCode';
  readonly text: string;
}

export interface RefreshMessage {
  readonly command: 'refresh';
}

export interface OpenFolderMessage {
  readonly command: 'openFolder';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly openFirstFile?: boolean;
  readonly handle?: any;
}

export interface OpenFileMessage {
  readonly command: 'openFile';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
}

export interface OpenFileHandleMessage {
  readonly command: 'openFileHandle';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly handle?: any;
}

export interface OpenPathMessage {
  readonly command: 'openPath';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly path: string;
  readonly openFirstFile?: boolean;
}

export interface ActivateWorkspaceMessage {
  readonly command: 'activateWorkspace';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly workspacePath: string;
  readonly filePath?: string;
  readonly openFirstFile?: boolean;
}

export interface CrossTabSearchMessage {
  readonly command: 'searchAcrossWorkspaces';
  readonly requestId: string;
  readonly query: string;
  readonly items?: readonly CrossTabSearchResult[];
}

export interface WorkspaceSearchMessage {
  readonly command: 'searchWorkspace';
  readonly requestId: string;
  readonly query: string;
  readonly items: readonly WorkspaceSearchResult[];
}

export interface IndexWorkspaceSearchItemsMessage {
  readonly command: 'indexWorkspaceSearchItems';
  readonly items?: readonly CrossTabSearchResult[];
}

export interface LoadWorkspaceSearchIndexesMessage {
  readonly command: 'loadWorkspaceSearchIndexes';
  readonly tabs: readonly {
    readonly tabId: string;
    readonly workspacePath: string;
  }[];
}

export interface ConfirmOpenPathMessage {
  readonly command: 'confirmOpenPath';
  readonly path: string;
}

export interface OpenRecentWorkspaceMessage {
  readonly command: 'openRecentWorkspace';
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
  readonly path: string;
  readonly openFirstFile?: boolean;
}

export interface CloseWorkspaceMessage {
  readonly command: 'closeWorkspace';
  readonly workspaceOperationId?: string;
}

export interface CancelWorkspaceScanMessage {
  readonly command: 'cancelWorkspaceScan';
  readonly workspaceOperationId: string;
}

export interface CancelAllWorkspaceScansMessage {
  readonly command: 'cancelAllWorkspaceScans';
}

export interface DeleteRecentWorkspaceMessage {
  readonly command: 'deleteRecentWorkspace';
  readonly path: string;
}

export interface ReplaceRecentWorkspacesMessage {
  readonly command: 'replaceRecentWorkspaces';
  readonly recentWorkspaces: readonly RecentWorkspace[];
}

export interface WindowMinimizeMessage {
  readonly command: 'window-minimize';
}

export interface WindowMaximizeMessage {
  readonly command: 'window-maximize';
}

export interface WindowCloseMessage {
  readonly command: 'window-close';
}

export interface ToggleFullscreenMessage {
  readonly command: 'toggle-fullscreen';
}

export interface ZoomInMessage {
  readonly command: 'zoom-in';
}

export interface ZoomOutMessage {
  readonly command: 'zoom-out';
}

export interface UpdateAppearanceMessage {
  readonly command: 'updateAppearance';
  readonly theme: ThemeMode;
  readonly themeStyle: ThemeStyle;
}

export interface OpenExternalMessage {
  readonly command: 'openExternal';
  readonly url: string;
}

export interface OpenHtmlPreviewMessage {
  readonly command: 'openHtmlPreview';
  readonly documentHtml: string;
}

export interface SetDocumentConversionMessage {
  readonly command: 'setDocumentConversion';
  readonly enabled: boolean;
}

export interface DownloadUpdateMessage {
  readonly command: 'downloadUpdate';
  readonly version: string;
  readonly url: string;
}

export interface ScheduleDownloadedUpdateMessage {
  readonly command: 'scheduleDownloadedUpdate';
}

export interface RestartAndApplyUpdateMessage {
  readonly command: 'restartAndApplyUpdate';
}

export type WebviewMessage =
  | NavigateMessage
  | OpenInEditorMessage
  | WebviewReadyMessage
  | CopyCodeMessage
  | RefreshMessage
  | OpenFolderMessage
  | OpenFileMessage
  | OpenFileHandleMessage
  | OpenPathMessage
  | ActivateWorkspaceMessage
  | CrossTabSearchMessage
  | WorkspaceSearchMessage
  | IndexWorkspaceSearchItemsMessage
  | LoadWorkspaceSearchIndexesMessage
  | ConfirmOpenPathMessage
  | OpenRecentWorkspaceMessage
  | CloseWorkspaceMessage
  | CancelWorkspaceScanMessage
  | CancelAllWorkspaceScansMessage
  | DeleteRecentWorkspaceMessage
  | ReplaceRecentWorkspacesMessage
  | ZoomInMessage
  | ZoomOutMessage
  | WindowMinimizeMessage
  | WindowMaximizeMessage
  | WindowCloseMessage
  | ToggleFullscreenMessage
  | UpdateAppearanceMessage
  | OpenExternalMessage
  | OpenHtmlPreviewMessage
  | SetDocumentConversionMessage
  | DownloadUpdateMessage
  | ScheduleDownloadedUpdateMessage
  | RestartAndApplyUpdateMessage;

export type {
  AppSettings,
  CustomTheme,
  CustomThemeBackground,
  CustomThemeColorKey,
  CustomThemeColorOverrides,
  CustomThemeLayout,
  CustomThemeScheme,
  DesktopViewMode,
  PersistedState,
  PetThemeStyle,
  ThemeMode,
  ThemeStyle,
} from './themeTypes';
