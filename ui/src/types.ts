// =============================================================================
// types.ts — Shared types for the UI layer
// Mirrors the extension host types.ts but independent (no Node imports)
// =============================================================================

/** A single .md file found in the workspace */
export interface MdFile {
  readonly fsPath: string;
  readonly relativePath: string;
  readonly parts: readonly string[];
  readonly fileName: string;
  readonly title: string;
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

// ── Host → Webview messages ─────────────────────────────────────────────────

export interface RenderContentMessage {
  readonly command: 'renderContent';
  readonly html: string;
  readonly markdownSource?: string | null;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly filePath: string;
  readonly relativePath: string;
  readonly title: string;
  readonly fileList: MdFile[];
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
  readonly workspacePath?: string;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly appVersion?: string;
  readonly appRuntime?: AppRuntime;
  readonly hostPlatform?: HostPlatform;
  readonly hostArch?: string;
}

export interface RecentWorkspacesChangedMessage {
  readonly command: 'recentWorkspacesChanged';
  readonly recentWorkspaces: readonly RecentWorkspace[];
}

export interface WindowStateChangedMessage {
  readonly command: 'window-state-changed';
  readonly isMaximized: boolean;
}

export interface CrossTabSearchResultsMessage {
  readonly command: 'crossTabSearchResults';
  readonly requestId: string;
  readonly results: readonly CrossTabSearchResult[];
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
}

export interface NavNotFoundMessage {
  readonly command: 'navNotFound';
  readonly href: string;
}

export type WorkspaceUnavailableReason = 'missing' | 'locked';

export interface WorkspaceUnavailableMessage {
  readonly command: 'workspaceUnavailable';
  readonly workspacePath: string;
  readonly workspaceName: string;
  readonly reason: WorkspaceUnavailableReason;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly appVersion?: string;
  readonly appRuntime?: AppRuntime;
  readonly hostPlatform?: HostPlatform;
  readonly hostArch?: string;
}

export type HostMessage =
  | RenderContentMessage
  | ReadyAckMessage
  | RecentWorkspacesChangedMessage
  | NavNotFoundMessage
  | WorkspaceUnavailableMessage
  | SetLoadingMessage
  | WindowStateChangedMessage
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
  readonly openFirstFile?: boolean;
}

export interface OpenFileMessage {
  readonly command: 'openFile';
}

export interface OpenPathMessage {
  readonly command: 'openPath';
  readonly path: string;
  readonly openFirstFile?: boolean;
}

export interface ActivateWorkspaceMessage {
  readonly command: 'activateWorkspace';
  readonly workspacePath: string;
  readonly filePath?: string;
  readonly openFirstFile?: boolean;
}

export interface CrossTabSearchMessage {
  readonly command: 'searchAcrossWorkspaces';
  readonly requestId: string;
  readonly query: string;
  readonly items: readonly CrossTabSearchResult[];
}

export interface WorkspaceSearchMessage {
  readonly command: 'searchWorkspace';
  readonly requestId: string;
  readonly query: string;
  readonly items?: readonly WorkspaceSearchResult[];
}

export interface IndexWorkspaceSearchItemsMessage {
  readonly command: 'indexWorkspaceSearchItems';
  readonly items: readonly CrossTabSearchResult[];
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
  readonly path: string;
  readonly openFirstFile?: boolean;
}

export interface CloseWorkspaceMessage {
  readonly command: 'closeWorkspace';
}

export interface DeleteRecentWorkspaceMessage {
  readonly command: 'deleteRecentWorkspace';
  readonly path: string;
}

export interface ReplaceRecentWorkspacesMessage {
  readonly command: 'replaceRecentWorkspaces';
  readonly recentWorkspaces: readonly RecentWorkspace[];
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



export type WebviewMessage =
  | NavigateMessage
  | OpenInEditorMessage
  | WebviewReadyMessage
  | CopyCodeMessage
  | RefreshMessage
  | OpenFolderMessage
  | OpenFileMessage
  | OpenPathMessage
  | ActivateWorkspaceMessage
  | CrossTabSearchMessage
  | WorkspaceSearchMessage
  | IndexWorkspaceSearchItemsMessage
  | LoadWorkspaceSearchIndexesMessage
  | ConfirmOpenPathMessage
  | OpenRecentWorkspaceMessage
  | CloseWorkspaceMessage
  | DeleteRecentWorkspaceMessage
  | ReplaceRecentWorkspacesMessage
  | ZoomInMessage
  | ZoomOutMessage
  | UpdateAppearanceMessage
  | OpenExternalMessage;

// ── UI state ────────────────────────────────────────────────────────────────

export type ThemeMode = 'auto' | 'light' | 'dark';
export type DesktopViewMode = 'focus' | 'tabs';
export type PetThemeStyle =
  | 'pet-white-shiba'
  | 'pet-shiba'
  | 'pet-shiba-memes'
  | 'pet-k-ink'
  | 'pet-cat'
  | 'pet-hamster'
  | 'pet-corgi';

export type ThemeStyle = 'default' | 'glass' | 'bento' | PetThemeStyle;

export type CustomThemeScheme = 'light' | 'dark';

export type CustomThemeColorKey =
  | 'bg'
  | 'surface'
  | 'elevated'
  | 'hover'
  | 'active'
  | 'code'
  | 'text'
  | 'textMuted'
  | 'textSoft'
  | 'textSubtle'
  | 'accent'
  | 'accentText'
  | 'border'
  | 'borderStrong'
  | 'success'
  | 'danger'
  | 'chart1'
  | 'chart2'
  | 'chart3'
  | 'chart4';

export type CustomThemeColorOverrides = Partial<Record<CustomThemeColorKey, string>>;

export interface CustomThemeLayout {
  readonly density?: 'compact' | 'comfortable' | 'spacious';
  readonly radius?: number;
  readonly strokeWidth?: number;
  readonly contentPadding?: number;
  readonly sectionGap?: number;
}

export interface CustomThemeBackground {
  readonly type?: 'none' | 'image';
  readonly imageDataUrl?: string;
  readonly opacity?: number;
  readonly fit?: 'cover' | 'contain';
  readonly position?: string;
  readonly blur?: number;
}

export interface CustomTheme {
  readonly id: string;
  readonly name: string;
  readonly baseStyle: ThemeStyle;
  readonly colorMode?: ThemeMode;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly colors?: Partial<Record<CustomThemeScheme, CustomThemeColorOverrides>>;
  readonly layout?: CustomThemeLayout;
  readonly background?: CustomThemeBackground;
}

export interface AppSettings {
  showTitle: boolean;
  defaultHtmlPreview: boolean;
  desktopViewMode?: DesktopViewMode;
  keybindings?: Record<string, string>;
  language?: string;
  customThemes?: CustomTheme[];
  activeCustomThemeId?: string;
}

export interface PersistedState {
  showTitle?: boolean;
  defaultHtmlPreview?: boolean;
  desktopViewMode?: DesktopViewMode;
  keybindings?: Record<string, string>;
  theme?: ThemeMode;
  themeStyle?: ThemeStyle;
  language?: string;
  customThemes?: CustomTheme[];
  activeCustomThemeId?: string;
}
