import type {
  FolderNode,
  Frontmatter,
  MdFile,
  ContentTab,
  TocEntry,
  WorkspaceUnavailableReason,
  DocumentPreviewInfo,
} from '../types';

export type DesktopTabKind = 'home' | 'new' | 'workspace';
export type SearchScope = 'current' | 'all-tabs';
export type WorkspaceAliasMap = Record<string, string>;

export interface DesktopTab {
  id: string;
  kind: DesktopTabKind;
  alias?: string;
  workspaceName?: string;
  workspacePath?: string;
  fileList: MdFile[];
  tree: FolderNode | null;
  currentFile: string | null;
  contentHtml: string;
  markdownSource: string | null;
  frontmatter: Frontmatter;
  toc: TocEntry[];
  previewInfo: DocumentPreviewInfo | null;
  relativePath: string;
  isLoading: boolean;
  notFoundHref: string | null;
  workspaceUnavailablePath: string | null;
  workspaceUnavailableReason: WorkspaceUnavailableReason | null;
  contentTabs: ContentTab[];
  activeContentTabPath: string | null;
  isIndexed?: boolean;
}

export interface FloatingToolbarPosition {
  x: number;
  y: number;
}

export interface FloatingToolbarSize {
  width: number;
  height: number;
}

export interface PendingSearchJump {
  filePath: string;
  query: string;
  matchOrdinal?: number;
  matchIndex?: number;
  token: number;
}

export interface PersistedDesktopTab {
  id: string;
  kind: DesktopTabKind;
  alias?: string;
  workspaceName?: string;
  workspacePath?: string;
  currentFile?: string | null;
}

export interface PersistedDesktopTabsState {
  activeTabId?: string;
  tabs?: PersistedDesktopTab[];
}

export interface InitialDesktopState {
  workspaceAliases: WorkspaceAliasMap;
  tabs: DesktopTab[];
  activeTabId: string;
}

export interface CrossTabSearchItem {
  tabId: string;
  tabLabel: string;
  fsPath: string;
  title: string;
  fileName: string;
  relativePath: string;
}
