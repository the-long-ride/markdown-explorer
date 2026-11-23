import { describe, expect, it } from 'vitest';
import { buildSearchResultTree } from '../../../../ui/src/components/Sidebar/sidebarSearchResultTree';
import { getWorkspaceScopeKey } from '../../../../ui/src/components/Sidebar/sidebarTreeFiltering';
import type { WorkspaceSearchResult } from '../../../../ui/src/types';

function result(relativePath: string, overrides: Partial<WorkspaceSearchResult> = {}): WorkspaceSearchResult {
  const normalized = relativePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').at(-1) ?? normalized;
  return {
    fsPath: `/workspace/${normalized}`,
    relativePath,
    fileName,
    title: fileName.replace(/\.md$/i, ''),
    ...overrides,
  };
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
    it('returns null for no matches', () => {
      expect(buildSearchResultTree(new Map())).toBeNull();
    });

    it('sorts and groups incomplete search hits by filename or filesystem path and skips empty groups', () => {
      const fallbackPath = result('', { fsPath: 'archive/notes.md', fileName: '' });
      const fallbackName = result('', { fsPath: '/workspace/other.md', fileName: 'begin.md' });
      const nested = result('zeta/readme.md');
      for (const hits of [[fallbackPath, fallbackName, nested], [nested, fallbackName, fallbackPath]]) {
        const input = new Map(hits.map(hit => [hit.fsPath, [hit]]));
        input.set('/workspace/deleted.md', []);
        const tree = buildSearchResultTree(input);
        expect(tree?.children.map(folder => folder.path)).toEqual(['archive', 'zeta']);
        expect(tree?.files.map(node => node.fileName)).toEqual(['begin.md']);
        expect(tree?.children[0].files[0].matches).toEqual([fallbackPath]);
      }
      expect(buildSearchResultTree(new Map([['/workspace/deleted.md', []]]))).toBeNull();
    });

    it('builds only folders represented by matching files', () => {
      const nested = result('guides/setup.md');
      const root = result('readme.md');
      const tree = buildSearchResultTree(new Map([
        [nested.fsPath, [nested]],
        [root.fsPath, [root]],
      ]));

      expect(tree?.files.map((file) => file.fileName)).toEqual(['readme.md']);
      expect(tree?.children.map((folder) => folder.path)).toEqual(['guides']);
      expect(tree?.children[0].files[0].matches).toEqual([nested]);
    });

    it('normalizes Windows separators and keeps path ordering stable', () => {
      const second = result('zeta\\second.md');
      const first = result('alpha\\first.md');
      const tree = buildSearchResultTree(new Map([
        [second.fsPath, [second]],
        [first.fsPath, [first]],
      ]));

      expect(tree?.children.map((folder) => folder.path)).toEqual(['alpha', 'zeta']);
    });
  });
});
