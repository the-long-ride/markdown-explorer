import { describe, it, expect } from 'vitest';

function getWorkspaceScopeKey(
  workspacePath: string | undefined,
  workspaceName: string,
): string {
  return workspacePath || workspaceName || 'default';
}

function matchesFileSearch(
  file: { title: string; relativePath: string },
  filter: string,
): boolean {
  const q = filter.toLowerCase().trim();
  if (!q) return true;
  return (
    file.title.toLowerCase().includes(q) ||
    file.relativePath.toLowerCase().includes(q)
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function folderHasVisibleContent(
  node: any,
  filter: string,
  hideUnselected: boolean,
  selectedFilePaths: Set<string>,
): boolean {
  return (
    node.files.some(
      (file: any) =>
        matchesFileSearch(file, filter) &&
        (!hideUnselected || selectedFilePaths.has(file.fsPath)),
    ) ||
    node.children.some((child: any) =>
      folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
    )
  );
}

describe('Sidebar pure functions', () => {
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

  describe('matchesFileSearch', () => {
    const file = { title: 'Readme', relativePath: 'docs/readme.md' };

    it('returns true for empty filter', () => {
      expect(matchesFileSearch(file, '')).toBe(true);
    });

    it('returns true for whitespace-only filter', () => {
      expect(matchesFileSearch(file, '   ')).toBe(true);
    });

    it('matches title case-insensitively', () => {
      expect(matchesFileSearch(file, 'readme')).toBe(true);
      expect(matchesFileSearch(file, 'README')).toBe(true);
    });

    it('matches relativePath case-insensitively', () => {
      expect(matchesFileSearch(file, 'docs/')).toBe(true);
    });

    it('returns false for non-matching filter', () => {
      expect(matchesFileSearch(file, 'guide')).toBe(false);
    });

    it('matches partial title', () => {
      expect(matchesFileSearch(file, 'ead')).toBe(true);
    });

    it('matches partial relativePath', () => {
      expect(matchesFileSearch(file, 'readme.md')).toBe(true);
    });
  });

  describe('isEditableTarget', () => {
    it('returns false for null', () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it('returns true for contentEditable element', () => {
      const el = document.createElement('div');
      el.setAttribute('contenteditable', 'true');
      Object.defineProperty(el, 'isContentEditable', { value: true });
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for input element', () => {
      expect(isEditableTarget(document.createElement('input'))).toBe(true);
    });

    it('returns true for textarea element', () => {
      expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    });

    it('returns true for select element', () => {
      expect(isEditableTarget(document.createElement('select'))).toBe(true);
    });

    it('returns false for div element', () => {
      expect(isEditableTarget(document.createElement('div'))).toBe(false);
    });

    it('returns false for button element', () => {
      expect(isEditableTarget(document.createElement('button'))).toBe(false);
    });
  });

  describe('folderHasVisibleContent', () => {
    const makeFile = (fsPath: string, title = 'File') => ({
      fsPath,
      title,
      relativePath: fsPath,
    });

    const makeFolder = (path: string, files: any[] = [], children: any[] = []) => ({
      path,
      name: path,
      files,
      children,
    });

    it('returns true when a file matches filter', () => {
      const node = makeFolder('root', [makeFile('a.md', 'Readme')]);
      expect(folderHasVisibleContent(node, 'readme', false, new Set())).toBe(true);
    });

    it('returns false when no file matches filter', () => {
      const node = makeFolder('root', [makeFile('a.md', 'Guide')]);
      expect(folderHasVisibleContent(node, 'readme', false, new Set())).toBe(false);
    });

    it('returns true when empty filter and files exist', () => {
      const node = makeFolder('root', [makeFile('a.md')]);
      expect(folderHasVisibleContent(node, '', false, new Set())).toBe(true);
    });

    it('respects hideUnselected with scope selection', () => {
      const fileA = makeFile('a.md');
      const fileB = makeFile('b.md');
      const node = makeFolder('root', [fileA, fileB]);
      const selected = new Set(['a.md']);
      expect(folderHasVisibleContent(node, '', true, selected)).toBe(true);
      expect(folderHasVisibleContent(node, '', true, new Set())).toBe(false);
    });

    it('checks children recursively', () => {
      const child = makeFolder('sub', [makeFile('readme.md', 'Readme')]);
      const root = makeFolder('root', [], [child]);
      expect(folderHasVisibleContent(root, 'readme', false, new Set())).toBe(true);
    });

    it('returns false for empty folder with no children', () => {
      const node = makeFolder('root', [], []);
      expect(folderHasVisibleContent(node, '', false, new Set())).toBe(false);
    });
  });
});
