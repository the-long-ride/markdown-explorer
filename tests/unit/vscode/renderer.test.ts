import { describe, expect, test } from 'vitest';
import { HtmlRenderer } from '../../../vscode/src/markdown/renderer';
import type { BlockToken } from '../../../vscode/src/markdown/parser';

function heading(level: number, text: string): BlockToken {
  return { type: 'heading', level, text };
}

function paragraph(text: string, isJsx?: boolean): BlockToken {
  return { type: 'paragraph', text, isJsx };
}

function codeBlock(lang: string, content: string): BlockToken {
  return { type: 'code', lang, content };
}

function hr(): BlockToken {
  return { type: 'hr' };
}

function blockquote(lines: string[]): BlockToken {
  return { type: 'blockquote', lines };
}

function list(ordered: boolean, items: any[]): BlockToken {
  return { type: 'list', ordered, items };
}

function mathBlock(content: string): BlockToken {
  return { type: 'math', content };
}

function tableToken(headers: string[], align: any[], rows: string[][]): BlockToken {
  return { type: 'table', headers, align, rows };
}

describe('HtmlRenderer', () => {
  describe('headings', () => {
    test('renders standalone heading as sub-heading with anchor', () => {
      const r = new HtmlRenderer();
      const { html, toc } = r.render([heading(1, 'My Title')]);
      expect(html).toContain('mdn-section');
      expect(html).toContain('mdn-anchor');
      expect(html).toContain('My Title');
      expect(toc).toHaveLength(1);
      expect(toc[0].text).toBe('My Title');
    });

    test('assigns unique ids to duplicate heading text', () => {
      const renderer = new HtmlRenderer();
      const { html, toc } = renderer.render([
        { type: 'heading', level: 1, text: 'Fixed' },
        { type: 'heading', level: 3, text: 'Fixed' },
        { type: 'heading', level: 2, text: 'Fixed' },
      ] as BlockToken[]);

      expect(toc.map((entry) => entry.id)).toEqual(['fixed', 'fixed-1', 'fixed-2']);
      expect(html).toContain('id="fixed"');
      expect(html).toContain('id="fixed-1"');
      expect(html).toContain('id="fixed-2"');
    });

    test('renders heading with inline markdown', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(2, '**bold** heading')]);
      expect(html).toContain('<strong>bold</strong>');
    });

    test('H2 nests under preceding H1 section (H2 section class still present in HTML)', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(1, 'Top'), heading(2, 'Sub')]);
      expect(html).toContain('mdn-section--h1');
      expect(html).toContain('mdn-section--h2');
    });

    test('H2 without preceding H1 becomes standalone section', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(2, 'Standalone')]);
      expect(html).toContain('mdn-section--h2');
    });

    test('H3 becomes sub-heading rendered inline in parent section', () => {
      const r = new HtmlRenderer();
      const { html, toc } = r.render([heading(1, 'Top'), heading(3, 'Detail'), paragraph('text')]);
      expect(html).toContain('mdn-subheading');
      expect(html).toContain('Detail');
      expect(toc).toHaveLength(2);
    });

    test('content after H2 without preceding H1 goes into H2 section', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(2, 'Section'), paragraph('content')]);
      expect(html).toContain('mdn-section--h2');
      expect(html).not.toContain('mdn-section--h3');
    });
  });

  describe('paragraphs', () => {
    test('renders paragraph with inline markdown', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('**bold** text')]);
      expect(html).toContain('<p>');
      expect(html).toContain('<strong>bold</strong>');
    });

    test('renders JSX paragraph without p wrapper in MDX mode', () => {
      const r = new HtmlRenderer({ isMdx: true });
      const { html } = r.render([paragraph('<Layout />', true)]);
      expect(html).not.toContain('<p>');
    });

    test('renders MDX text starting with < without p wrapper', () => {
      const r = new HtmlRenderer({ isMdx: true });
      const { html } = r.render([paragraph('<div>content</div>')]);
      expect(html).not.toContain('<p>');
    });

    test('renders video paragraph without p wrapper', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('[video](demo.mp4)')]);
      expect(html).not.toContain('<p>');
    });

    test('renders youtube paragraph without p wrapper', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('https://www.youtube.com/watch?v=dQw4w9WgXcQ')]);
      expect(html).not.toContain('<p>');
    });
  });

  describe('code blocks', () => {
    test('renders code block via renderCodeBlock', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([codeBlock('js', 'const x = 1;')]);
      expect(html).toContain('mdn-codeblock');
      expect(html).toContain('language-js');
    });
  });

  describe('math blocks', () => {
    test('renders math block', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([mathBlock('x = y^2')]);
      expect(html).toContain('mdn-math-block');
      expect(html).toContain('data-math');
    });
  });

  describe('horizontal rule', () => {
    test('renders hr with divider class', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([hr()]);
      expect(html).toContain('<hr class="mdn-divider"');
    });
  });

  describe('blockquote', () => {
    test('renders normal blockquote', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['quoted text'])]);
      expect(html).toContain('<blockquote class="mdn-blockquote">');
    });

    test('renders NOTE callout', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!NOTE]'])]);
      expect(html).toContain('mdn-callout--note');
      expect(html).toContain('NOTE');
    });

    test('renders TIP callout', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!TIP] Here is a tip'])]);
      expect(html).toContain('mdn-callout--tip');
    });

    test('renders WARNING callout', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!WARNING]'])]);
      expect(html).toContain('mdn-callout--warning');
    });

    test('renders IMPORTANT callout', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!IMPORTANT] pay attention'])]);
      expect(html).toContain('mdn-callout--important');
    });

    test('renders CAUTION callout', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!CAUTION] watch out'])]);
      expect(html).toContain('mdn-callout--caution');
    });

    test('callout with body parses the body as markdown', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!NOTE]', 'inner text', 'more text'])]);
      expect(html).toContain('mdn-callout-body');
    });

    test('callout with inline text after tag', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!TIP] **bold** tip'])]);
      expect(html).toContain('mdn-callout--tip');
    });
  });

  describe('tables', () => {
    test('renders interactive table', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['Name', 'Value'], [null, null], [['a', '1'], ['b', '2']])]);
      expect(html).toContain('mdn-table-wrap');
      expect(html).toContain('mdn-table');
      expect(html).toContain('<th');
      expect(html).toContain('<td');
    });

    test('renders table with alignment', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['L', 'C', 'R'], ['left', 'center', 'right'], [['1', '2', '3']])]);
      expect(html).toContain('text-align:left');
      expect(html).toContain('text-align:center');
      expect(html).toContain('text-align:right');
    });

    test('renders table without alignment', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['Col'], [null], [['val']])]);
      expect(html).not.toContain('text-align');
    });

    test('adds collapse toggle for tables over 15 rows', () => {
      const rows = Array.from({ length: 20 }, (_, i) => [`r${i}`]);
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['X'], [null], rows)]);
      expect(html).toContain('mdn-table-toggle-btn');
    });

    test('does not add collapse toggle for small tables', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['X'], [null], [['1'], ['2']])]);
      expect(html).not.toContain('mdn-table-toggle-btn');
    });

    test('collapses rows beyond 15 by default', () => {
      const rows = Array.from({ length: 20 }, (_, i) => [`r${i}`]);
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['X'], [null], rows)]);
      expect(html).toContain('is-collapsed-row');
    });

    test('does not collapse rows when 15 or fewer', () => {
      const rows = Array.from({ length: 15 }, (_, i) => [`r${i}`]);
      const r = new HtmlRenderer();
      const { html } = r.render([tableToken(['X'], [null], rows)]);
      expect(html).not.toContain('is-collapsed-row');
    });
  });

  describe('lists', () => {
    test('renders unordered list', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([list(false, [{ text: 'item 1', isTask: false, checked: false }])]);
      expect(html).toContain('<ul');
      expect(html).toContain('mdn-list');
      expect(html).not.toContain('mdn-list--ol');
    });

    test('renders ordered list', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([list(true, [{ text: 'first', isTask: false, checked: false }])]);
      expect(html).toContain('<ol');
      expect(html).toContain('mdn-list--ol');
    });

    test('renders ordered list with custom start', () => {
      const r = new HtmlRenderer();
      const token = { type: 'list' as const, ordered: true, start: 5, items: [{ text: 'item', isTask: false, checked: false }] };
      const { html } = r.render([token]);
      expect(html).toContain('start="5"');
    });

    test('renders task list with checked item', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([list(false, [{ text: 'done', isTask: true, checked: true }])]);
      expect(html).toContain('mdn-task');
      expect(html).toContain('is-checked');
    });

    test('renders task list with unchecked item', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([list(false, [{ text: 'todo', isTask: true, checked: false }])]);
      expect(html).toContain('mdn-task');
      expect(html).not.toContain('is-checked');
    });

    test('renders nested markdown in list items', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([list(false, [{ text: 'outer', isTask: false, checked: false, nestedMarkdown: 'inner **bold**' }])]);
      expect(html).toContain('mdn-list-nested');
      expect(html).toContain('<strong>bold</strong>');
    });
  });

  describe('section grouping', () => {
    test('H1 closes previous H1 section', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([
        heading(1, 'First'),
        paragraph('one'),
        heading(1, 'Second'),
        paragraph('two'),
      ]);
      expect(html).toContain('mdn-section--h1');
    });

    test('H2 closes previous H2 section', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([
        heading(1, 'H1'),
        heading(2, 'First H2'),
        paragraph('a'),
        heading(2, 'Second H2'),
        paragraph('b'),
      ]);
      expect(html).toContain('mdn-section--h2');
    });

    test('non-heading tokens between H2 sections go into each section', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([
        heading(2, 'A'),
        paragraph('a content'),
        heading(2, 'B'),
        paragraph('b content'),
      ]);
      expect(html).toContain('A');
      expect(html).toContain('B');
    });

    test('tokens before any heading are standalone', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([
        paragraph('intro'),
        heading(1, 'Main'),
        paragraph('body'),
      ]);
      expect(html).toContain('<p>intro</p>');
    });
  });

  describe('empty render', () => {
    test('renders empty tokens returns empty html', () => {
      const r = new HtmlRenderer();
      const { html, toc } = r.render([]);
      expect(html).toBe('');
      expect(toc).toHaveLength(0);
    });
  });

  describe('isVideoParagraph branches', () => {
    test('detects <video tag paragraph', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('<video src="clip.mp4" controls></video>')]);
      expect(html).not.toContain('<p>');
    });

    test('detects <figure tag paragraph', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('<figure><img src="pic.jpg"/><figcaption>Fig</figcaption></figure>')]);
      expect(html).not.toContain('<p>');
    });

    test('detects bare URL video .mp4', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('https://example.com/clip.mp4')]);
      expect(html).not.toContain('<p>');
    });

    test('detects image link to video file', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('![alt](video.mp4)')]);
      expect(html).not.toContain('<p>');
    });

    test('detects regular link to video .webm', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('[click](video.webm)')]);
      expect(html).not.toContain('<p>');
    });

    test('detects bare URL .m3u8 stream', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([paragraph('https://site.com/stream.m3u8')]);
      expect(html).not.toContain('<p>');
    });
  });

  describe('sub-heading H4 H5 H6', () => {
    test('renders H4 as sub-heading', () => {
      const r = new HtmlRenderer();
      const { html, toc } = r.render([heading(1, 'Top'), heading(4, 'H4 Detail')]);
      expect(html).toContain('mdn-subheading');
      expect(toc).toHaveLength(2);
      expect(toc[1].level).toBe(4);
    });

    test('renders H5 as sub-heading', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(2, 'Section'), heading(5, 'H5 Detail')]);
      expect(html).toContain('mdn-subheading');
    });

    test('renders H6 as sub-heading', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([heading(1, 'Top'), heading(6, 'H6 Detail')]);
      expect(html).toContain('mdn-subheading');
    });
  });

  describe('blockquote multi-line callout body', () => {
    test('renders callout with multiple body lines', () => {
      const r = new HtmlRenderer();
      const { html } = r.render([blockquote(['[!WARNING]', 'line one', 'line two', 'line three'])]);
      expect(html).toContain('mdn-callout--warning');
      expect(html).toContain('mdn-callout-body');
    });
  });

  describe('isCategoryColumn edge cases', () => {
    test('exactly 3 rows with unique count equal to N returns false', () => {
      const r = new HtmlRenderer();
      const rows = [['alpha'], ['beta'], ['gamma']];
      const { html } = r.render([tableToken(['Cat'], [null], rows)]);
      expect(html).not.toContain('has-filter');
    });

    test('exactly 3 rows with unique count = 1 returns false', () => {
      const r = new HtmlRenderer();
      const rows = [['same'], ['same'], ['same']];
      const { html } = r.render([tableToken(['Cat'], [null], rows)]);
      expect(html).not.toContain('has-filter');
    });

    test('3 rows with unique count between 1 and N triggers filter', () => {
      const r = new HtmlRenderer();
      const rows = [['catA'], ['catA'], ['catB']];
      const { html } = r.render([tableToken(['Cat'], [null], rows)]);
      expect(html).toContain('has-filter');
    });

    test('fewer than 3 rows never triggers filter', () => {
      const r = new HtmlRenderer();
      const rows = [['a'], ['b']];
      const { html } = r.render([tableToken(['Cat'], [null], rows)]);
      expect(html).not.toContain('has-filter');
    });

    test('ratio check: many unique values with long text returns false', () => {
      const r = new HtmlRenderer();
      const rows = Array.from({ length: 20 }, (_, i) => ['x'.repeat(50) + i]);
      const { html } = r.render([tableToken(['Col'], [null], rows)]);
      expect(html).not.toContain('has-filter');
    });
  });

  describe('ordered list with start=1', () => {
    test('does not render start attribute when start is 1', () => {
      const r = new HtmlRenderer();
      const token = { type: 'list' as const, ordered: true, start: 1, items: [{ text: 'item', isTask: false, checked: false }] };
      const { html } = r.render([token]);
      expect(html).not.toContain('start=');
    });
  });
});