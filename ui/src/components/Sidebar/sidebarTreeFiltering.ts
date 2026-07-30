import type { FolderNode, MdFile } from '../../types';

export function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

export function matchesFileSearch(file: MdFile, filter: string): boolean {
  const query = filter.toLowerCase().trim();
  return !query || file.title.toLowerCase().includes(query) || file.relativePath.toLowerCase().includes(query);
}

export function folderHasVisibleContent(
  node: FolderNode,
  filter: string,
  hideUnselected: boolean,
  selectedFilePaths: Set<string>,
): boolean {
  return node.files.some((file) => matchesFileSearch(file, filter)
      && (!hideUnselected || selectedFilePaths.has(file.fsPath)))
    || node.children.some((child) => folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths));
}
