import { describe, expect, it } from 'vitest';
import type { FolderNode, MdFile } from '../../../../ui/src/types';
import {
  entryBaseName, findFolderNode, hasSiblingNamed, isListedFileName, isSameOrDescendant,
  parentEntryPath, pruneDescendantPaths, resolveSelectionEntries, toEntryPath,
} from '../../../../ui/src/workspace/workspaceEntryPaths';

const file = (relativePath: string, fsPath = `C:\\ws\\${relativePath.replace(/\//g, '\\')}`): MdFile => ({
  fsPath, relativePath: relativePath.replace(/\//g, '\\'), parts: relativePath.split('/'),
  fileName: relativePath.split('/').pop()!, title: 't', extension: '.md', documentKind: 'markdown', modifiedAt: 0,
} as MdFile);
const tree: FolderNode = {
  name: 'root', path: '', modifiedAt: 0, files: [file('Readme.md')],
  children: [{ name: 'docs', path: 'docs', modifiedAt: 0, files: [file('docs/a.md')], children: [
    { name: 'empty', path: 'docs/empty', modifiedAt: 0, files: [], children: [] },
  ] }],
};

describe('workspace entry paths', () => {
  it('normalises separators', () => expect(toEntryPath('docs\\a.md')).toBe('docs/a.md'));
  it('detects descendants without prefix false positives', () => {
    expect(isSameOrDescendant('docs/a.md', 'docs')).toBe(true);
    expect(isSameOrDescendant('docs2/a.md', 'docs')).toBe(false);
    expect(isSameOrDescendant('docs', 'docs')).toBe(true);
  });
  it('prunes selected descendants of selected folders', () => {
    expect(pruneDescendantPaths(['docs/a.md', 'docs', 'Readme.md', 'docs'])).toEqual(['docs', 'Readme.md']);
  });
  it('computes parents and base names', () => {
    expect(parentEntryPath('docs/a.md')).toBe('docs');
    expect(parentEntryPath('a.md')).toBe('');
    expect(entryBaseName('docs/empty')).toBe('empty');
  });
  it('finds folders and sibling names', () => {
    expect(findFolderNode(tree, 'docs/empty')?.name).toBe('empty');
    expect(findFolderNode(tree, '')).toBe(tree);
    expect(hasSiblingNamed(tree, '', 'readme.md', false)).toBe(true);
    expect(hasSiblingNamed(tree, '', 'readme.md', true)).toBe(false);
    expect(hasSiblingNamed(tree, 'docs', 'EMPTY', false)).toBe(true);
  });
  it('flags extensions the tree does not list', () => {
    expect(isListedFileName('x.md', [])).toBe(true);
    expect(isListedFileName('x.MARKDOWN', [])).toBe(true);
    expect(isListedFileName('x.txt', [])).toBe(false);
    expect(isListedFileName('x.txt', [{ ...file('n.txt'), extension: '.txt' }])).toBe(true);
    expect(isListedFileName('.env', [])).toBe(false);
  });
  it('resolves selection keys to pruned entries', () => {
    const files = [file('docs/a.md'), file('Readme.md')];
    const keys = new Set([`file:${files[0].fsPath}`, 'folder:docs', `file:${files[1].fsPath}`, 'file:gone']);
    expect(resolveSelectionEntries(keys, files)).toEqual([
      { kind: 'folder', path: 'docs', key: 'folder:docs' },
      { kind: 'file', path: 'Readme.md', key: `file:${files[1].fsPath}` },
    ]);
  });
});
