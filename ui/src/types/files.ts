export interface MdFile {
  readonly fsPath: string;
  readonly relativePath: string;
  readonly parts: readonly string[];
  readonly fileName: string;
  readonly title: string;
  readonly extension?: string;
  readonly documentKind?: 'markdown' | 'document';
  readonly modifiedAt?: number;
}

export interface FolderNode {
  readonly name: string;
  readonly path: string;
  readonly children: FolderNode[];
  readonly files: MdFile[];
  readonly modifiedAt?: number;
}

export interface RecentWorkspace {
  readonly name: string;
  readonly path: string;
  readonly lastOpened?: number;
}


export type SidebarItemKind = 'file' | 'folder';
export type SidebarSortMode =
  | 'name-asc'
  | 'name-desc'
  | 'modified-desc'
  | 'modified-asc';

export interface SidebarPinnedItem {
  readonly kind: SidebarItemKind;
  readonly path: string;
}
