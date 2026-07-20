import { describe, it, expect, vi } from 'vitest';
import { BrowserScanner } from '../../../chromium-xtension/src/scanner';
import type { MdFile } from '../../../ui/src/types';

describe('BrowserScanner.stripKnownExtension', () => {
  it('strips .md extension', () => {
    expect(BrowserScanner.stripKnownExtension('readme.md')).toBe('readme');
  });

  it('strips .mdx extension', () => {
    expect(BrowserScanner.stripKnownExtension('component.mdx')).toBe('component');
  });

  it('strips last extension only for double-dot names', () => {
    expect(BrowserScanner.stripKnownExtension('api.reference.md')).toBe('api.reference');
  });

  it('returns name unchanged when no extension', () => {
    expect(BrowserScanner.stripKnownExtension('README')).toBe('README');
  });

  it('strips extension from dotfile like .gitignore', () => {
    expect(BrowserScanner.stripKnownExtension('.gitignore')).toBe('');
  });

  it('strips .txt extension', () => {
    expect(BrowserScanner.stripKnownExtension('notes.txt')).toBe('notes');
  });
});

describe('BrowserScanner.extractTitle', () => {
  it('extracts ATX h1 title', () => {
    expect(BrowserScanner.extractTitle('# Hello World\nSome text')).toBe('Hello World');
  });

  it('extracts ATX h2 title', () => {
    expect(BrowserScanner.extractTitle('## Section Title\nBody')).toBe('Section Title');
  });

  it('extracts h3 title', () => {
    expect(BrowserScanner.extractTitle('### Deep Heading')).toBe('Deep Heading');
  });

  it('returns null for no heading', () => {
    expect(BrowserScanner.extractTitle('Just some text\nNo heading here')).toBeNull();
  });

  it('trims heading content', () => {
    expect(BrowserScanner.extractTitle('#   Spaced Title   ')).toBe('Spaced Title');
  });

  it('picks first heading when multiple exist', () => {
    const content = '# First\n## Second';
    expect(BrowserScanner.extractTitle(content)).toBe('First');
  });

  it('does not match indented headings', () => {
    expect(BrowserScanner.extractTitle('  # Not a heading')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(BrowserScanner.extractTitle('')).toBeNull();
  });

  it('delegates to extractMdxTitle when isMdx=true', () => {
    const mdxContent = 'export const title = "MDX Title"\n# Fallback';
    expect(BrowserScanner.extractTitle(mdxContent, true)).toBe('MDX Title');
  });

  it('falls back to ATX when isMdx=true but no MDX title', () => {
    expect(BrowserScanner.extractTitle('# Fallback', true)).toBe('Fallback');
  });

  it('uses ATX when isMdx=false even if MDX patterns exist', () => {
    const content = 'export const title = "Ignored"\n# Used';
    expect(BrowserScanner.extractTitle(content, false)).toBe('Used');
  });
});

describe('BrowserScanner.extractMdxTitle', () => {
  it('extracts frontmatter title', () => {
    const content = '---\ntitle: My Page\n---\n# Body';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('My Page');
  });

  it('extracts frontmatter title with quotes', () => {
    const content = '---\ntitle: "Quoted Title"\n---';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Quoted Title');
  });

  it('extracts frontmatter title with single quotes', () => {
    const content = "---\ntitle: 'Single Quoted'\n---";
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Single Quoted');
  });

  it('extracts export const title', () => {
    const content = 'export const title = "Exported Title"\n# Heading';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Exported Title');
  });

  it('extracts export let title', () => {
    const content = "export let title = 'Let Title'";
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Let Title');
  });

  it('extracts export var title', () => {
    const content = 'export var title = "Var Title"';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Var Title');
  });

  it('extracts meta.title', () => {
    const content = "export const meta = { title: 'Meta Title' }";
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Meta Title');
  });

  it('extracts JSX title prop with double quotes', () => {
    const content = '<Layout title="JSX Title">Content</Layout>';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('JSX Title');
  });

  it('extracts JSX title prop with curly braces', () => {
    const content = "<Layout title={'Braces Title'}>Content</Layout>";
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Braces Title');
  });

  it('prioritizes frontmatter over export', () => {
    const content = '---\ntitle: Frontmatter\n---\nexport const title = "Export"';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Frontmatter');
  });

  it('prioritizes export const over meta', () => {
    const content = 'export const title = "Direct"\nexport const meta = { title: "Meta" }';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Direct');
  });

  it('returns null when no title patterns match', () => {
    expect(BrowserScanner.extractMdxTitle('Just some content')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(BrowserScanner.extractMdxTitle('')).toBeNull();
  });

  it('handles frontmatter with other fields before title', () => {
    const content = '---\nauthor: Bob\ndate: 2024-01-01\ntitle: Deep Title\n---';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Deep Title');
  });

  it('does not match "subtitle" as "title"', () => {
    const content = '---\nsubtitle: Not This\n---';
    expect(BrowserScanner.extractMdxTitle(content)).toBeNull();
  });

  it('extracts meta.title with double quotes', () => {
    const content = 'export const meta = { title: "Double Quoted" }';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Double Quoted');
  });

  it('extracts JSX title from component with other props', () => {
    const content = '<Page title="Page Title" theme="dark">';
    expect(BrowserScanner.extractMdxTitle(content)).toBe('Page Title');
  });
});

describe('BrowserScanner.buildTree', () => {
  function makeMdFile(relativePath: string, title?: string): MdFile {
    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1];
    return {
      fsPath: relativePath,
      relativePath,
      parts,
      fileName,
      title: title || fileName,
      extension: '.' + fileName.split('.').pop(),
      documentKind: 'markdown'
    };
  }

  it('builds tree from flat list of root-level files', () => {
    const files = [makeMdFile('readme.md'), makeMdFile('guide.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.name).toBe('root');
    expect(tree.files).toHaveLength(2);
    expect(tree.children).toHaveLength(0);
  });

  it('builds nested folder structure', () => {
    const files = [makeMdFile('docs/intro.md'), makeMdFile('docs/advanced/api.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].name).toBe('docs');
    expect(tree.children[0].files).toHaveLength(1);
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].name).toBe('advanced');
  });

  it('returns empty root for empty list', () => {
    const tree = BrowserScanner.buildTree([]);
    expect(tree.files).toHaveLength(0);
    expect(tree.children).toHaveLength(0);
  });

  it('groups multiple files in same folder', () => {
    const files = [makeMdFile('src/a.md'), makeMdFile('src/b.md'), makeMdFile('src/c.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].files).toHaveLength(3);
  });

  it('handles deeply nested paths', () => {
    const files = [makeMdFile('a/b/c/d.md')];
    const tree = BrowserScanner.buildTree(files);
    let node = tree.children[0];
    expect(node.name).toBe('a');
    node = node.children[0];
    expect(node.name).toBe('b');
    node = node.children[0];
    expect(node.name).toBe('c');
    expect(node.files[0].fileName).toBe('d.md');
  });

  it('reuses folder nodes for sibling files', () => {
    const files = [makeMdFile('docs/a.md'), makeMdFile('docs/b.md'), makeMdFile('guides/c.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.children).toHaveLength(2);
  });

  it('sets path on folder nodes', () => {
    const files = [makeMdFile('docs/guide/intro.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.children[0].path).toBe('docs');
    expect(tree.children[0].children[0].path).toBe('docs/guide');
  });

  it('handles mix of root files and nested files', () => {
    const files = [makeMdFile('root.md'), makeMdFile('sub/nested.md')];
    const tree = BrowserScanner.buildTree(files);
    expect(tree.files).toHaveLength(1);
    expect(tree.children).toHaveLength(1);
  });
});

describe('BrowserScanner.buildFileEntry', () => {
  it('reads only the first 8 KiB title chunk', async () => {
    const chunkText = async () => '# Chunk Title';
    const fullText = async () => { throw new Error('full file must not be read'); };
    const slice = vi.fn(() => ({ text: chunkText }));
    const handle: any = {
      getFile: async () => ({ slice, text: fullText }),
    };

    const entry = await BrowserScanner.buildFileEntry(handle, 'large.md');

    expect(slice).toHaveBeenCalledWith(0, 8 * 1024);
    expect(entry.title).toBe('Chunk Title');
  });

  it('builds entry with title extracted from content', async () => {
    const handle: any = {
      getFile: async () => ({ text: async () => '# Hello\n\nWorld' }),
    };
    const entry = await BrowserScanner.buildFileEntry(handle, 'readme.md');
    expect(entry.title).toBe('Hello');
    expect(entry.fileName).toBe('readme.md');
    expect(entry.extension).toBe('.md');
    expect(entry.fsPath).toBe('readme.md');
  });

  it('uses filename fallback when reading fails', async () => {
    const handle: any = {
      getFile: async () => { throw new Error('read fail'); },
    };
    const entry = await BrowserScanner.buildFileEntry(handle, 'docs/guide.md');
    expect(entry.title).toBe('guide');
  });

  it('extracts mdx title', async () => {
    const handle: any = {
      getFile: async () => ({ text: async () => 'export const title = "MDX"\n' }),
    };
    const entry = await BrowserScanner.buildFileEntry(handle, 'page.mdx');
    expect(entry.title).toBe('MDX');
    expect(entry.extension).toBe('.mdx');
  });

  it('sets extension to empty string when no dot in filename', async () => {
    const handle: any = {
      getFile: async () => ({ text: async () => 'No heading' }),
    };
    const entry = await BrowserScanner.buildFileEntry(handle, 'README');
    expect(entry.title).toBe('README');
    expect(entry.extension).toBe('');
  });
});

describe('BrowserScanner.scan', () => {
  it('reports each completed file while keeping cumulative counts', async () => {
    const root: any = {
      async *values() {
        for (let index = 0; index < 3; index++) {
          yield {
            kind: 'file',
            name: `f${index}.md`,
            getFile: async () => ({ text: async () => `# File ${index}` }),
          };
        }
      },
    };
    const discovered: Array<{ name: string; count: number }> = [];

    await BrowserScanner.scan(root, {
      onFile(file, count) {
        discovered.push({ name: file.fileName, count });
      },
    });

    expect(discovered).toHaveLength(3);
    expect(discovered.map(item => item.count).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(discovered.map(item => item.name).sort()).toEqual(['f0.md', 'f1.md', 'f2.md']);
  });

  it('extracts titles concurrently with bounded parallelism', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const root: any = {
      async *values() {
        for (let index = 0; index < 40; index++) {
          yield {
            kind: 'file',
            name: `f${index}.md`,
            getFile: async () => ({
              slice: () => ({
                text: async () => {
                  inFlight += 1;
                  maxInFlight = Math.max(maxInFlight, inFlight);
                  await new Promise(resolve => setTimeout(resolve, 0));
                  inFlight -= 1;
                  return '# Title';
                },
              }),
            }),
          };
        }
      },
    };

    await BrowserScanner.scan(root);

    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(32);
  });
  it('scans a simple directory', async () => {
    const mockFile: any = {
      kind: 'file',
      name: 'readme.md',
      getFile: async () => ({ text: async () => '# Hello' }),
    };
    const root: any = {
      async *values() {
        yield mockFile;
      },
    };
    const result = await BrowserScanner.scan(root);
    expect(result.flat).toHaveLength(1);
    expect(result.flat[0].fileName).toBe('readme.md');
    expect(result.tree.files).toHaveLength(1);
  });

  it('scans more than 1000 files', async () => {
    const root: any = {
      async *values() {
        for (let i = 0; i < 1002; i++) {
          yield {
            kind: 'file',
            name: `f${i}.md`,
            getFile: async () => ({ text: async () => '' }),
          };
        }
      },
    };
    const result = await BrowserScanner.scan(root);
    expect(result.flat.length).toBe(1002);
  });

  it('skips excluded directories', async () => {
    const root: any = {
      async *values() {
        yield { kind: 'directory', name: '.git' };
        yield { kind: 'directory', name: 'node_modules' };
        yield { kind: 'directory', name: 'valid', async *values() {} };
      },
    };
    const result = await BrowserScanner.scan(root);
    expect(result.flat).toHaveLength(0);
  });

  it('traverses subdirectories', async () => {
    const childFile: any = {
      kind: 'file',
      name: 'child.md',
      getFile: async () => ({ text: async () => '# Child' }),
    };
    const childDir: any = {
      kind: 'directory',
      name: 'sub',
      async *values() {
        yield childFile;
      },
    };
    const root: any = {
      async *values() {
        yield childDir;
      },
    };
    const result = await BrowserScanner.scan(root);
    expect(result.flat).toHaveLength(1);
    expect(result.flat[0].fileName).toBe('child.md');
    expect(result.tree.children).toHaveLength(1);
  });
});
