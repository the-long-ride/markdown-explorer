import { describe, it, expect } from 'vitest';

function getWorkspaceScopeKey(
  workspacePath: string | undefined,
  workspaceName: string,
): string {
  return workspacePath || workspaceName || 'default';
}

interface SearchResultFileNode {
  kind: 'file';
  fsPath: string;
  fileName: string;
  relativePath: string;
  title: string;
  matches: any[];
}

interface SearchResultFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: SearchResultFolderNode[];
  files: SearchResultFileNode[];
}

interface FolderNode {
  name: string;
  path: string;
  files: { fsPath: string; fileName: string; relativePath: string; title: string }[];
  children: FolderNode[];
}

function buildSearchResultTree(
  node: FolderNode,
  fileMap: Map<string, any[]>,
): SearchResultFolderNode | null {
  const files: SearchResultFileNode[] = [];
  for (const file of node.files) {
    const matches = fileMap.get(file.fsPath);
    if (matches) {
      files.push({
        kind: 'file',
        fsPath: file.fsPath,
        fileName: file.fileName,
        relativePath: file.relativePath,
        title: file.title,
        matches,
      });
    }
  }

  const children: SearchResultFolderNode[] = [];
  for (const child of node.children) {
    const childTree = buildSearchResultTree(child, fileMap);
    if (childTree) children.push(childTree);
  }

  if (files.length > 0 || children.length > 0) {
    return { kind: 'folder', name: node.name, path: node.path, children, files };
  }
  return null;
}

describe('SidebarSearch pure functions', () => {
  describe('getWorkspaceScopeKey', () => {
    it('prefers workspacePath', () => {
      expect(getWorkspaceScopeKey('/docs', 'My Docs')).toBe('/docs');
    });

    it('falls back to workspaceName', () => {
      expect(getWorkspaceScopeKey(undefined, 'My Docs')).toBe('My Docs');
    });

    it('falls back to default', () => {
      expect(getWorkspaceScopeKey(undefined, '')).toBe('default');
    });
  });

  describe('buildSearchResultTree', () => {
    const makeNode = (
      name: string,
      path: string,
      files: any[] = [],
      children: FolderNode[] = [],
    ): FolderNode => ({ name, path, files, children });

    it('returns null when no files match', () => {
      const node = makeNode('root', '/root', [
        { fsPath: '/root/a.md', fileName: 'a.md', relativePath: 'a.md', title: 'A' },
      ]);
      expect(buildSearchResultTree(node, new Map())).toBeNull();
    });

    it('returns folder with matching files', () => {
      const matches = [{ line: 1, text: 'hit' }];
      const fileMap = new Map([['/root/a.md', matches]]);
      const node = makeNode('root', '/root', [
        { fsPath: '/root/a.md', fileName: 'a.md', relativePath: 'a.md', title: 'A' },
      ]);
      const result = buildSearchResultTree(node, fileMap);
      expect(result).not.toBeNull();
      expect(result!.files).toHaveLength(1);
      expect(result!.files[0].fsPath).toBe('/root/a.md');
    });

    it('includes nested child folders with matches', () => {
      const matches = [{ line: 1, text: 'hit' }];
      const fileMap = new Map([['/sub/b.md', matches]]);
      const child = makeNode('sub', '/root/sub', [
        { fsPath: '/sub/b.md', fileName: 'b.md', relativePath: 'sub/b.md', title: 'B' },
      ]);
      const root = makeNode('root', '/root', [], [child]);
      const result = buildSearchResultTree(root, fileMap);
      expect(result).not.toBeNull();
      expect(result!.children).toHaveLength(1);
      expect(result!.files).toHaveLength(0);
    });

    it('omits child folders without matches', () => {
      const matches = [{ line: 1, text: 'hit' }];
      const fileMap = new Map([['/root/a.md', matches]]);
      const childNoMatch = makeNode('empty', '/root/empty', [
        { fsPath: '/root/empty/c.md', fileName: 'c.md', relativePath: 'empty/c.md', title: 'C' },
      ]);
      const root = makeNode('root', '/root', [
        { fsPath: '/root/a.md', fileName: 'a.md', relativePath: 'a.md', title: 'A' },
      ], [childNoMatch]);
      const result = buildSearchResultTree(root, fileMap);
      expect(result).not.toBeNull();
      expect(result!.children).toHaveLength(0);
      expect(result!.files).toHaveLength(1);
    });

    it('returns null for empty tree', () => {
      const node = makeNode('root', '/root', [], []);
      expect(buildSearchResultTree(node, new Map())).toBeNull();
    });
  });
});
