export interface MdFile {
  readonly fsPath: string;
  readonly relativePath: string;
  readonly parts: readonly string[];
  readonly fileName: string;
  readonly title: string;
  readonly extension?: string;
  readonly documentKind?: 'markdown' | 'document';
}

export interface FolderNode {
  readonly name: string;
  readonly path: string;
  readonly children: FolderNode[];
  readonly files: MdFile[];
}

export interface RecentWorkspace {
  readonly name: string;
  readonly path: string;
  readonly lastOpened?: number;
}
