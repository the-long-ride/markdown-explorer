// ============================================================
// types.ts — Shared interfaces across the extension
// ============================================================

/** A single .md file found in the workspace */
export interface MdFile {
  readonly fsPath: string;
  readonly relativePath: string;
  /** Path segments split by OS separator */
  readonly parts: readonly string[];
  readonly fileName: string;
  /** First H1 heading, or filename without extension */
  readonly title: string;
  readonly extension?: string;
  readonly documentKind?: 'markdown' | 'document';
}

/** Folder node in the sidebar tree */
export interface FolderNode {
  readonly name: string;
  /** Relative path from workspace root */
  readonly path: string;
  readonly children: FolderNode[];
  readonly files: MdFile[];
}

/** Root result from WorkspaceScanner */
export interface ScanResult {
  readonly tree: FolderNode;
  readonly flat: MdFile[];
}

/** Parsed frontmatter key-value pairs */
export type Frontmatter = Record<string, string>;

/** Rendered markdown result */
export interface RenderResult {
  readonly html: string;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
}

/** Table of contents entry */
export interface TocEntry {
  readonly level: number;
  readonly text: string;
  readonly id: string;
}

export interface DocumentPreviewInfo {
  readonly kind: 'converted' | 'text';
  readonly sourceExtension: string;
  readonly sourceLabel: string;
  readonly durationMs?: number;
  readonly fromCache?: boolean;
  readonly qualityWarning?: string;
}

// ── Webview message types (host → webview) ──────────────────

export interface RenderContentMessage {
  readonly command: 'renderContent';
  readonly html: string;
  readonly markdownSource?: string;
  readonly sourceDocumentText?: string | null;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly filePath: string;
  readonly relativePath: string;
  readonly title: string;
  readonly fileList: MdFile[];
  readonly previewInfo?: DocumentPreviewInfo | null;
}

export interface RecentWorkspace {
  readonly name: string;
  readonly path: string;
  readonly lastOpened?: number;
}

export type AppRuntime = 'desktop' | 'vscode';
export type HostPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export interface ReadyAckMessage {
  readonly command: 'readyAck';
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly theme: string;
  readonly themeStyle?: string;
  readonly defaultExpanded: boolean;
  readonly workspaceName: string;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly appVersion?: string;
  readonly appRuntime?: AppRuntime;
  readonly hostPlatform?: HostPlatform;
  readonly hostArch?: string;
  readonly documentConversionEnabled?: boolean;
}

export interface NavNotFoundMessage {
  readonly command: 'navNotFound';
  readonly href: string;
}

export interface SetLoadingMessage {
  readonly command: 'setLoading';
  readonly label?: string;
  readonly detail?: string;
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
}

export interface WorkspaceSearchResultsMessage {
  readonly command: 'workspaceSearchResults';
  readonly requestId: string;
  readonly results: readonly WorkspaceSearchResult[];
}

export interface WorkspaceFilesChangedMessage {
  readonly command: 'workspaceFilesChanged';
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly documentConversionEnabled?: boolean;
}

export interface CurrentFileChangedMessage {
  readonly command: 'currentFileChanged';
  readonly filePath: string;
}

export type HostMessage =
  | RenderContentMessage
  | ReadyAckMessage
  | NavNotFoundMessage
  | SetLoadingMessage
  | WorkspaceSearchResultsMessage
  | WorkspaceFilesChangedMessage
  | CurrentFileChangedMessage;

// ── Webview message types (webview → host) ──────────────────

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

export interface WorkspaceSearchMessage {
  readonly command: 'searchWorkspace';
  readonly requestId: string;
  readonly query: string;
  readonly items?: readonly WorkspaceSearchResult[];
}

export interface OpenFolderMessage {
  readonly command: 'openFolder';
}

export interface OpenFileMessage {
  readonly command: 'openFile';
}

export interface OpenPathMessage {
  readonly command: 'openPath';
  readonly path: string;
}

export interface ConfirmOpenPathMessage {
  readonly command: 'confirmOpenPath';
  readonly path: string;
}



export interface OpenRecentWorkspaceMessage {
  readonly command: 'openRecentWorkspace';
  readonly path: string;
}

export interface CloseWorkspaceMessage {
  readonly command: 'closeWorkspace';
}

export interface DeleteRecentWorkspaceMessage {
  readonly command: 'deleteRecentWorkspace';
  readonly path: string;
}

export interface ZoomInMessage {
  readonly command: 'zoom-in';
}

export interface ZoomOutMessage {
  readonly command: 'zoom-out';
}

export interface UpdateAppearanceMessage {
  readonly command: 'updateAppearance';
  readonly theme: 'auto' | 'light' | 'dark';
  readonly themeStyle:
    | 'default'
    | 'glass'
    | 'bento'
    | 'vercel'
    | 'tokyo-night'
    | 'pet-white-shiba'
    | 'pet-k-ink'
    | 'pet-cat'
    | 'pet-hamster'
    | 'pet-corgi';
}


export interface ReadWorkspaceTextResourceMessage {
  readonly command: 'readWorkspaceTextResource';
  readonly requestId: string;
  readonly documentPath: string;
  readonly resourcePath: string;
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

export type WebviewMessage =
  | ReadWorkspaceTextResourceMessage
  | NavigateMessage
  | OpenInEditorMessage
  | WebviewReadyMessage
  | CopyCodeMessage
  | RefreshMessage
  | WorkspaceSearchMessage
  | OpenFolderMessage
  | OpenFileMessage
  | OpenPathMessage
  | ConfirmOpenPathMessage
  | OpenRecentWorkspaceMessage
  | CloseWorkspaceMessage
  | DeleteRecentWorkspaceMessage
  | ZoomInMessage
  | ZoomOutMessage
  | UpdateAppearanceMessage
  | OpenExternalMessage
  | OpenHtmlPreviewMessage
  | SetDocumentConversionMessage;
