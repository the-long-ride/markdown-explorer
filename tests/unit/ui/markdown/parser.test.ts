import { describe, it, expect } from 'vitest';
import { parse } from '../../../../ui/src/markdown/parser';
import type { BlockToken, HeadingToken, ParagraphToken, CodeBlockToken, MathBlockToken, BlockquoteToken, TableToken, ListToken, HrToken } from '../../../../ui/src/markdown/parser';

describe('parser', () => {
  describe('parse', () => {
    it('normalizes CRLF to LF', () => {
      const result = parse('# Hello\r\nWorld');
      expect(result.tokens).toEqual([
        { type: 'heading', level: 1, text: 'Hello' },
        { type: 'paragraph', text: 'World' },
      ]);
    });

    it('normalizes CR to LF', () => {
      const result = parse('# Hello\rWorld');
      expect(result.tokens).toEqual([
        { type: 'heading', level: 1, text: 'Hello' },
        { type: 'paragraph', text: 'World' },
      ]);
    });

    it('returns empty tokens for empty input', () => {
      const result = parse('');
      expect(result.tokens).toEqual([]);
      expect(result.frontmatter).toEqual({});
    });

    it('returns empty tokens for whitespace-only input', () => {
      const result = parse('   \n\n  \n');
      expect(result.tokens).toEqual([]);
    });
  });

  describe('frontmatter', () => {
    it('extracts simple frontmatter', () => {
      const result = parse('---\ntitle: Test\nauthor: Me\n---\n# Hello');
      expect(result.frontmatter).toEqual({ title: 'Test', author: 'Me' });
      expect(result.tokens[0]).toEqual({ type: 'heading', level: 1, text: 'Hello' });
    });

    it('returns empty frontmatter when no delimiters', () => {
      const result = parse('# No Frontmatter');
      expect(result.frontmatter).toEqual({});
    });

    it('skips lines without colon in frontmatter', () => {
      const result = parse('---\ntitle: Test\nno-colon-line\n---\nContent');
      expect(result.frontmatter).toEqual({ title: 'Test' });
    });

    it('handles frontmatter with trailing newline', () => {
      const result = parse('---\nkey: value\n---\nText');
      expect(result.frontmatter).toEqual({ key: 'value' });
    });
  });

  describe('MDX mode', () => {
    it('strips import statements in MDX mode', () => {
      const result = parse("import Foo from './ Foo'\n\n# Hello", true);
      expect(result.tokens).toEqual([{ type: 'heading', level: 1, text: 'Hello' }]);
    });

    it('strips export statements in MDX mode', () => {
      const result = parse("export const x = 1\n\n# Hello", true);
      expect(result.tokens).toEqual([{ type: 'heading', level: 1, text: 'Hello' }]);
    });

    it('preserves non-import/export lines in MDX mode', () => {
      const result = parse("const x = 1\n\n# Hello", true);
      expect(result.tokens).toContainEqual({ type: 'paragraph', text: 'const x = 1' });
    });

    it('parses JSX blocks in MDX mode', () => {
      const result = parse('<MyComponent\n  prop="val"\n/>', true);
      expect(result.tokens).toEqual([
        { type: 'paragraph', text: '<MyComponent\n  prop="val"\n/>', isJsx: true },
      ]);
    });
  });

  describe('ATX headings', () => {
    it('parses h1 through h6', () => {
      for (let level = 1; level <= 6; level++) {
        const hashes = '#'.repeat(level);
        const result = parse(`${hashes} Heading ${level}`);
        expect(result.tokens[0]).toEqual({ type: 'heading', level, text: `Heading ${level}` });
      }
    });

    it('strips trailing # from heading text', () => {
      const result = parse('# Heading ##');
      expect(result.tokens[0]).toEqual({ type: 'heading', level: 1, text: 'Heading' });
    });

    it('preserves mid-line # in heading text', () => {
      const result = parse('# C# and F#');
      expect((result.tokens[0] as HeadingToken).text).toBe('C# and F#');
    });
  });

  describe('setext headings', () => {
    it('parses setext h1 with = underline', () => {
      const result = parse('Heading\n===');
      expect(result.tokens[0]).toEqual({ type: 'heading', level: 1, text: 'Heading' });
    });

    it('parses setext h2 with - underline', () => {
      const result = parse('Heading\n---');
      expect(result.tokens[0]).toEqual({ type: 'heading', level: 2, text: 'Heading' });
    });

    it('does not confuse list marker with setext h2', () => {
      const result = parse('- item\n---');
      expect(result.tokens[0].type).toBe('list');
    });
  });

  describe('horizontal rule', () => {
    it('parses --- as hr', () => {
      const result = parse('---');
      expect(result.tokens[0]).toEqual({ type: 'hr' });
    });

    it('parses *** as hr', () => {
      const result = parse('***');
      expect(result.tokens[0]).toEqual({ type: 'hr' });
    });

    it('parses ___ as hr', () => {
      const result = parse('___');
      expect(result.tokens[0]).toEqual({ type: 'hr' });
    });
  });

  describe('paragraphs', () => {
    it('collects contiguous non-blank lines as paragraph', () => {
      const result = parse('Line one\nLine two');
      expect(result.tokens[0]).toEqual({ type: 'paragraph', text: 'Line one Line two' });
    });

    it('separates paragraphs with blank lines', () => {
      const result = parse('Para 1\n\nPara 2');
      expect(result.tokens).toEqual([
        { type: 'paragraph', text: 'Para 1' },
        { type: 'paragraph', text: 'Para 2' },
      ]);
    });
  });

  describe('code blocks', () => {
    it('parses fenced code with backticks', () => {
      const result = parse('```js\nconsole.log("hi")\n```');
      expect(result.tokens[0]).toEqual({
        type: 'code',
        lang: 'js',
        content: 'console.log("hi")',
      });
    });

    it('parses fenced code with tildes', () => {
      const result = parse('~~~python\nprint("hi")\n~~~');
      expect(result.tokens[0]).toEqual({
        type: 'code',
        lang: 'python',
        content: 'print("hi")',
      });
    });

    it('parses fenced code with no language', () => {
      const result = parse('```\ncode\n```');
      expect(result.tokens[0]).toEqual({ type: 'code', lang: '', content: 'code' });
    });

    it('parses fenced code with lang suffixes like .tsx', () => {
      const result = parse('```tsx\nexport default () => <div/>\n```');
      expect((result.tokens[0] as CodeBlockToken).lang).toBe('tsx');
    });
  });

  describe('display math', () => {
    it('parses $$ math block', () => {
      const result = parse('$$\nE = mc^2\n$$');
      expect(result.tokens[0]).toEqual({ type: 'math', content: 'E = mc^2' });
    });

    it('parses \\[ math block', () => {
      const result = parse('\\[\nE = mc^2\n\\]');
      expect(result.tokens[0]).toEqual({ type: 'math', content: 'E = mc^2' });
    });

    it('handles unclosed math block gracefully', () => {
      const result = parse('$$\nE = mc^2');
      expect(result.tokens[0]).toEqual({ type: 'math', content: 'E = mc^2' });
    });
  });

  describe('blockquote', () => {
    it('parses blockquote with > prefix', () => {
      const result = parse('> Hello\n> World');
      expect(result.tokens[0]).toEqual({ type: 'blockquote', lines: ['Hello', 'World'] });
    });

    it('strips leading space after >', () => {
      const result = parse('>  Indented');
      expect(result.tokens[0]).toEqual({ type: 'blockquote', lines: ['Indented'] });
    });
  });

  describe('pipe tables', () => {
    it('parses simple pipe table', () => {
      const result = parse('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
      const table = result.tokens[0] as TableToken;
      expect(table.type).toBe('table');
      expect(table.headers).toEqual(['Name', 'Age']);
      expect(table.rows).toEqual([['Alice', '30']]);
    });

    it('detects column alignment', () => {
      const result = parse('| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |');
      const table = result.tokens[0] as TableToken;
      expect(table.align).toEqual(['left', 'center', 'right']);
    });

    it('handles null alignment', () => {
      const result = parse('| A |\n| --- |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.align).toEqual([null]);
    });

    it('handles escaped pipe in cells', () => {
      const result = parse('| a \\| b |\n| --- |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.headers[0]).toBe('a | b');
    });

    it('handles code span in cells', () => {
      const result = parse('| `a|b` |\n| --- |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.headers[0]).toBe('`a|b`');
    });

    it('returns null for single-line table (no separator)', () => {
      const result = parse('| A |');
      expect(result.tokens[0].type).toBe('paragraph');
    });

    it('normalizes rows with fewer cells', () => {
      const result = parse('| A | B |\n| --- | --- |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.rows[0]).toEqual(['x', '']);
    });

    it('filters out empty rows', () => {
      const result = parse('| A |\n| --- |\n|  |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.rows).toEqual([['x']]);
    });
  });

  describe('tab-separated tables', () => {
    it('parses tab-separated table', () => {
      const result = parse('Name\tAge\nAlice\t30\nBob\t25');
      const table = result.tokens[0] as TableToken;
      expect(table.type).toBe('table');
      expect(table.headers).toEqual(['Name', 'Age']);
      expect(table.rows).toEqual([['Alice', '30'], ['Bob', '25']]);
    });

    it('skips single-line tab content (no table)', () => {
      const result = parse('Name\tAge');
      expect(result.tokens[0].type).toBe('paragraph');
    });
  });

  describe('normalizeTableCells', () => {
    it('pads shorter rows', () => {
      const result = parse('| A | B | C |\n| --- | --- | --- |\n| x |');
      const table = result.tokens[0] as TableToken;
      expect(table.rows[0]).toEqual(['x', '', '']);
    });

    it('joins extra cells when column count is 2', () => {
      const result = parse('| A | B |\n| --- | --- |\n| x | y | z |');
      const table = result.tokens[0] as TableToken;
      expect(table.rows[0]).toEqual(['x | y', 'z']);
    });

    it('joins extra cells when column count > 2', () => {
      const result = parse('| A | B | C |\n| --- | --- | --- |\n| x | y | z | w |');
      const table = result.tokens[0] as TableToken;
      expect(table.rows[0]).toEqual(['x', 'y', 'z | w']);
    });
  });

  describe('lists', () => {
    it('parses unordered list with -', () => {
      const result = parse('- one\n- two');
      const list = result.tokens[0] as ListToken;
      expect(list.type).toBe('list');
      expect(list.ordered).toBe(false);
      expect(list.items).toEqual([
        { text: 'one', isTask: false, checked: false },
        { text: 'two', isTask: false, checked: false },
      ]);
    });

    it('parses unordered list with *', () => {
      const result = parse('* one\n* two');
      expect((result.tokens[0] as ListToken).ordered).toBe(false);
    });

    it('parses unordered list with +', () => {
      const result = parse('+ one\n+ two');
      expect((result.tokens[0] as ListToken).ordered).toBe(false);
    });

    it('parses ordered list', () => {
      const result = parse('1. first\n2. second');
      const list = result.tokens[0] as ListToken;
      expect(list.ordered).toBe(true);
      expect(list.start).toBe(1);
      expect(list.items).toEqual([
        { text: 'first', isTask: false, checked: false },
        { text: 'second', isTask: false, checked: false },
      ]);
    });

    it('parses ordered list with ) separator', () => {
      const result = parse('1) first\n2) second');
      const list = result.tokens[0] as ListToken;
      expect(list.ordered).toBe(true);
      expect(list.start).toBe(1);
    });

    it('parses task list with checked checkbox', () => {
      const result = parse('- [x] done\n- [ ] pending');
      const list = result.tokens[0] as ListToken;
      expect(list.items[0]).toEqual({ text: 'done', isTask: true, checked: true });
      expect(list.items[1]).toEqual({ text: 'pending', isTask: true, checked: false });
    });

    it('parses task list with uppercase X', () => {
      const result = parse('- [X] done');
      const list = result.tokens[0] as ListToken;
      expect(list.items[0].checked).toBe(true);
    });

    it('handles nested content in list items', () => {
      const result = parse('- item 1\n  nested paragraph\n\n  more nested\n- item 2');
      const list = result.tokens[0] as ListToken;
      expect(list.items[0].nestedMarkdown).toContain('nested paragraph');
      expect(list.items[0].nestedMarkdown).toContain('more nested');
    });

    it('handles list with blank lines between items', () => {
      const result = parse('- one\n\n- two');
      const list = result.tokens[0] as ListToken;
      expect(list.items).toHaveLength(2);
    });

    it('breaks list when non-list content follows', () => {
      const result = parse('- item\nParagraph');
      const list = result.tokens[0] as ListToken;
      expect(list.items).toHaveLength(1);
      expect(result.tokens[1].type).toBe('paragraph');
    });
  });

  describe('mixed content', () => {
    it('parses a full document with multiple block types', () => {
      const md = `# Title

Some paragraph text.

- list item
- another item

\`\`\`js
code
\`\`\`

| H1 | H2 |
| --- | --- |
| a | b |

---

> quote`;
      const result = parse(md);
      const types = result.tokens.map(t => t.type);
      expect(types).toEqual(['heading', 'paragraph', 'list', 'code', 'table', 'hr', 'blockquote']);
    });
  });
});
