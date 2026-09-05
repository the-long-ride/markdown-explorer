import { describe, expect, it } from 'vitest';
import {
  captureBookmarkObjectFromSource,
  captureDomBookmarkTarget,
  locateBookmarkObjectSource,
  mapRenderedOffsetsToSource,
  projectMarkdownSource,
} from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

describe('bookmarkDomAnchors', () => {
  describe('projectMarkdownSource', () => {
    it('projects plain text with identity boundaries', () => {
      const projection = projectMarkdownSource('plain text');
      expect(projection.text).toBe('plain text');
      expect(projection.boundaries).toHaveLength('plain text'.length + 1);
    });

    it('projects fenced code blocks stripping fences', () => {
      const source = '```typescript\nconst x = 1;\n```';
      const projection = projectMarkdownSource(source);
      expect(projection.text).toBe('const x = 1;');
    });

    it('strips list markers, headings, and blockquotes from projected text', () => {
      const source = '# Heading 1\n> Quote text\n- List item\n1. Numbered item';
      const projection = projectMarkdownSource(source);
      expect(projection.text).toContain('Heading 1');
      expect(projection.text).toContain('Quote text');
      expect(projection.text).toContain('List item');
      expect(projection.text).toContain('Numbered item');
      expect(projection.text).not.toContain('# ');
      expect(projection.text).not.toContain('> ');
    });

    it('projects inline links and images extracting visible labels', () => {
      const source = 'Check [our guide](https://example.com) and ![logo](logo.png)';
      const projection = projectMarkdownSource(source);
      expect(projection.text).toBe('Check our guide and logo');
    });

    it('projects inline code and math expressions', () => {
      const source = 'Run `npm test` or compute $E = mc^2$ and \\(x + y\\)';
      const projection = projectMarkdownSource(source);
      expect(projection.text).toBe('Run npm test or compute E = mc^2 and x + y');
    });

    it('strips html tags and handles escaped characters', () => {
      const source = 'Bold <b>HTML</b> and \\*escaped\\* text';
      const projection = projectMarkdownSource(source);
      expect(projection.text).toBe('Bold HTML and *escaped* text');
    });
  });

  describe('mapRenderedOffsetsToSource', () => {
    it('maps rendered text offsets back to source offsets and expands formatting', () => {
      const source = 'Normal **bold word** text';
      // In rendered projection: "Normal bold word text"
      // "bold word" is from index 7 to 16
      const range = mapRenderedOffsetsToSource(source, 7, 16);
      expect(range.start).toBe(7); // starts at "**"
      expect(range.end).toBe(20);   // ends after closing "**"
      expect(source.slice(range.start, range.end)).toBe('**bold word**');
    });

    it('expands math dollar markers and backticks', () => {
      const source = 'Compute `const a = 1;` today';
      const range = mapRenderedOffsetsToSource(source, 8, 20);
      expect(source.slice(range.start, range.end)).toBe('`const a = 1;`');
    });
  });

  describe('locateBookmarkObjectSource and captureBookmarkObjectFromSource', () => {
    it('locates mermaid code blocks', () => {
      const source = '# Architecture\n\n```mermaid\ngraph TD;\n  A-->B;\n```\n';
      const located = locateBookmarkObjectSource('mermaid', source, { mermaidSource: 'graph TD;\n  A-->B;' });
      expect(located).not.toBeNull();
      expect(located?.start).toBe(16);
      expect(source.slice(located!.start, located!.end)).toContain('```mermaid');

      const captured = captureBookmarkObjectFromSource('mermaid', source, { mermaidSource: 'graph TD;\n  A-->B;' });
      expect(captured?.targetKind).toBe('mermaid');
      expect(captured?.sourceStart).toBe(16);
    });

    it('locates markdown and html images', () => {
      const source = 'Here is an image: ![Diagram](img/chart.png) and <img src="pic.jpg" alt="Photo">';
      const mdImg = locateBookmarkObjectSource('image', source, { alt: 'Diagram', url: 'img/chart.png' });
      expect(mdImg).not.toBeNull();
      expect(source.slice(mdImg!.start, mdImg!.end)).toBe('![Diagram](img/chart.png)');

      const htmlImg = locateBookmarkObjectSource('image', source, { alt: 'Photo', url: 'pic.jpg' });
      expect(htmlImg).not.toBeNull();
      expect(source.slice(htmlImg!.start, htmlImg!.end)).toBe('<img src="pic.jpg" alt="Photo">');
    });

    it('locates markdown and html links as well as bare URLs', () => {
      const source = 'Visit [Docs](https://docs.org) or <a href="https://api.org">API</a> or https://raw.org';
      const mdLink = locateBookmarkObjectSource('link', source, { label: 'Docs', url: 'https://docs.org' });
      expect(mdLink).not.toBeNull();
      expect(source.slice(mdLink!.start, mdLink!.end)).toBe('[Docs](https://docs.org)');

      const htmlLink = locateBookmarkObjectSource('link', source, { label: 'API', url: 'https://api.org' });
      expect(htmlLink).not.toBeNull();
      expect(source.slice(htmlLink!.start, htmlLink!.end)).toBe('<a href="https://api.org">API</a>');

      const bareUrl = locateBookmarkObjectSource('link', source, { url: 'https://raw.org' });
      expect(bareUrl).not.toBeNull();
      expect(source.slice(bareUrl!.start, bareUrl!.end)).toBe('https://raw.org');
    });

    it('locates inline and display math', () => {
      const source = 'Inline $x^2$ and display:\n$$\ny = mx + b\n$$';
      const inlineMath = locateBookmarkObjectSource('math', source, { mathSource: 'x^2' });
      expect(inlineMath).not.toBeNull();
      expect(source.slice(inlineMath!.start, inlineMath!.end)).toBe('$x^2$');

      const displayMath = locateBookmarkObjectSource('math', source, { mathSource: 'y = mx + b' });
      expect(displayMath).not.toBeNull();
      expect(source.slice(displayMath!.start, displayMath!.end)).toContain('$$');
    });

    it('returns null for non-matching object queries', () => {
      const source = 'Some text without target objects.';
      expect(locateBookmarkObjectSource('mermaid', source)).toBeNull();
      expect(captureBookmarkObjectFromSource('image', source)).toBeNull();
    });
  });

  describe('captureDomBookmarkTarget', () => {
    it('captures DOM Range selection inside source-mapped container', () => {
      const body = document.createElement('div');
      const root = document.createElement('p');
      root.setAttribute('data-mdn-source-start', '10');
      root.setAttribute('data-mdn-source-end', '40');
      root.textContent = 'Hello wonderful world of testing';
      body.appendChild(root);

      const range = document.createRange();
      const textNode = root.firstChild!;
      range.setStart(textNode, 6);
      range.setEnd(textNode, 15);

      const source = '0123456789Hello wonderful world of testing12345';
      const captured = captureDomBookmarkTarget(body, range, source);
      expect(captured).not.toBeNull();
      expect(captured?.targetKind).toBe('text');
      expect(captured?.renderedText).toBe('wonderful');
      expect(captured?.sourceStart).toBe(16);
      expect(captured?.sourceEnd).toBe(25);
    });

    it('returns null for collapsed Range or nodes without sourceRoot', () => {
      const body = document.createElement('div');
      const range = document.createRange();
      expect(captureDomBookmarkTarget(body, range, 'source')).toBeNull();
    });

    it('captures object element with data-mdn-bookmark-kind', () => {
      const body = document.createElement('div');
      const img = document.createElement('span');
      img.setAttribute('data-mdn-bookmark-kind', 'image');
      img.setAttribute('data-mdn-source-start', '5');
      img.setAttribute('data-mdn-source-end', '27');
      img.setAttribute('data-mdn-bookmark-alt', 'Sample Alt');
      img.setAttribute('data-mdn-bookmark-url', 'img.png');
      body.appendChild(img);

      const source = '01234![Sample Alt](img.png)56789';
      const captured = captureDomBookmarkTarget(body, img, source);
      expect(captured).not.toBeNull();
      expect(captured?.targetKind).toBe('image');
      expect(captured?.sourceStart).toBe(5);
      expect(captured?.sourceEnd).toBe(27);
      expect(captured?.renderedText).toBe('![Sample Alt](img.png)');
    });

    it('returns null when target element is not contained within body', () => {
      const body = document.createElement('div');
      const orphan = document.createElement('div');
      orphan.setAttribute('data-mdn-bookmark-kind', 'code');
      expect(captureDomBookmarkTarget(body, orphan, 'source')).toBeNull();
    });
  });
});
