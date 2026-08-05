export const BOOKMARK_DOCUMENT_VERSION = 2 as const;

export type BookmarkSortMode = 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
export type BookmarkTargetKind = 'text' | 'code' | 'math' | 'mermaid' | 'image' | 'link';

export interface BookmarkSourceAnchor {
  readonly start: number;
  readonly end: number;
  readonly fragment: string;
  readonly fingerprint: string;
  readonly occurrence: number;
  readonly prefix: string;
  readonly suffix: string;
}

export interface BookmarkObjectIdentity {
  readonly mathSource?: string;
  readonly mermaidSource?: string;
  readonly url?: string;
  readonly label?: string;
  readonly alt?: string;
}

export interface BookmarkRecord {
  readonly id: string;
  readonly name: string;
  readonly workspaceKey: string;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly filePath: string;
  readonly targetKind: BookmarkTargetKind;
  readonly sourceAnchor: BookmarkSourceAnchor;
  readonly objectIdentity?: BookmarkObjectIdentity;
  readonly renderedText: string;
  /** Version-1 compatibility fields retained for search/import consumers. */
  readonly selectedText: string;
  readonly matchOrdinal: number;
  readonly matchIndex: number;
  readonly prefix: string;
  readonly suffix: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface BookmarkDocument {
  readonly version: typeof BOOKMARK_DOCUMENT_VERSION;
  readonly items: readonly BookmarkRecord[];
}

export interface BookmarkSelectionCapture {
  readonly selectedText: string;
  readonly matchOrdinal: number;
  readonly matchIndex: number;
  readonly prefix: string;
  readonly suffix: string;
}

export type BookmarkResolution =
  | {
      readonly status: 'resolved';
      readonly sourceStart: number;
      readonly sourceEnd: number;
      readonly occurrence: number;
      readonly kind: BookmarkTargetKind;
    }
  | { readonly status: 'targetChanged' };

/** Legacy alias used by older call sites while navigation moves to BookmarkResolution. */
export interface BookmarkTarget {
  readonly index: number;
  readonly matchOrdinal: number;
}

export interface OpenBookmarkWorkspace {
  readonly id: string;
  readonly workspaceKey: string;
  readonly workspaceName: string;
  readonly workspacePath?: string;
}

export interface BookmarkWorkspaceGroup extends OpenBookmarkWorkspace {
  readonly active: boolean;
  readonly bookmarks: readonly BookmarkRecord[];
}
