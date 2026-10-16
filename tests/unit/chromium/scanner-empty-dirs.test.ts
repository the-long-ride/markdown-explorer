import { describe, expect, it } from 'vitest';
import { BrowserScanner } from '../../../chromium-xtension/src/scanner';
import { treeHasEmptyFolder } from '../../../chromium-xtension/src/incremental-publish';

function dir(name: string, children: any[] = []): any {
  return { kind: 'directory', name, async *values() { yield* children; } };
}
function file(name: string, text = '# Title'): any {
  return { kind: 'file', name, async getFile() { return new File([text], name, { lastModified: 1 }); } };
}

describe('BrowserScanner empty folders', () => {
  it('keeps zero-entry folders and drops unsupported-only and ignored ones', async () => {
    const root = dir('root', [
      dir('blank'),
      dir('outer', [dir('inner')]),
      dir('assets', [file('logo.png')]),
      dir('node_modules', [dir('empty')]),
      file('readme.md'),
    ]);
    const { tree, emptyDirs } = await BrowserScanner.scan(root);
    expect([...emptyDirs].sort()).toEqual(['blank', 'outer/inner']);
    expect(tree.children.map((child) => child.path).sort()).toEqual(['blank', 'outer']);
    expect(BrowserScanner.hasEmptyFolder(tree)).toBe(true);
  });

  it('returns no empty folders for a tree without them', async () => {
    const root = dir('root', [dir('docs', [file('a.md')]), file('readme.md')]);
    const { tree, emptyDirs } = await BrowserScanner.scan(root);
    expect(emptyDirs).toEqual([]);
    expect(BrowserScanner.hasEmptyFolder(tree)).toBe(false);
  });

  it('returns an empty result when the scan is cancelled', async () => {
    const root = dir('root', [dir('blank'), file('readme.md')]);
    const result = await BrowserScanner.scan(root, { isCurrent: () => false });
    expect(result.flat).toEqual([]);
    expect(result.emptyDirs).toEqual([]);
  });

  it('buildTree merges empty folders into existing branches', () => {
    const flat = [{
      fsPath: 'docs/a.md', relativePath: 'docs/a.md', parts: ['docs', 'a.md'], fileName: 'a.md',
      title: 'A', extension: '.md', documentKind: 'markdown', modifiedAt: 5,
    }] as any[];
    const tree = BrowserScanner.buildTree(flat, ['docs/sub', 'blank']);
    const docs = tree.children.find((child) => child.path === 'docs')!;
    expect(docs.files).toHaveLength(1);
    expect(docs.children.map((child) => child.path)).toEqual(['docs/sub']);
    expect(tree.children.map((child) => child.path).sort()).toEqual(['blank', 'docs']);
    expect(BrowserScanner.buildTree(flat).children).toHaveLength(1);
  });

  it('treeHasEmptyFolder is null-safe and detects nested empties', () => {
    expect(treeHasEmptyFolder(null)).toBe(false);
    expect(treeHasEmptyFolder(undefined)).toBe(false);
    expect(treeHasEmptyFolder({ name: 'root', path: '', children: [], files: [] } as any)).toBe(false);
    const nested = {
      name: 'root', path: '', files: [],
      children: [{ name: 'a', path: 'a', files: [{}], children: [{ name: 'b', path: 'a/b', files: [], children: [] }] }],
    };
    expect(treeHasEmptyFolder(nested as any)).toBe(true);
  });
});
