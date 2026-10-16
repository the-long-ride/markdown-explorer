import type { FolderNode, MdFile, SidebarSortMode } from '../../types';
export interface SidebarItemMenuTarget {
  kind: 'file' | 'folder';
  path: string;
  anchor: HTMLElement;
}

export interface ScopeFocusTreeProps {
  editing: boolean;
  hideUnselected: boolean;
  selectedFilePaths: Set<string>;
  onFileChange: (filePath: string, checked: boolean) => void;
  onFolderChange: (filePaths: readonly string[], checked: boolean) => void;
}

export interface TreeOrderingProps {
  pinnedKeys: ReadonlySet<string>;
  sortMode: SidebarSortMode;
}

export const DEFAULT_TREE_ORDERING: TreeOrderingProps = {
  pinnedKeys: new Set(),
  sortMode: 'name-asc',
};

export interface FolderExpansionCommand {
  version: number;
  expanded: boolean;
}

export function matchesFileSearch(file: MdFile, q: string): boolean {
  if (!q) return true;
  return file.title.toLowerCase().includes(q)
    || file.relativePath.toLowerCase().includes(q);
}

export function getFolderFilePaths(node: FolderNode): string[] {
  return [
    ...node.files.map((file) => file.fsPath),
    ...node.children.flatMap(getFolderFilePaths),
  ];
}

export function getFolderSelectionState(
  node: FolderNode,
  selectedFilePaths: ReadonlySet<string>,
): { totalCount: number; selectedCount: number } {
  let totalCount = node.files.length;
  let selectedCount = node.files.reduce(
    (count, file) => count + (selectedFilePaths.has(file.fsPath) ? 1 : 0),
    0,
  );
  for (const child of node.children) {
    const childState = getFolderSelectionState(child, selectedFilePaths);
    totalCount += childState.totalCount;
    selectedCount += childState.selectedCount;
  }
  return { totalCount, selectedCount };
}

export function isFileVisible(file: MdFile, q: string, scopeFocus: ScopeFocusTreeProps): boolean {
  if (!matchesFileSearch(file, q)) return false;
  return !scopeFocus.hideUnselected || scopeFocus.selectedFilePaths.has(file.fsPath);
}

export function folderHasVisibleContent(
  node: FolderNode,
  q: string,
  scopeFocus: ScopeFocusTreeProps,
): boolean {
  if (!q && !scopeFocus.hideUnselected) return true;
  return node.files.some((file) => isFileVisible(file, q, scopeFocus))
    || node.children.some((child) => folderHasVisibleContent(child, q, scopeFocus));
}
