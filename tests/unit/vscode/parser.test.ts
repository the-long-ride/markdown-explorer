import { describe, expect, test } from 'vitest';
import { parse } from '../../../vscode/src/markdown/parser';

describe('parse', () => {
  describe('frontmatter', () => {
    test('extracts frontmatter key-value pairs', () => {
      const result = parse(
        ['---', 'title: Hello', 'author: World', '---', '', '# Heading'].join('\n'),
      );
      expect(result.frontmatter).toEqual({ title: 'Hello', author: 'World' });
      expect(result.tokens).toHaveLength(1);
    });

    test('returns empty frontmatter when no delimiter', () => {
      const result = parse('# No frontmatter');
      expect(result.frontmatter).toEqual({});
    });

    test('skips lines without colon in frontmatter', () => {
      const result = parse(
        ['---', 'title: Hello', 'no-colon-here', '---', '', '# H1'].join('\n'),
      );
      expect(result.frontmatter).toEqual({ title: 'Hello' });
    });
  });

  describe('headings', () => {
    test('parses ATX headings levels 1-6', () => {
      const result = parse('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6');
      expect(result.tokens.map((t: any) => t.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('strips closing # sequences from ATX headings', () => {
      const result = parse('## Heading with closing ##');
      expect((result.tokens[0] as any).text).toBe('Heading with closing');
    });

    test('parses setext heading level 1 (=== underline)', () => {
      const result = parse('Setext H1\n===');
      expect((result.tokens[0] as any).type).toBe('heading');
      expect((result.tokens[0] as any).level).toBe(1);
      expect((result.tokens[0] as any).text).toBe('Setext H1');
    });

    test('parses setext heading level 2 (--- underline)', () => {
      const result = parse('Setext H2\n---');
      expect((result.tokens[0] as any).type).toBe('heading');
      expect((result.tokens[0] as any).level).toBe(2);
    });

    test('does not treat --- underline after a list marker line as setext heading', () => {
      const result = parse('- item\n---');
      expect(result.tokens[0].type).toBe('list');
    });

    test('blank line before setext underline prevents heading', () => {
      const result = parse('text\n\n===');
      expect(result.tokens[0].type).not.toBe('heading');
    });
  });

  describe('code blocks', () => {
    test('parses fenced code block with language', () => {
      const result = parse('```js\nconst x = 1;\n```');
      expect(result.tokens[0].type).toBe('code');
      expect((result.tokens[0] as any).lang).toBe('js');
      expect((result.tokens[0] as any).content).toBe('const x = 1;');
    });

    test('parses fenced code block with tildes', () => {
      const result = parse('~~~python\nprint("hello")\n~~~');
      expect(result.tokens[0].type).toBe('code');
      expect((result.tokens[0] as any).lang).toBe('python');
    });

    test('parses fenced code block without language', () => {
      const result = parse('```\nsome code\n```');
      expect(result.tokens[0].type).toBe('code');
      expect((result.tokens[0] as any).lang).toBe('');
    });

    test('parses fenced code block with language and dots', () => {
      const result = parse('```ts.include\nconst x = 1;\n```');
      expect((result.tokens[0] as any).lang).toBe('ts.include');
    });
  });

  describe('math blocks', () => {
    test('parses $$ display math block', () => {
      const result = parse('$$\nx = y^2\n$$');
      expect(result.tokens[0].type).toBe('math');
      expect((result.tokens[0] as any).content).toBe('x = y^2');
    });

    test('parses \\[ \\] display math block', () => {
      const result = parse('\\[\nx = y^2\n\\]');
      expect(result.tokens[0].type).toBe('math');
    });

    test('consumes closing fence even at end of file', () => {
      const result = parse('$$\nx = 1\n$$\n');
      expect(result.tokens).toHaveLength(1);
    });
  });

  describe('horizontal rule', () => {
    test('parses --- as hr', () => {
      const result = parse('---');
      expect(result.tokens[0].type).toBe('hr');
    });

    test('parses *** as hr', () => {
      const result = parse('***');
      expect(result.tokens[0].type).toBe('hr');
    });

    test('parses ___ as hr', () => {
      const result = parse('___');
      expect(result.tokens[0].type).toBe('hr');
    });
  });

  describe('blockquote', () => {
    test('parses single-line blockquote', () => {
      const result = parse('> quoted text');
      expect(result.tokens[0].type).toBe('blockquote');
      expect((result.tokens[0] as any).lines).toEqual(['quoted text']);
    });

    test('parses multi-line blockquote', () => {
      const result = parse('> line one\n> line two');
      expect((result.tokens[0] as any).lines).toEqual(['line one', 'line two']);
    });
  });

  describe('tables', () => {
    test('parses pipe table with alignment', () => {
      const result = parse(
        '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |',
      );
      expect(result.tokens[0].type).toBe('table');
      expect((result.tokens[0] as any).headers).toEqual(['Left', 'Center', 'Right']);
      expect((result.tokens[0] as any).align).toEqual(['left', 'center', 'right']);
      expect((result.tokens[0] as any).rows).toEqual([['a', 'b', 'c']]);
    });

    test('parses pipe table without alignment', () => {
      const result = parse('| A | B |\n| --- | --- |\n| 1 | 2 |');
      expect((result.tokens[0] as any).align).toEqual([null, null]);
    });

    test('parses pipe table with no leading/trailing pipes', () => {
      const result = parse('A | B\n--- | ---\n1 | 2');
      expect((result.tokens[0] as any).headers).toEqual(['A', 'B']);
    });

    test('handles backslash-escaped pipe in table cell', () => {
      const result = parse('A | B\n---|---\na \\| b | c');
      expect((result.tokens[0] as any).rows[0]).toEqual(['a | b', 'c']);
    });

    test('handles backtick code in pipe cells', () => {
      const result = parse('Code | Desc\n---|---\n`x|y` | text');
      expect((result.tokens[0] as any).rows[0]).toEqual(['`x|y`', 'text']);
    });

    test('handles multi-code-backtick in pipe cells', () => {
      const result = parse('Code | Desc\n---|---\n``x|y `` | text');
      expect((result.tokens[0] as any).rows[0]).toEqual(['``x|y ``', 'text']);
    });

    test('normalizes cells when fewer than headers', () => {
      const result = parse('| A | B | C |\n| --- | --- | --- |\n| x |');
      expect((result.tokens[0] as any).rows[0]).toEqual(['x', '', '']);
    });

    test('normalizes cells when more than headers (2 columns: joins extras into first cell)', () => {
      const result = parse('| A | B |\n| --- | --- |\n| 1 | 2 | 3 |');
      expect((result.tokens[0] as any).rows[0]).toEqual(['1 | 2', '3']);
    });

    test('normalizes cells when more than headers (3+ columns: joins extras into last cell)', () => {
      const result = parse('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 | 4 | 5 |');
      expect((result.tokens[0] as any).rows[0]).toEqual(['1', '2', '3 | 4 | 5']);
    });

    test('filters out rows that are all empty cells', () => {
      const result = parse('A | B\n---|---\n | ');
      expect((result.tokens[0] as any).rows).toHaveLength(0);
    });

    test('parses tab-separated table', () => {
      const result = parse('A\tB\tC\n1\t2\t3');
      expect(result.tokens[0].type).toBe('table');
      expect((result.tokens[0] as any).headers).toEqual(['A', 'B', 'C']);
      expect((result.tokens[0] as any).rows).toEqual([['1', '2', '3']]);
    });

    test('rejects tab table with only one column', () => {
      const result = parse('A\tB\n1\t2\nxyz');
      const tables = result.tokens.filter((t) => t.type === 'table');
      expect(tables).toHaveLength(1);
    });

    test('skips empty rows in tab table', () => {
      const result = parse('A\tB\n1\t2\n\n3\t4');
      const tableTokens = result.tokens.filter((t) => t.type === 'table');
      expect(tableTokens[0].type).toBe('table');
    });
  });

  describe('lists', () => {
    test('parses unordered list with hyphens', () => {
      const result = parse('- item 1\n- item 2\n- item 3');
      expect(result.tokens[0].type).toBe('list');
      expect((result.tokens[0] as any).ordered).toBe(false);
      expect((result.tokens[0] as any).items).toHaveLength(3);
    });

    test('parses unordered list with asterisks', () => {
      const result = parse('* item 1\n* item 2');
      expect((result.tokens[0] as any).items).toHaveLength(2);
    });

    test('parses unordered list with plus signs', () => {
      const result = parse('+ item 1\n+ item 2');
      expect((result.tokens[0] as any).items).toHaveLength(2);
    });

    test('parses ordered list', () => {
      const result = parse('1. first\n2. second\n3. third');
      expect(result.tokens[0].type).toBe('list');
      expect((result.tokens[0] as any).ordered).toBe(true);
      expect((result.tokens[0] as any).start).toBe(1);
      expect((result.tokens[0] as any).items).toHaveLength(3);
    });

    test('parses ordered list with parenthesis style', () => {
      const result = parse('1) first\n2) second');
      expect((result.tokens[0] as any).ordered).toBe(true);
      expect((result.tokens[0] as any).start).toBe(1);
    });

    test('parses task list items', () => {
      const result = parse('- [x] completed\n- [ ] pending\n- [X] also completed');
      const items = (result.tokens[0] as any).items;
      expect(items[0].isTask).toBe(true);
      expect(items[0].checked).toBe(true);
      expect(items[0].text).toBe('completed');
      expect(items[1].isTask).toBe(true);
      expect(items[1].checked).toBe(false);
      expect(items[1].text).toBe('pending');
      expect(items[2].checked).toBe(true);
    });

    test('parses list with nested indented markdown', () => {
      const result = parse('- outer\n\n  inner paragraph\n  more inner');
      const items = (result.tokens[0] as any).items;
      expect(items[0].nestedMarkdown).toContain('inner paragraph');
    });

    test('parses list with indented content without blank line', () => {
      const result = parse('- outer\n  inner');
      const items = (result.tokens[0] as any).items;
      expect(items[0].nestedMarkdown).toContain('inner');
    });

    test('skips list items separated by blank line without indented content', () => {
      const result = parse('- item 1\n\n- item 2');
      expect((result.tokens[0] as any).items).toHaveLength(2);
    });
  });

  describe('paragraphs', () => {
    test('parses simple paragraph', () => {
      const result = parse('Hello world');
      expect(result.tokens[0].type).toBe('paragraph');
      expect((result.tokens[0] as any).text).toBe('Hello world');
    });

    test('joins multiple lines into single paragraph', () => {
      const result = parse('line one\nline two');
      expect((result.tokens[0] as any).text).toBe('line one line two');
    });

    test('blank lines separate paragraphs', () => {
      const result = parse('first\n\nsecond');
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].type).toBe('paragraph');
      expect(result.tokens[1].type).toBe('paragraph');
    });

    test('empty input returns no tokens', () => {
      const result = parse('');
      expect(result.tokens).toHaveLength(0);
    });

    test('whitespace-only input returns no tokens', () => {
      const result = parse('   \n  \n');
      expect(result.tokens).toHaveLength(0);
    });

    test('handles CRLF line endings', () => {
      const result = parse('# Hello World\r\n\r\nparagraph');
      expect(result.tokens).toHaveLength(2);
    });
  });

  describe('MDX support', () => {
    test('strips import and export lines', () => {
      const result = parse(
        "import { Foo } from 'bar'\nexport const x = 1\n\n# Heading",
        true,
      );
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].type).toBe('heading');
    });

    test('parses JSX block as paragraph with isJsx flag', () => {
      const result = parse('<Layout>\ncontent\n</Layout>', true);
      expect(result.tokens[0].type).toBe('paragraph');
      expect((result.tokens[0] as any).isJsx).toBe(true);
      expect((result.tokens[0] as any).text).toContain('Layout');
    });

    test('JSX block stops at blank line', () => {
      const result = parse('<Layout title="hello" />\n\n# heading', true);
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].type).toBe('paragraph');
      expect(result.tokens[1].type).toBe('heading');
    });

    test('non-MDX mode does not parse JSX blocks', () => {
      const result = parse('<Layout title="hello" />');
      expect(result.tokens[0].type).toBe('paragraph');
      expect((result.tokens[0] as any).isJsx).toBeUndefined();
    });
  });

  describe('safety fallback', () => {
    test('consumes unrecognized line as paragraph', () => {
      const result = parse('::: ignored special syntax');
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].type).toBe('paragraph');
    });
  });
});