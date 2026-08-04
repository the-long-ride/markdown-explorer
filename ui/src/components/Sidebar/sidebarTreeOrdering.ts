import type { FolderNode, MdFile, SidebarSortMode } from '../../types';

export type SidebarOrderedItem =
  | { kind: 'file'; key: string; file: MdFile }
  | { kind: 'folder'; key: string; folder: FolderNode };

interface SidebarOrderingOptions {
  sortMode: SidebarSortMode;
  pinnedKeys: ReadonlySet<string>;
  showTitle: boolean;
}

function getItemName(item: SidebarOrderedItem, showTitle: boolean): string {
  return item.kind === 'file'
    ? (showTitle ? item.file.title : item.file.fileName)
    : item.folder.name;
}

function getItemPath(item: SidebarOrderedItem): string {
  return item.kind === 'file' ? item.file.fsPath : item.folder.path;
}

function getModifiedAt(item: SidebarOrderedItem): number {
  return item.kind === 'file'
    ? item.file.modifiedAt ?? 0
    : item.folder.modifiedAt ?? 0;
}

export function orderSidebarLevel(
  files: readonly MdFile[],
  folders: readonly FolderNode[],
  options: SidebarOrderingOptions,
): SidebarOrderedItem[] {
  const items: SidebarOrderedItem[] = [
    ...files.map((file): SidebarOrderedItem => ({
      kind: 'file', key: `file:${file.fsPath}`, file,
    })),
    ...folders.map((folder): SidebarOrderedItem => ({
      kind: 'folder', key: `folder:${folder.path}`, folder,
    })),
  ];
  const direction = options.sortMode === 'name-desc' || options.sortMode === 'modified-desc'
    ? -1
    : 1;
  const byModified = options.sortMode.startsWith('modified');
  return items.sort((left, right) => {
    const leftPinned = options.pinnedKeys.has(left.key);
    const rightPinned = options.pinnedKeys.has(right.key);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
    if (byModified) {
      const modifiedDelta = getModifiedAt(left) - getModifiedAt(right);
      if (modifiedDelta !== 0) return modifiedDelta * direction;
    }
    const nameDelta = getItemName(left, options.showTitle).localeCompare(
      getItemName(right, options.showTitle), undefined, { sensitivity: 'base', numeric: true },
    );
    if (nameDelta !== 0) return nameDelta * (byModified ? 1 : direction);
    const pathDelta = getItemPath(left).localeCompare(getItemPath(right));
    if (pathDelta !== 0) return pathDelta;
    return left.kind.localeCompare(right.kind);
  });
}
