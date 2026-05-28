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

export interface ReadyAckMessage {
  readonly command: 'readyAck';
  readonly fileList: MdFile[];
  readonly tree: FolderNode | null;
  readonly theme: string;
  readonly themeStyle?: string;
  readonly defaultExpanded: boolean;
  readonly workspaceName: string;
  readonly recentWorkspaces?: readonly RecentWorkspace[];
}

export interface WindowStateChangedMessage {
  readonly command: 'window-state-changed';
  readonly isMaximized: boolean;
}

export interface NavNotFoundMessage {
  readonly command: 'navNotFound';
  readonly href: string;
}

export type HostMessage =
  | RenderContentMessage
  | ReadyAckMessage
  | NavNotFoundMessage
  | WindowStateChangedMessage;

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
  readonly theme: ThemeMode;
  readonly themeStyle: ThemeStyle;
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
  | ConfirmOpenPathMessage
  | OpenRecentWorkspaceMessage
  | CloseWorkspaceMessage
  | DeleteRecentWorkspaceMessage
  | ZoomInMessage
  | ZoomOutMessage
  | UpdateAppearanceMessage;

// ── UI state ────────────────────────────────────────────────────────────────

export type ThemeMode = 'auto' | 'light' | 'dark';
export type PetThemeStyle =
  | 'pet-white-shiba'
  | 'pet-shiba'
  | 'pet-shiba-memes'
  | 'pet-cat'
  | 'pet-hamster'
  | 'pet-corgi';

export type ThemeStyle = 'default' | 'glass' | 'bento' | PetThemeStyle;

export interface AppSettings {
  showTitle: boolean;
  defaultHtmlPreview: boolean;
  keybindings?: Record<string, string>;
}

export interface PersistedState {
  showTitle?: boolean;
  defaultHtmlPreview?: boolean;
  keybindings?: Record<string, string>;
  theme?: ThemeMode;
  themeStyle?: ThemeStyle;
}
