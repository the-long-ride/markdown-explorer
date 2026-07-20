import { describe, expect, test, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { WorkspaceScanner, setWorkspaceContextForTest } from '../../../vscode/src/core/scanner';
import type { WorkspaceContext } from '../../../vscode/src/core/scanner';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function makeWorkspaceContext(overrides?: Partial<WorkspaceContext>): WorkspaceContext {
  return {
    workspaceFolders: [{ uri: { fsPath: '/fake/root' } }],
    getConfiguration(_section: string) {
      return {
        get<T>(_key: string): T | undefined {
          return undefined as T;
        },
      };
    },
    findFiles(_include: string, _exclude: string, _maxResults: number) {
      return Promise.resolve([]);
    },
    textDocuments: [],
    ...overrides,
  };
}

describe('WorkspaceScanner', () => {
  beforeEach(() => {
    setWorkspaceContextForTest(null);
  });

  describe('buildFileEntry', () => {
    test('builds entry for markdown file', () => {
      const rootDir = makeTempDir('vsentry-md-');
      writeFile(path.join(rootDir, 'guide.md'), '# Guide Title');
      const entry = WorkspaceScanner.buildFileEntry(path.join(rootDir, 'guide.md'), rootDir);
      expect(entry.title).toBe('Guide Title');
      expect(entry.documentKind).toBe('markdown');
      expect(entry.extension).toBe('.md');
      expect(entry.relativePath).toBe('guide.md');
      expect(entry.fileName).toBe('guide.md');
    });

    test('builds entry for non-markdown file using stripKnownExtension', () => {
      const rootDir = makeTempDir('vsentry-doc-');
      writeFile(path.join(rootDir, 'report.doc'), 'doc content');
      const entry = WorkspaceScanner.buildFileEntry(path.join(rootDir, 'report.doc'), rootDir);
      expect(entry.title).toBe('report');
      expect(entry.documentKind).toBe('document');
      expect(entry.extension).toBe('.doc');
    });

    test('builds entry for mdx file', () => {
      const rootDir = makeTempDir('vsentry-mdx-');
      writeFile(path.join(rootDir, 'page.mdx'), '---\ntitle: MDX Page\n---\n\n# Fallback');
      const entry = WorkspaceScanner.buildFileEntry(path.join(rootDir, 'page.mdx'), rootDir);
      expect(entry.title).toBe('MDX Page');
      expect(entry.extension).toBe('.mdx');
    });
  });

  describe('buildTree', () => {
    test('builds nested tree from flat file list', () => {
      const rootDir = makeTempDir('vstree-');
      const flat = [
        Object.freeze({
          fsPath: path.join(rootDir, 'a', 'b', 'deep.md'),
          relativePath: path.join('a', 'b', 'deep.md'),
          parts: ['a', 'b', 'deep.md'],
          fileName: 'deep.md',
          title: 'Deep',
          extension: '.md',
          documentKind: 'markdown',
        }),
        Object.freeze({
          fsPath: path.join(rootDir, 'top.md'),
          relativePath: 'top.md',
          parts: ['top.md'],
          fileName: 'top.md',
          title: 'Top',
          extension: '.md',
          documentKind: 'markdown',
        }),
      ] as any;

      const tree = WorkspaceScanner.buildTree(flat);
      expect(tree.name).toBe('root');
      expect(tree.children.length).toBe(1);
      expect(tree.files.length).toBe(1);
      expect(tree.files[0].title).toBe('Top');
      const childA = tree.children.find((c) => c.name === 'a')!;
      expect(childA).toBeTruthy();
      expect(childA.children[0].name).toBe('b');
      expect(childA.children[0].files[0].title).toBe('Deep');
    });

    test('handles empty flat list', () => {
      const tree = WorkspaceScanner.buildTree([]);
      expect(tree.name).toBe('root');
      expect(tree.children).toEqual([]);
      expect(tree.files).toEqual([]);
    });

    test('reuses existing child nodes', () => {
      const rootDir = makeTempDir('vstree-reuse-');
      const flat = [
        Object.freeze({
          fsPath: path.join(rootDir, 'shared', 'one.md'),
          relativePath: path.join('shared', 'one.md'),
          parts: ['shared', 'one.md'],
          fileName: 'one.md',
          title: 'One',
          extension: '.md',
          documentKind: 'markdown',
        }),
        Object.freeze({
          fsPath: path.join(rootDir, 'shared', 'two.md'),
          relativePath: path.join('shared', 'two.md'),
          parts: ['shared', 'two.md'],
          fileName: 'two.md',
          title: 'Two',
          extension: '.md',
          documentKind: 'markdown',
        }),
      ] as any;

      const tree = WorkspaceScanner.buildTree(flat);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('shared');
      expect(tree.children[0].files.length).toBe(2);
    });
  });

  describe('scan', () => {
    test('reports every discovered file with a cumulative count', async () => {
      const rootDir = makeTempDir('vsscan-incremental-');
      const paths = ['one.md', 'two.md', 'three.md'];
      paths.forEach(name => writeFile(path.join(rootDir, name), `# ${name}`));
      setWorkspaceContextForTest(makeWorkspaceContext({
        workspaceFolders: [{ uri: { fsPath: rootDir } }],
        findFiles: async () => paths.map(name => ({ fsPath: path.join(rootDir, name) })),
      }));
      const discovered: Array<{ fileName: string; count: number }> = [];

      await WorkspaceScanner.scan(false, () => {}, (file, count) => {
        discovered.push({ fileName: file.fileName, count });
      });

      expect(discovered.map(item => item.fileName)).toEqual([...paths].sort());
      expect(discovered.map(item => item.count)).toEqual([1, 2, 3]);
    });

    test('returns empty result when no workspace folders', async () => {
      setWorkspaceContextForTest(
        makeWorkspaceContext({ workspaceFolders: undefined }),
      );
      const result = await WorkspaceScanner.scan();
      expect(result.flat).toEqual([]);
      expect(result.tree.name).toBe('root');
      expect(result.tree.children).toEqual([]);
    });

    test('returns empty result when empty workspace folders array', async () => {
      setWorkspaceContextForTest(
        makeWorkspaceContext({ workspaceFolders: [] }),
      );
      const result = await WorkspaceScanner.scan();
      expect(result.flat).toEqual([]);
    });

    test('scans with markdown files only by default', async () => {
      const rootDir = makeTempDir('vsscan-md-');
      writeFile(path.join(rootDir, 'readme.md'), '# Readme');
      writeFile(path.join(rootDir, 'notes.txt'), 'text');
      writeFile(path.join(rootDir, 'report.doc'), 'doc');
      writeFile(path.join(rootDir, 'image.png'), 'not supported');

      setWorkspaceContextForTest(
        makeWorkspaceContext({
          workspaceFolders: [{ uri: { fsPath: rootDir } }],
          async findFiles(_include, _exclude, _maxResults) {
            const files = fs.readdirSync(rootDir, { recursive: true });
            return files
              .filter((f) => f.endsWith('.md') || f.endsWith('.txt'))
              .map((f) => ({ fsPath: path.join(rootDir, f) }));
          },
        }),
      );

      const result = await WorkspaceScanner.scan();
      const relPaths = result.flat.map((e) => e.relativePath).sort();
      expect(relPaths).toEqual(['notes.txt', 'readme.md']);
    });

    test('scans with document conversion includes extra extensions', async () => {
      const rootDir = makeTempDir('vsscan-dc-');
      writeFile(path.join(rootDir, 'readme.md'), '# Readme');
      writeFile(path.join(rootDir, 'report.doc'), 'doc');

      setWorkspaceContextForTest(
        makeWorkspaceContext({
          workspaceFolders: [{ uri: { fsPath: rootDir } }],
          async findFiles(_include, _exclude, _maxResults) {
            return [
              { fsPath: path.join(rootDir, 'readme.md') },
              { fsPath: path.join(rootDir, 'report.doc') },
            ];
          },
        }),
      );

      const result = await WorkspaceScanner.scan(true);
      expect(result.flat.length).toBe(2);
      expect(result.flat.find((e) => e.extension === '.doc')!.documentKind).toBe('document');
    });

    test('uses custom exclude patterns from config', async () => {
      const rootDir = makeTempDir('vsscan-excl-');
      const capturedExclude: string[] = [];

      setWorkspaceContextForTest(
        makeWorkspaceContext({
          workspaceFolders: [{ uri: { fsPath: rootDir } }],
          getConfiguration(_section: string) {
            return {
              get<T>(key: string): T | undefined {
                if (key === 'excludePatterns') return ['custom-exclude'] as any;
                return undefined as T;
              },
            };
          },
          async findFiles(_include, exclude, _maxResults) {
            capturedExclude.push(exclude);
            return [];
          },
        }),
      );

      await WorkspaceScanner.scan();
      expect(capturedExclude[0]).toContain('custom-exclude');
    });

    test('uses default exclude patterns when config returns undefined', async () => {
      const rootDir = makeTempDir('vsscan-defex-');
      const capturedExclude: string[] = [];

      setWorkspaceContextForTest(
        makeWorkspaceContext({
          workspaceFolders: [{ uri: { fsPath: rootDir } }],
          async findFiles(_include, exclude, _maxResults) {
            capturedExclude.push(exclude);
            return [];
          },
        }),
      );

      await WorkspaceScanner.scan();
      expect(capturedExclude[0]).toContain('node_modules');
      expect(capturedExclude[0]).toContain('.git');
    });

    test('does not cap workspace discovery at 1000 files', async () => {
      let capturedMaxResults: number | undefined = 0;
      setWorkspaceContextForTest(
        makeWorkspaceContext({
          findFiles(_include, _exclude, maxResults) {
            capturedMaxResults = maxResults;
            return Promise.resolve([]);
          },
        }),
      );

      await WorkspaceScanner.scan();
      expect(capturedMaxResults).toBeUndefined();
    });

    test('throws when context is not set', async () => {
      setWorkspaceContextForTest(null);
      await expect(WorkspaceScanner.scan()).rejects.toThrow('vscode workspace not available');
    });
  });

  describe('readFile', () => {
    test('reads file from disk when no matching open document', () => {
      const rootDir = makeTempDir('vsrf-disk-');
      writeFile(path.join(rootDir, 'test.md'), '# Hello');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const content = WorkspaceScanner.readFile(path.join(rootDir, 'test.md'));
      expect(content).toBe('# Hello');
    });

    test('reads from open text document when available', () => {
      const rootDir = makeTempDir('vsrf-open-');
      writeFile(path.join(rootDir, 'test.md'), '# On Disk');
      const mockDoc = {
        fileName: path.join(rootDir, 'test.md'),
        getText: () => '# From Editor',
      };
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [mockDoc] }),
      );
      const content = WorkspaceScanner.readFile(path.join(rootDir, 'test.md'));
      expect(content).toBe('# From Editor');
    });

    test('returns empty string on read error', () => {
      const content = WorkspaceScanner.readFile('/nonexistent/file.md');
      expect(content).toBe('');
    });

    test('reads from disk when context is null (no vscode)', () => {
      const rootDir = makeTempDir('vsrf-nocontext-');
      writeFile(path.join(rootDir, 'test.md'), '# Direct');
      setWorkspaceContextForTest(null);
      const content = WorkspaceScanner.readFile(path.join(rootDir, 'test.md'));
      expect(content).toBe('# Direct');
    });
  });

  describe('extractTitle', () => {
    test('extracts h1 from markdown file', () => {
      const rootDir = makeTempDir('vsxt-m1-');
      writeFile(path.join(rootDir, 'doc.md'), '# Title Here');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'doc.md'), false);
      expect(title).toBe('Title Here');
    });

    test('extracts mdx frontmatter title', () => {
      const rootDir = makeTempDir('vsxt-mdx-');
      writeFile(path.join(rootDir, 'page.mdx'), '---\ntitle: FM Title\n---\n\n# Ignored');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'page.mdx'), true);
      expect(title).toBe('FM Title');
    });

    test('falls back to h1 when mdx frontmatter has no title', () => {
      const rootDir = makeTempDir('vsxt-mdxfall-');
      writeFile(path.join(rootDir, 'page.mdx'), '---\ndate: 2024\n---\n\n# Fallback Heading');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'page.mdx'), true);
      expect(title).toBe('Fallback Heading');
    });

    test('returns null for non-mdx without heading', () => {
      const rootDir = makeTempDir('vsxt-nohead-');
      writeFile(path.join(rootDir, 'plain.md'), 'just text');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'plain.md'), false);
      expect(title).toBeNull();
    });

    test('returns null on read error', () => {
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle('/nonexistent/file.md', false);
      expect(title).toBeNull();
    });

    test('reads from open text document when available', () => {
      const rootDir = makeTempDir('vsxt-open-');
      writeFile(path.join(rootDir, 'doc.md'), '# On Disk');
      const mockDoc = {
        fileName: path.join(rootDir, 'doc.md'),
        getText: () => '# From Editor',
      };
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [mockDoc] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'doc.md'), false);
      expect(title).toBe('From Editor');
    });

    test('extracts title from open document when no file exists', () => {
      const mockDoc = {
        fileName: path.join('/fake', 'open.md'),
        getText: () => '# Open Only',
      };
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [mockDoc] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join('/fake', 'open.md'), false);
      expect(title).toBe('Open Only');
    });

    test('reads only the first title chunk from disk', () => {
      const rootDir = makeTempDir('vsxt-chunk-');
      const filePath = path.join(rootDir, 'large.md');
      writeFile(filePath, `${'x'.repeat(9 * 1024)}\n# Late Heading`);
      setWorkspaceContextForTest(makeWorkspaceContext({ textDocuments: [] }));

      expect(WorkspaceScanner.extractTitle(filePath, false)).toBeNull();
    });
  });

  describe('extractMdxTitle', () => {
    test('extracts frontmatter title with single quotes', () => {
      const title = WorkspaceScanner.extractMdxTitle("---\ntitle: 'Quoted Title'\n---\n");
      expect(title).toBe('Quoted Title');
    });

    test('extracts frontmatter title with no quotes', () => {
      const title = WorkspaceScanner.extractMdxTitle('---\ntitle: Plain Title\n---\n');
      expect(title).toBe('Plain Title');
    });

    test('extracts export const title', () => {
      const title = WorkspaceScanner.extractMdxTitle("export const title = 'Export Title'\n");
      expect(title).toBe('Export Title');
    });

    test('extracts export const meta with title', () => {
      const title = WorkspaceScanner.extractMdxTitle("export const meta = { title: 'Meta Title' }\n");
      expect(title).toBe('Meta Title');
    });

    test('extracts JSX title prop', () => {
      const title = WorkspaceScanner.extractMdxTitle('<Layout title="JSX Title" />\n');
      expect(title).toBe('JSX Title');
    });

    test('returns null when no title source', () => {
      const title = WorkspaceScanner.extractMdxTitle('Just content\n');
      expect(title).toBeNull();
    });

    test('frontmatter title has priority over export title', () => {
      const title = WorkspaceScanner.extractMdxTitle(
        ['---', 'title: FM', '---', '', "export const title = 'Export';"].join('\n'),
      );
      expect(title).toBe('FM');
    });

    test('export title has priority over meta title', () => {
      const title = WorkspaceScanner.extractMdxTitle(
        ["export const title = 'Direct'", '', "export const meta = { title: 'Via Meta' }"].join('\n'),
      );
      expect(title).toBe('Direct');
    });

    test('meta title has priority over JSX title', () => {
      const title = WorkspaceScanner.extractMdxTitle(
        ["export const meta = { title: 'MetaWin' }", '', '<Layout title="JSX Lose" />'].join('\n'),
      );
      expect(title).toBe('MetaWin');
    });

    test('JSX title with curly braces string', () => {
      const title = WorkspaceScanner.extractMdxTitle('<Layout title={"Hello"} />\n');
      expect(title).toBe('Hello');
    });
  });

  describe('extractTitle branch coverage', () => {
    test('extractTitle with null context reads from disk', () => {
      const rootDir = makeTempDir('vsxt-nullctx-');
      writeFile(path.join(rootDir, 'doc.md'), '# Disk Title');
      setWorkspaceContextForTest(null);
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'doc.md'), false);
      expect(title).toBe('Disk Title');
    });

    test('extractTitle with isMdx and open document calls extractMdxTitle first', () => {
      const rootDir = makeTempDir('vsxt-mdxopen-');
      writeFile(path.join(rootDir, 'page.mdx'), '---\ntitle: MDX Open\n---\n\n# Ignored');
      const mockDoc = {
        fileName: path.join(rootDir, 'page.mdx'),
        getText: () => '---\ntitle: MDX Open\n---\n\n# Ignored',
      };
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [mockDoc] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'page.mdx'), true);
      expect(title).toBe('MDX Open');
    });

    test('extractTitle with isMdx and no open document reads from disk and calls extractMdxTitle', () => {
      const rootDir = makeTempDir('vsxt-mdxdisk-');
      writeFile(path.join(rootDir, 'page.mdx'), '---\ntitle: Disk MDX\n---\n\n# Ignored');
      setWorkspaceContextForTest(
        makeWorkspaceContext({ textDocuments: [] }),
      );
      const title = WorkspaceScanner.extractTitle(path.join(rootDir, 'page.mdx'), true);
      expect(title).toBe('Disk MDX');
    });
  });

  describe('extractMdxTitle branch coverage', () => {
    test('export const title with backtick string', () => {
      const title = WorkspaceScanner.extractMdxTitle('export const title = `Template`\n');
      expect(title).toBe('Template');
    });

    test('export let title with double-quoted string', () => {
      const title = WorkspaceScanner.extractMdxTitle('export let title = "LetTitle"\n');
      expect(title).toBe('LetTitle');
    });

    test('export var title with single-quoted string', () => {
      const title = WorkspaceScanner.extractMdxTitle("export var title = 'VarTitle'\n");
      expect(title).toBe('VarTitle');
    });

    test('JSX title with curly braces and no direct string slot returns null', () => {
      const title = WorkspaceScanner.extractMdxTitle('<Layout title={} />\n');
      expect(title).toBeNull();
    });
  });

  describe('buildFileEntry with subdirectory', () => {
    test('builds entry for file in subdirectory (parts length > 1)', () => {
      const rootDir = makeTempDir('vsentry-sub-');
      writeFile(path.join(rootDir, 'sub', 'guide.md'), '# Sub Title');
      const entry = WorkspaceScanner.buildFileEntry(path.join(rootDir, 'sub', 'guide.md'), rootDir);
      expect(entry.title).toBe('Sub Title');
      expect(entry.parts.length).toBeGreaterThan(1);
      expect(entry.parts[0]).toBe('sub');
      expect(entry.fileName).toBe('guide.md');
    });
  });
});
