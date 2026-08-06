import { describe, it, expect } from 'vitest';
import { HtmlRenderer } from '../../../../ui/src/markdown/renderer';
import { parse } from '../../../../ui/src/markdown/parser';
import type { BlockToken } from '../../../../ui/src/markdown/parser';

function tokenize(md: string): BlockToken[] {
  return parse(md).tokens;
}

function stripBookmarkMetadata(html: string): string {
  return html.replace(/\s+data-mdn-(?:source-start|source-end|bookmark-kind|math-source|mermaid-source|bookmark-alt|bookmark-url)="[^"]*"/g, '');
}

describe('markdown/renderer', () => {
  describe('HtmlRenderer', () => {
    it('renders empty token array', () => {
      const renderer = new HtmlRenderer();
      const { html, toc } = renderer.render([]);
      expect(html).toBe('');
      expect(toc).toEqual([]);
    });

    describe('constructor options', () => {
      it('passes theme to HTML iframe srcdoc', () => {
        const renderer = new HtmlRenderer({ theme: 'dark' });
        const { html } = renderer.render([{ type: 'code', lang: 'html', content: '<p>hi</p>' }]);
        expect(html).toContain('srcdoc');
      });

      it('uses default isMdx=false', () => {
        const renderer = new HtmlRenderer();
        const { html } = renderer.render([{ type: 'paragraph', text: 'hello' }]);
        expect(stripBookmarkMetadata(html)).toContain('<p>hello</p>');
      });
    });

    describe('headings', () => {
      it('renders H1 as collapsible section', () => {
        const tokens = tokenize('# Title');
        const renderer = new HtmlRenderer();
        const { html, toc } = renderer.render(tokens);
        expect(html).toContain('mdn-section--h1');
        expect(html).toContain('mdn-section-title');
        expect(toc).toEqual([{ level: 1, text: 'Title', id: 'title' }]);
      });

      it('renders H2 as collapsible section under H1', () => {
        const tokens = tokenize('# Main\n## Sub');
        const renderer = new HtmlRenderer();
        const { html, toc } = renderer.render(tokens);
        expect(html).toContain('mdn-section--h1');
        expect(html).toContain('mdn-section--h2');
        expect(toc).toHaveLength(2);
      });

      it('renders H3+ as sub-headings', () => {
        const tokens = tokenize('# Title\n### Sub-sub');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-subheading');
      });

      it('assigns unique ids to duplicate heading text', () => {
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

      it('keeps heading ids without rendering visible hash anchors', () => {
        const tokens = tokenize('# My Title');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('id="my-title"');
        expect(html).not.toContain('mdn-anchor');
        expect(html).not.toContain('href="#my-title"');
        expect(html).not.toContain('>#</a>');
      });

      it('renders copy button in section', () => {
        const tokens = tokenize('# Title');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-section-copy-btn');
      });

      it('renders the heading badge after text and before the section copy button', () => {
        const tokens = tokenize('# Title\n## Subheading');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);

        expect(stripBookmarkMetadata(html)).toMatch(
          /<span class="mdn-heading-text">Title<span class="mdn-heading-level" aria-hidden="true">H1<\/span><\/span>\s*<\/h1>\s*<button[^>]*class="mdn-section-copy-btn[^\"]*"/s,
        );
        expect(stripBookmarkMetadata(html)).toMatch(
          /<span class="mdn-heading-text">Subheading<span class="mdn-heading-level" aria-hidden="true">H2<\/span><\/span>\s*<\/h2>\s*<button[^>]*class="mdn-section-copy-btn[^\"]*"/s,
        );
      });

      it('renders absolute heading-level labels for H1 through H6', () => {
        const tokens = tokenize('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);

        for (let level = 1; level <= 6; level += 1) {
          expect(html).toContain(`mdn-heading-level" aria-hidden="true">H${level}`);
        }
      });

      it('renders chevron in section header', () => {
        const tokens = tokenize('# Title');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-section-chevron');
      });


      it('uses CSP-safe delegated heading controls', () => {
        const { html } = new HtmlRenderer().render(tokenize('# Title'));
        expect(html).toContain('class="mdn-section-header"');
        expect(html).toContain('role="button"');
        expect(html).toContain('aria-expanded="true"');
        expect(html).not.toContain('onclick="UI.toggleSection');
        expect(html).not.toContain('onkeydown="if(event.key');
      });
    });

    describe('section grouping', () => {
      it('H2 nests under H1', () => {
        const tokens = tokenize('# Alpha\n## Beta\nContent');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        const h1Count = (html.match(/mdn-section--h1/g) || []).length;
        const h2Count = (html.match(/mdn-section--h2/g) || []).length;
        expect(h1Count).toBe(1);
        expect(h2Count).toBe(1);
      });

      it('standalone H2 without preceding H1 renders as top-level section', () => {
        const tokens = tokenize('## Standalone');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-section--h2');
      });

      it('paragraphs before any heading render as top-level', () => {
        const tokens = tokenize('Intro text\n\n# Heading');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(stripBookmarkMetadata(html)).toContain('<p>');
      });
    });

    describe('paragraphs', () => {
      it('wraps paragraphs in <p>', () => {
        const tokens = tokenize('Hello world');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(stripBookmarkMetadata(html)).toContain('<p>Hello world</p>');
      });

      it('detects video paragraph and renders without <p> wrapper', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: '<video src="x.mp4"></video>' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });

      it('detects YouTube URL paragraph', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: 'https://www.youtube.com/watch?v=abc123' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
        expect(html).toContain('iframe');
      });

      it('detects YouTube-nocookie URL paragraph', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: 'https://www.youtube-nocookie.com/watch?v=abc1234' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('iframe');
      });

      it('detects video image paragraph', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: '![alt](clip.mp4)' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });

      it('detects video link paragraph', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: '[watch](video.mp4)' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });

      it('detects bare video URL paragraph', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: 'https://example.com/video.mp4' }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });

      it('renders JSX paragraph as inline (MDX)', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: '<MyComp />', isJsx: true }];
        const renderer = new HtmlRenderer({ isMdx: true });
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });

      it('renders MDX text starting with < as inline', () => {
        const tokens: BlockToken[] = [{ type: 'paragraph', text: '  <Comp />' }];
        const renderer = new HtmlRenderer({ isMdx: true });
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('<p>');
      });
    });

    describe('code blocks', () => {
      it('delegates to renderCodeBlock', () => {
        const tokens = tokenize('```js\nconsole.log("hi")\n```');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-codeblock');
      });
    });

    describe('math blocks', () => {
      it('renders display math with data-math attribute', () => {
        const tokens = tokenize('$$\nE = mc^2\n$$');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-math-block');
        expect(html).toContain('data-math');
      });
    });

    describe('horizontal rules', () => {
      it('renders <hr> with class mdn-divider', () => {
        const tokens = tokenize('---');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-divider');
      });
    });

    describe('blockquotes', () => {
      it('renders plain blockquote', () => {
        const tokens = tokenize('> Some quote');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-blockquote');
      });

      it('renders NOTE callout', () => {
        const tokens = tokenize('> [!NOTE]\n> This is a note');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--note');
      });

      it('renders TIP callout', () => {
        const tokens = tokenize('> [!TIP]\n> Helpful tip');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--tip');
      });

      it('renders WARNING callout', () => {
        const tokens = tokenize('> [!WARNING]\n> Beware');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--warning');
      });

      it('renders IMPORTANT callout', () => {
        const tokens = tokenize('> [!IMPORTANT]\n> Critical info');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--important');
      });

      it('renders CAUTION callout', () => {
        const tokens = tokenize('> [!CAUTION]\n> Danger');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--caution');
      });

      it('renders callout with inline text after type', () => {
        const tokens = tokenize('> [!NOTE] Quick note');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--note');
      });

      it('renders callout body with parsed markdown', () => {
        const tokens = tokenize('> [!NOTE]\n> - item 1\n> - item 2');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout-body');
      });

      it('renders empty callout', () => {
        const tokens = tokenize('> [!NOTE]');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-callout--note');
      });
    });

    describe('tables', () => {
      it('renders table with search toolbar', () => {
        const tokens = tokenize('| H1 | H2 |\n| --- | --- |\n| a | b |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-table-wrap');
        expect(html).toContain('mdn-table-toolbar');
        expect(html).toContain('mdn-table-input');
      });

      it('renders column alignment', () => {
        const tokens = tokenize('| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('text-align:left');
        expect(html).toContain('text-align:center');
        expect(html).toContain('text-align:right');
      });

      it('shows filter button for category columns', () => {
        const rows = Array.from({ length: 4 }, (_, i) => `| ${i % 2 === 0 ? 'A' : 'B'} | val${i} |`).join('\n');
        const tokens = tokenize(`| Cat | Val |\n| --- | --- |\n${rows}`);
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-table-filter-btn');
      });

      it('does not show filter button for non-category columns', () => {
        const md = '| Name | Description |\n| --- | --- |\n| Alice | A long description text here |\n| Bob | Another long description text here |';
        const tokens = tokenize(md);
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('mdn-table-filter-btn');
      });

      it('shows collapse button for tables with > 15 rows', () => {
        const headerRows = '| A | B |\n| --- | --- |';
        const dataRows = Array.from({ length: 16 }, (_, i) => `| ${i} | ${i + 1} |`).join('\n');
        const tokens = tokenize(`${headerRows}\n${dataRows}`);
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-table-toggle-btn');
      });

      it('does not show collapse button for small tables', () => {
        const tokens = tokenize('| A |\n| --- |\n| x |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('mdn-table-toggle-btn');
      });

      it('renders chart container', () => {
        const tokens = tokenize('| A | B |\n| --- | --- |\n| 1 | 2 |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-table-chart-container');
      });

      it('renders wrap toggle button', () => {
        const tokens = tokenize('| A |\n| --- |\n| x |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-table-wrap-toggle');
      });
    });

    describe('lists', () => {
      it('renders unordered list', () => {
        const tokens = tokenize('- one\n- two');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('<ul');
        expect(html).toContain('mdn-list');
      });

      it('renders ordered list', () => {
        const tokens = tokenize('1. one\n2. two');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('<ol');
      });

      it('renders start attribute for ordered list starting > 1', () => {
        const tokens: BlockToken[] = [{ type: 'list', ordered: true, start: 5, items: [{ text: 'fifth', isTask: false, checked: false }] }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('start="5"');
      });

      it('does not render start attribute for start=1', () => {
        const tokens: BlockToken[] = [{ type: 'list', ordered: true, start: 1, items: [{ text: 'first', isTask: false, checked: false }] }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toMatch(/\sstart="/);
      });

      it('renders task list with checked item', () => {
        const tokens = tokenize('- [x] done');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('is-checked');
        expect(html).toContain('mdn-checkbox');
      });

      it('renders task list with unchecked item', () => {
        const tokens = tokenize('- [ ] pending');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-task');
        expect(html).not.toContain('is-checked');
      });

      it('renders nested markdown in list items', () => {
        const tokens: BlockToken[] = [{
          type: 'list',
          ordered: false,
          items: [{ text: 'item', isTask: false, checked: false, nestedMarkdown: '- nested one\n- nested two' }],
        }];
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('mdn-list-nested');
      });
    });

    describe('isCategoryColumn heuristics', () => {
      it('returns true for low-cardinality columns', () => {
        const tokens = tokenize('| Type | Value |\n| --- | --- |\n| A | x |\n| B | y |\n| A | z |\n| B | w |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).toContain('has-filter');
      });

      it('returns false for high-cardinality columns', () => {
        const md = '| Name | Value |\n| --- | --- |\n' + Array.from({ length: 4 }, (_, i) => `| unique_name_${i} | val |`).join('\n');
        const tokens = tokenize(md);
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('has-filter');
      });

      it('returns false for columns with < 3 rows', () => {
        const tokens = tokenize('| A | B |\n| --- | --- |\n| x | y |');
        const renderer = new HtmlRenderer();
        const { html } = renderer.render(tokens);
        expect(html).not.toContain('has-filter');
      });
    });
  });
    it('renders image-only paragraphs as equal-width image rows', () => {
      const renderer = new HtmlRenderer();
      const { html } = renderer.render(tokenize('![First](first.png) ![Second](second.png)'));
      expect(html).toContain('class="mdn-image-row"');
      expect(html).toContain('--mdn-image-count:2');
      expect(html.match(/mdn-image-row__item/g)).toHaveLength(2);
    });

    it('renders linked images in the same image row', () => {
      const renderer = new HtmlRenderer();
      const { html } = renderer.render(tokenize('[![First](first.png)](https://example.com) ![Second](second.png)'));
      expect(html).toContain('class="mdn-image-row"');
      expect(html).toContain('<a href="https://example.com"');
    });

    it('keeps mixed prose and images in normal paragraph flow', () => {
      const renderer = new HtmlRenderer();
      const { html } = renderer.render(tokenize('Before ![First](first.png) after'));
      expect(html).not.toContain('mdn-image-row');
      expect(stripBookmarkMetadata(html)).toMatch(/^<p>/);
    });

    it('renders separate image rows when blank lines split paragraphs', () => {
      const renderer = new HtmlRenderer();
      const { html } = renderer.render(tokenize('![A](a.png) ![B](b.png)\n\n![C](c.png) ![D](d.png)'));
      expect(html.match(/class="mdn-image-row"/g)).toHaveLength(2);
    });

    it('places square H-level badges after heading text for H1 through H6', () => {
      const renderer = new HtmlRenderer();
      const { html } = renderer.render(tokenize('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six'));
      for (let level = 1; level <= 6; level += 1) {
        expect(html).toContain(`class="mdn-heading-level" aria-hidden="true">H${level}</span>`);
      }
      expect(html).not.toContain('mdn-subheading-level');
      expect(html).not.toContain('mdn-section-heading-level');
    });

});
