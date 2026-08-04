import type { WorkspaceSearchResult } from '../../types';

export interface SearchResultFileNode {
  kind: 'file';
  fsPath: string;
  fileName: string;
  relativePath: string;
  title: string;
  matches: WorkspaceSearchResult[];
}

export interface SearchResultFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: SearchResultFolderNode[];
  files: SearchResultFileNode[];
}

function relativeParts(result: WorkspaceSearchResult): string[] {
  const relativePath = result.relativePath || result.fileName || result.fsPath;
  return relativePath.split(/[\\/]+/).filter(Boolean);
}

export function buildSearchResultTree(
  fileMap: Map<string, WorkspaceSearchResult[]>,
): SearchResultFolderNode | null {
  if (fileMap.size === 0) return null;

  const root: SearchResultFolderNode = {
    kind: 'folder',
    name: 'root',
    path: '',
    children: [],
    files: [],
  };
  const childIndexes = new WeakMap<SearchResultFolderNode, Map<string, SearchResultFolderNode>>();
  const sortedFiles = [...fileMap.entries()].sort(([, left], [, right]) => {
    const leftPath = left[0]?.relativePath || left[0]?.fileName || left[0]?.fsPath || '';
    const rightPath = right[0]?.relativePath || right[0]?.fileName || right[0]?.fsPath || '';
    return leftPath.localeCompare(rightPath);
  });

  for (const [fsPath, matches] of sortedFiles) {
    const first = matches[0];
    if (!first) continue;
    const parts = relativeParts(first);
    const directories = parts.slice(0, -1);
    let node = root;

    for (let index = 0; index < directories.length; index += 1) {
      const name = directories[index];
      let childIndex = childIndexes.get(node);
      if (!childIndex) {
        childIndex = new Map();
        childIndexes.set(node, childIndex);
      }
      let child = childIndex.get(name);
      if (!child) {
        child = {
          kind: 'folder',
          name,
          path: directories.slice(0, index + 1).join('/'),
          children: [],
          files: [],
        };
        node.children.push(child);
        childIndex.set(name, child);
      }
      node = child;
    }

    node.files.push({
      kind: 'file',
      fsPath,
      fileName: first.fileName,
      relativePath: first.relativePath,
      title: first.title,
      matches,
    });
  }

  return root.files.length > 0 || root.children.length > 0 ? root : null;
}
