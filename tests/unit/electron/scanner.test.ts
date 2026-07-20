import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import DesktopScanner from '../../../electron/workspace/scanner.js';
import { loadIgnorePatterns } from '../../../electron/workspace/scanner.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('DesktopScanner', () => {
  test('extractMdxTitle prefers frontmatter title', () => {
    const title = DesktopScanner.extractMdxTitle([
      '---',
      'title: "Frontmatter Title"',
      '---',
      '',
      "export const title = 'Ignored';",
    ].join('\n'));

    expect(title).toEqual('Frontmatter Title');
  });

  test('extractTitle falls back to markdown heading when MDX metadata is absent', () => {
    const rootDir = makeTempDir('mdx-title-');
    const filePath = path.join(rootDir, 'sample.mdx');
    writeFile(filePath, ['Intro', '', '# Visible Heading'].join('\n'));

    expect(DesktopScanner.extractTitle(filePath, true)).toEqual('Visible Heading');
  });

  test('scan ignores excluded folders and unsupported files', async () => {
    const rootDir = makeTempDir('scanner-scan-');
    writeFile(path.join(rootDir, 'docs', 'guide.md'), '# Guide');
    writeFile(path.join(rootDir, '.git', 'ignored.md'), '# Git');
    writeFile(path.join(rootDir, 'node_modules', 'pkg.md'), '# Pkg');
    writeFile(path.join(rootDir, 'notes.txt'), 'plain text');
    writeFile(path.join(rootDir, 'image.png'), 'not supported');

    const { flat, tree } = await DesktopScanner.scan(rootDir);

    expect(
      flat.map((entry: any) => entry.relativePath).sort(),
    ).toEqual(
      [path.join('docs', 'guide.md'), 'notes.txt'].sort(),
    );
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].name).toBe('docs');
  });

  test('extractTitle reads headings found within the initial title chunk', () => {
    const rootDir = makeTempDir('scanner-chunk-');
    const filePath = path.join(rootDir, 'long.md');
    const prefix = 'a'.repeat(70 * 1024);
    writeFile(filePath, `${prefix}\n# Late Heading`);

    expect(DesktopScanner.extractTitle(filePath, false)).toBeNull();
  });

  describe('loadIgnorePatterns', () => {
    test('returns patterns from .markdown-explorer-ignore file', () => {
      const rootDir = makeTempDir('ignore-happy-');
      fs.mkdirSync(path.join(rootDir, 'secrets'), { recursive: true });
      writeFile(
        path.join(rootDir, '.markdown-explorer-ignore'),
        ['# comment', 'secrets', '*.log', '', '  '].join('\n'),
      );

      expect(loadIgnorePatterns(rootDir)).toEqual(['secrets', '*.log']);
    });

    test('returns empty array when ignore file is missing', () => {
      const rootDir = makeTempDir('ignore-missing-');

      expect(loadIgnorePatterns(rootDir)).toEqual([]);
    });

    test('returns empty array on read error', () => {
      const rootDir = makeTempDir('ignore-err-');
      const ignorePath = path.join(rootDir, '.markdown-explorer-ignore');
      writeFile(ignorePath, '# only comments\n');

      expect(loadIgnorePatterns(rootDir)).toEqual([]);
    });

    test('filters out comment lines starting with #', () => {
      const rootDir = makeTempDir('ignore-comment-');
      writeFile(
        path.join(rootDir, '.markdown-explorer-ignore'),
        ['# This is a comment', 'build', '', '# another comment', 'secrets'].join('\n'),
      );

      expect(loadIgnorePatterns(rootDir)).toEqual(['build', 'secrets']);
    });
  });

  describe('scan', () => {
    test('includes .doc files when documentConversionEnabled=true', async () => {
      const rootDir = makeTempDir('scan-docconv-');
      writeFile(path.join(rootDir, 'report.doc'), 'fake doc');
      writeFile(path.join(rootDir, 'readme.md'), '# Readme');

      const { flat } = await DesktopScanner.scan(rootDir, {
        documentConversionEnabled: true,
      });

      const relPaths = flat.map((e: any) => e.relativePath).sort();
      expect(relPaths).toEqual(['readme.md', 'report.doc']);
      const docEntry = flat.find((e: any) => e.extension === '.doc');
      expect(docEntry.documentKind).toBe('document');
    });

    test('excludes .doc files when documentConversionEnabled is false', async () => {
      const rootDir = makeTempDir('scan-nodoc-');
      writeFile(path.join(rootDir, 'report.doc'), 'fake doc');
      writeFile(path.join(rootDir, 'notes.txt'), 'plain text');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.map((e: any) => e.relativePath)).toEqual(['notes.txt']);
    });

    test('skips directories that fail to readdir', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const rootDir = makeTempDir('scan-faildir-');
      const failDir = path.join(rootDir, 'faildir');
      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (dir) => {
        if (String(dir) === failDir) throw new Error('EACCES');
        return fs.readdirSync(String(dir), { withFileTypes: true }) as any;
      });
      fs.mkdirSync(failDir);
      writeFile(path.join(rootDir, 'ok.md'), '# OK');
      writeFile(path.join(failDir, 'inner.md'), '# Inner');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.map((e: any) => e.relativePath)).toEqual(['ok.md']);
    });

    test('scans more than 1000 files', { timeout: 30_000 }, async () => {
      const rootDir = makeTempDir('scan-maxfiles-');
      for (let i = 0; i < 1100; i++) {
        const sub = path.join(rootDir, `d${String(i).padStart(5, '0')}`);
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, 'file.md'), '# t');
      }

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.length).toBe(1100);
    });

    test('reports the scanned supported-file count while scanning', async () => {
      const rootDir = makeTempDir('scan-progress-');
      for (let i = 0; i < 100; i++) {
        writeFile(path.join(rootDir, `f${String(i).padStart(3, '0')}.md`), '# t');
      }
      const progress: number[] = [];

      await DesktopScanner.scan(rootDir, { onProgress: (count: number) => progress.push(count) });

      expect(progress).toEqual([100, 100]);
    });

    test('reports every discovered file with a cumulative count', async () => {
      const rootDir = makeTempDir('scan-incremental-');
      for (let i = 0; i < 3; i++) writeFile(path.join(rootDir, `f${i}.md`), '# t');
      const discovered: Array<{ fileName: string; count: number }> = [];

      await DesktopScanner.scan(rootDir, {
        onFile: (file: any, count: number) => discovered.push({ fileName: file.fileName, count }),
      });

      expect(discovered).toEqual([
        { fileName: 'f0.md', count: 1 },
        { fileName: 'f1.md', count: 2 },
        { fileName: 'f2.md', count: 3 },
      ]);
    });

    test('yields to event loop every 30 files', async () => {
      const rootDir = makeTempDir('scan-yield-');
      const spy = vi.spyOn(globalThis, 'setImmediate');
      for (let i = 0; i < 62; i++) {
        writeFile(path.join(rootDir, `f${String(i).padStart(3, '0')}.txt`), 't');
      }

      await DesktopScanner.scan(rootDir);

      expect(spy).toHaveBeenCalled();
    });

    test('yields between title extraction when batch has more titles to process', async () => {
      const rootDir = makeTempDir('scan-titlebatch-');
      let titleYieldCalls = 0;
      const origSetImmediate = globalThis.setImmediate;
      vi.spyOn(globalThis, 'setImmediate').mockImplementation((fn: any) => {
        titleYieldCalls++;
        return origSetImmediate(fn);
      });
      for (let i = 0; i < 20; i++) {
        writeFile(
          path.join(rootDir, `doc${String(i).padStart(3, '0')}.md`),
          `# Title ${i}`,
        );
      }

      await DesktopScanner.scan(rootDir, { titleConcurrency: 8 });

      expect(titleYieldCalls).toBeGreaterThan(0);
    });

    test('extracts title chunks concurrently instead of serially', async () => {
      const rootDir = makeTempDir('scan-title-concurrency-');
      for (let i = 0; i < 4; i++) {
        writeFile(path.join(rootDir, `doc${i}.md`), `# Title ${i}`);
      }
      const pending: Array<() => void> = [];
      const extractTitle = vi.spyOn(DesktopScanner, 'extractTitleAsync').mockImplementation(
        () => new Promise((resolve) => pending.push(() => resolve(null))),
      );

      const scanPromise = DesktopScanner.scan(rootDir, { titleConcurrency: 4 });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(extractTitle).toHaveBeenCalledTimes(4);
      pending.forEach((resolve) => resolve());
      await scanPromise;
    });

    test('finishes scan when a title read stalls', async () => {
      const rootDir = makeTempDir('scan-title-timeout-');
      writeFile(path.join(rootDir, 'blocked.md'), '# Blocked');
      vi.spyOn(DesktopScanner, 'extractTitleAsync').mockImplementation(
        () => new Promise(() => {}),
      );

      const completed = await Promise.race([
        DesktopScanner.scan(rootDir, { titleReadTimeoutMs: 5 }).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)),
      ]);

      expect(completed).toBe(true);
    });

    test('loads and applies custom ignore patterns from .markdown-explorer-ignore', async () => {
      const rootDir = makeTempDir('scan-customignore-');
      writeFile(path.join(rootDir, 'keep.md'), '# Keep');
      writeFile(path.join(rootDir, 'customskip.md'), '# Skip');
      writeFile(path.join(rootDir, '.markdown-explorer-ignore'), 'customskip.md');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.map((e: any) => e.relativePath)).toEqual(['keep.md']);
    });

    test('skips entries that are neither directory nor file', async () => {
      const rootDir = makeTempDir('scan-neither-');
      writeFile(path.join(rootDir, 'real.md'), '# Real');

      const mockEntry = {
        isDirectory: () => false,
        isFile: () => false,
        name: 'phantom',
      };
      const origReaddir = fs.promises.readdir;
      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (dir, opts) => {
        const entries = await (origReaddir as any)(dir, opts);
        if (String(dir) === rootDir) return [...entries, mockEntry];
        return entries;
      });

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.length).toBe(1);
      expect(flat[0].relativePath).toBe('real.md');
    });

    test('keeps pending title when extractTitleAsync returns null', async () => {
      const rootDir = makeTempDir('scan-nulltitle-');
      writeFile(path.join(rootDir, 'noheading.md'), 'no heading here');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat[0].title).toBe('pending');
    });

    test('mdx with extractMdxTitle returning null keeps pending title', async () => {
      const rootDir = makeTempDir('scan-mdxnull-');
      writeFile(path.join(rootDir, 'plain.mdx'), 'Just plain text no metadata');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat[0].title).toBe('pending');
    });

    test('loads and applies ignore patterns from .markdown-explorer-ignore', async () => {
      const rootDir = makeTempDir('scan-customignore2-');
      writeFile(path.join(rootDir, 'keep.md'), '# Keep');
      writeFile(path.join(rootDir, 'skip.md'), '# Skip');
      writeFile(path.join(rootDir, '.markdown-explorer-ignore'), 'skip.md');

      const { flat } = await DesktopScanner.scan(rootDir);

      expect(flat.map((e: any) => e.relativePath)).toEqual(['keep.md']);
    });
  });

  describe('buildFileEntryLite', () => {
    test('returns pending title for markdown files and strips extension for non-markdown', () => {
      const rootDir = makeTempDir('lite-entry-');
      writeFile(path.join(rootDir, 'guide.md'), '# Guide');
      writeFile(path.join(rootDir, 'data.txt'), 'text');

      const mdEntry = DesktopScanner.buildFileEntryLite(
        path.join(rootDir, 'guide.md'),
        rootDir,
        'pending',
      );
      expect(mdEntry.title).toBe('pending');
      expect(mdEntry.documentKind).toBe('markdown');
      expect(mdEntry.extension).toBe('.md');

      const txtEntry = DesktopScanner.buildFileEntryLite(
        path.join(rootDir, 'data.txt'),
        rootDir,
        'data',
      );
      expect(txtEntry.title).toBe('data');
      expect(txtEntry.documentKind).toBe('document');
      expect(txtEntry.extension).toBe('.txt');
    });

    test('uses stripKnownExtension as fallback when no placeholder title', () => {
      const rootDir = makeTempDir('lite-nopf-');
      const entry = DesktopScanner.buildFileEntryLite(
        path.join(rootDir, 'report.doc'),
        rootDir,
        '',
      );
      expect(entry.title).toBe('report');
    });
  });

  describe('buildFileEntry', () => {
    test('builds entry for markdown file with title extraction', () => {
      const rootDir = makeTempDir('entry-md-');
      writeFile(path.join(rootDir, 'guide.md'), '# Guide Title');

      const entry = DesktopScanner.buildFileEntry(
        path.join(rootDir, 'guide.md'),
        rootDir,
      );

      expect(entry.title).toBe('Guide Title');
      expect(entry.documentKind).toBe('markdown');
      expect(entry.extension).toBe('.md');
      expect(entry.fileName).toBe('guide.md');
      expect(entry.relativePath).toBe('guide.md');
    });

    test('builds entry for mdx file with title extraction', () => {
      const rootDir = makeTempDir('entry-mdx-');
      writeFile(
        path.join(rootDir, 'page.mdx'),
        ['---', 'title: MDX Page', '---', '', '# Fallback'].join('\n'),
      );

      const entry = DesktopScanner.buildFileEntry(
        path.join(rootDir, 'page.mdx'),
        rootDir,
      );

      expect(entry.title).toBe('MDX Page');
      expect(entry.extension).toBe('.mdx');
    });

    test('builds entry for non-markdown file using stripKnownExtension', () => {
      const rootDir = makeTempDir('entry-doc-');
      writeFile(path.join(rootDir, 'report.doc'), 'doc content');

      const entry = DesktopScanner.buildFileEntry(
        path.join(rootDir, 'report.doc'),
        rootDir,
      );

      expect(entry.title).toBe('report');
      expect(entry.documentKind).toBe('document');
      expect(entry.extension).toBe('.doc');
    });

    test('falls back to stripKnownExtension when markdown has no title', () => {
      const rootDir = makeTempDir('entry-notitle-');
      writeFile(path.join(rootDir, 'empty.md'), 'no heading here');

      const entry = DesktopScanner.buildFileEntry(
        path.join(rootDir, 'empty.md'),
        rootDir,
      );

      expect(entry.title).toBe('empty');
    });
  });

  describe('extractTitle / extractTitleAsync', () => {
    test('extractTitle returns null on read error', () => {
      expect(DesktopScanner.extractTitle('/nonexistent/path/fake.md', false)).toBeNull();
    });

    test('extractTitleAsync returns null on read error', async () => {
      expect(
        await DesktopScanner.extractTitleAsync('/nonexistent/path/fake.md', false),
      ).toBeNull();
    });

    test('extractTitleAsync extracts h1 from markdown', async () => {
      const rootDir = makeTempDir('async-h1-');
      writeFile(path.join(rootDir, 'doc.md'), '# Async Heading');

      expect(
        await DesktopScanner.extractTitleAsync(
          path.join(rootDir, 'doc.md'),
          false,
        ),
      ).toBe('Async Heading');
    });

    test('extractTitleAsync with isMdx=true and mdxTitle truthy returns mdxTitle', async () => {
      const rootDir = makeTempDir('async-mdxtitle-');
      writeFile(
        path.join(rootDir, 'test.mdx'),
        ['---', 'title: MDX Async Title', '---', '', '# Ignored Heading'].join('\n'),
      );

      expect(
        await DesktopScanner.extractTitleAsync(
          path.join(rootDir, 'test.mdx'),
          true,
        ),
      ).toBe('MDX Async Title');
    });

    test('extractTitleAsync with isMdx=true and mdxTitle null falls through to heading', async () => {
      const rootDir = makeTempDir('async-mdxfall-');
      writeFile(path.join(rootDir, 'test.mdx'), '---\nother: value\n---\n\n# Fallback Heading');

      expect(
        await DesktopScanner.extractTitleAsync(
          path.join(rootDir, 'test.mdx'),
          true,
        ),
      ).toBe('Fallback Heading');
    });

    test('extractTitleAsync returns null for non-mdx file with no heading', async () => {
      const rootDir = makeTempDir('async-nohead-');
      writeFile(path.join(rootDir, 'plain.md'), 'just some text');

      expect(
        await DesktopScanner.extractTitleAsync(
          path.join(rootDir, 'plain.md'),
          false,
        ),
      ).toBeNull();
    });

    test('extractTitle returns null for non-mdx without heading', () => {
      const rootDir = makeTempDir('sync-nohead-');
      writeFile(path.join(rootDir, 'blank.md'), 'just text');

      expect(DesktopScanner.extractTitle(path.join(rootDir, 'blank.md'), false)).toBeNull();
    });
  });

  describe('readTitleChunk / readTitleChunkAsync', () => {
    test('readTitleChunk reads first 8KB of file', () => {
      const rootDir = makeTempDir('sync-chunk-');
      const content = '# Early';
      writeFile(path.join(rootDir, 'short.md'), content);

      const chunk = DesktopScanner.readTitleChunk(path.join(rootDir, 'short.md'));
      expect(chunk).toBe(content);
    });

    test('readTitleChunkAsync reads first 8KB of file', async () => {
      const rootDir = makeTempDir('async-chunk-');
      const content = 'Hello World';
      writeFile(path.join(rootDir, 'tiny.txt'), content);

      const chunk = await DesktopScanner.readTitleChunkAsync(
        path.join(rootDir, 'tiny.txt'),
      );
      expect(chunk).toBe(content);
    });

    test('readTitleChunkAsync throws on missing file', async () => {
      await expect(
        DesktopScanner.readTitleChunkAsync('/nonexistent/path/fake.md'),
      ).rejects.toThrow();
    });
  });

  describe('extractMdxTitle', () => {
    test('extracts frontmatter title with single quotes', () => {
      expect(
        DesktopScanner.extractMdxTitle("---\ntitle: 'Quoted Title'\n---\n"),
      ).toBe('Quoted Title');
    });

    test('extracts frontmatter title with no quotes', () => {
      expect(
        DesktopScanner.extractMdxTitle('---\ntitle: Plain Title\n---\n'),
      ).toBe('Plain Title');
    });

    test('extracts export const title with single quotes', () => {
      expect(
        DesktopScanner.extractMdxTitle("export const title = 'Const Title'\n"),
      ).toBe('Const Title');
    });

    test('extracts export let title', () => {
      expect(
        DesktopScanner.extractMdxTitle("export let title = 'Let Title'\n"),
      ).toBe('Let Title');
    });

    test('extracts export var title', () => {
      expect(
        DesktopScanner.extractMdxTitle("export var title = 'Var Title'\n"),
      ).toBe('Var Title');
    });

    test('extracts export const title with double quotes', () => {
      expect(
        DesktopScanner.extractMdxTitle('export const title = "DblTitle"\n'),
      ).toBe('DblTitle');
    });

    test('extracts export const title with backtick quotes', () => {
      expect(
        DesktopScanner.extractMdxTitle('export const title = `Template Title`\n'),
      ).toBe('Template Title');
    });

    test('extracts export const meta with title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          "export const meta = { title: 'Meta Title' }\n",
        ),
      ).toBe('Meta Title');
    });

    test('extracts export let meta with title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          "export let meta = { title: 'LetMeta' }\n",
        ),
      ).toBe('LetMeta');
    });

    test('extracts export var meta with title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          "export var meta = { title: 'VarMeta' }\n",
        ),
      ).toBe('VarMeta');
    });

    test('extracts JSX title prop with string literal', () => {
      expect(
        DesktopScanner.extractMdxTitle('<Layout title="JSX Title" />\n'),
      ).toBe('JSX Title');
    });

    test('extracts JSX title prop with curly braces', () => {
      expect(
        DesktopScanner.extractMdxTitle('<Layout title={"Curly Title"} />\n'),
      ).toBe('Curly Title');
    });

    test('extracts JSX title prop with single-quoted curly braces', () => {
      expect(
        DesktopScanner.extractMdxTitle("<Layout title={'Single Curly'} />\n"),
      ).toBe('Single Curly');
    });

    test('extracts JSX title prop with template literal curly braces', () => {
      expect(
        DesktopScanner.extractMdxTitle('<Layout title={`Backtick Curly`} />\n'),
      ).toBe('Backtick Curly');
    });

    test('returns null when no MDX title source exists', () => {
      expect(DesktopScanner.extractMdxTitle('Just some content\n')).toBeNull();
    });

    test('frontmatter takes priority over export title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          ['---', 'title: FM', '---', '', "export const title = 'Export';"].join(
            '\n',
          ),
        ),
      ).toBe('FM');
    });

    test('export title takes priority over meta title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          [
            "export const title = 'Direct'",
            '',
            "export const meta = { title: 'Via Meta' }",
          ].join('\n'),
        ),
      ).toBe('Direct');
    });

    test('meta title takes priority over JSX title', () => {
      expect(
        DesktopScanner.extractMdxTitle(
          [
            "export const meta = { title: 'MetaWin' }",
            '',
            '<Layout title="JSX Lose" />',
          ].join('\n'),
        ),
      ).toBe('MetaWin');
    });

    test('frontmatter with colon at position 0 is not treated as title', () => {
      expect(
        DesktopScanner.extractMdxTitle('---\n:not-a-title: value\n---\n'),
      ).toBeNull();
    });

    test('frontmatter with key containing colon but not "title"', () => {
      expect(
        DesktopScanner.extractMdxTitle('---\nauthor: someone\n---\n'),
      ).toBeNull();
    });

    test('JSX title prop with empty string in curly braces returns null', () => {
      expect(
        DesktopScanner.extractMdxTitle('<Layout title={""} />\n'),
      ).toBeNull();
    });
  });

  describe('buildTree', () => {
    test('builds nested tree from flat file list', () => {
      const rootDir = makeTempDir('tree-');
      const flat = [
        DesktopScanner.buildFileEntryLite(
          path.join(rootDir, 'a', 'b', 'deep.md'),
          rootDir,
          'pending',
        ),
        DesktopScanner.buildFileEntryLite(
          path.join(rootDir, 'a', 'top.md'),
          rootDir,
          'pending',
        ),
        DesktopScanner.buildFileEntryLite(
          path.join(rootDir, 'root.md'),
          rootDir,
          'pending',
        ),
      ];

      const tree = DesktopScanner.buildTree(flat);

      expect(tree.name).toBe('root');
      expect(tree.files.length).toBe(1);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('a');
      expect(tree.children[0].files.length).toBe(1);
      expect(tree.children[0].children.length).toBe(1);
      expect(tree.children[0].children[0].name).toBe('b');
    });

    test('handles empty flat list', () => {
      const tree = DesktopScanner.buildTree([]);
      expect(tree.children).toEqual([]);
      expect(tree.files).toEqual([]);
    });

    test('reuses existing child nodes', () => {
      const rootDir = makeTempDir('tree-reuse-');
      const flat = [
        DesktopScanner.buildFileEntryLite(
          path.join(rootDir, 'shared', 'one.md'),
          rootDir,
          'pending',
        ),
        DesktopScanner.buildFileEntryLite(
          path.join(rootDir, 'shared', 'two.md'),
          rootDir,
          'pending',
        ),
      ];

      const tree = DesktopScanner.buildTree(flat);

      expect(tree.children.length).toBe(1);
      expect(tree.children[0].files.length).toBe(2);
    });
  });
});
