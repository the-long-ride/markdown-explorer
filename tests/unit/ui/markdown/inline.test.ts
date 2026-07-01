import { describe, it, expect } from 'vitest';
import { renderInline } from '../../../../ui/src/markdown/inline';

describe('markdown/inline', () => {
  it('returns empty string for empty input', () => {
    expect(renderInline('')).toBe('');
  });

  describe('inline code', () => {
    it('wraps backtick code in <code>', () => {
      const result = renderInline('Use `x` here');
      expect(result).toContain('<code class="mdn-inline-code">x</code>');
    });

    it('escapes HTML in inline code', () => {
      const result = renderInline('`<div>`');
      expect(result).toContain('<div>');
    });

    it('normalizes whitespace around newlines in inline code', () => {
      const result = renderInline('`line1\n  line2`');
      expect(result).toContain('line1line2');
    });
  });

  describe('math', () => {
    it('renders \\( \\) inline math', () => {
      const result = renderInline('E = \\(mc^2\\) energy');
      expect(result).toContain('mdn-math-inline');
      expect(result).toContain('data-math');
    });

    it('renders $...$ inline math', () => {
      const result = renderInline('Use $x + y$ here');
      expect(result).toContain('mdn-math-inline');
    });

    it('does not treat standalone $ as math', () => {
      const result = renderInline('$5 each');
      expect(result).not.toContain('mdn-math-inline');
    });

    it('encodes math content in data-math attribute', () => {
      const result = renderInline('$a + b$');
      expect(result).toContain('data-math=');
      expect(result).toContain('a%20%2B%20b');
    });
  });

  describe('bold and italic', () => {
    it('renders ***bold+italic***', () => {
      const result = renderInline('***bold italic***');
      expect(result).toContain('<strong><em>bold italic</em></strong>');
    });

    it('renders **bold**', () => {
      const result = renderInline('**bold text**');
      expect(result).toContain('<strong>bold text</strong>');
    });

    it('renders __bold__', () => {
      const result = renderInline('__bold text__');
      expect(result).toContain('<strong>bold text</strong>');
    });

    it('renders *italic*', () => {
      const result = renderInline('*italic text*');
      expect(result).toContain('<em>italic text</em>');
    });

    it('renders _italic_', () => {
      const result = renderInline('_italic text_');
      expect(result).toContain('<em>italic text</em>');
    });

    it('renders ~~strikethrough~~', () => {
      const result = renderInline('~~deleted~~');
      expect(result).toContain('<del>deleted</del>');
    });
  });

  describe('images', () => {
    it('renders ![alt](src) as img', () => {
      const result = renderInline('![photo](image.png)');
      expect(result).toContain('<img');
      expect(result).toContain('alt="photo"');
      expect(result).toContain('src="image.png"');
    });

    it('renders video image as figure', () => {
      const result = renderInline('![alt](video.mp4)');
      expect(result).toContain('mdn-video-wrap');
      expect(result).toContain('<video');
    });

    it('renders YouTube image as embed', () => {
      const result = renderInline('![alt](https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
      expect(result).toContain('mdn-video-wrap--embed');
      expect(result).toContain('iframe');
    });
  });

  describe('links', () => {
    it('renders external links', () => {
      const result = renderInline('[Google](https://google.com)');
      expect(result).toContain('<a');
      expect(result).toContain('href="https://google.com"');
      expect(result).toContain('target="_blank"');
    });

    it('renders internal .md links', () => {
      const result = renderInline('[Other](other.md)');
      expect(result).toContain('Nav.go');
      expect(result).toContain('mdn-link--internal');
    });

    it('renders internal .md#anchor links', () => {
      const result = renderInline('[Section](doc.md#section)');
      expect(result).toContain('Nav.go');
    });

    it('renders YouTube video links as embed', () => {
      const result = renderInline('[Watch](https://www.youtube.com/watch?v=abc123)');
      expect(result).toContain('mdn-video-wrap--embed');
    });

    it('renders video links as video player', () => {
      const result = renderInline('[Watch](clip.webm)');
      expect(result).toContain('mdn-video-wrap');
      expect(result).toContain('<video');
    });
  });

  describe('bare URLs', () => {
    it('renders bare URLs as links', () => {
      const result = renderInline('Visit https://example.com now');
      expect(result).toContain('<a href="https://example.com"');
    });

    it('renders YouTube bare URL as embed', () => {
      const result = renderInline('https://www.youtube.com/watch?v=abc123');
      expect(result).toContain('mdn-video-wrap--embed');
    });

    it('renders video bare URL as video player', () => {
      const result = renderInline('https://example.com/clip.mp4');
      expect(result).toContain('mdn-video-wrap');
    });
  });

  describe('YouTube URL handling', () => {
    it('handles youtu.be short URLs', () => {
      const result = renderInline('[Video](https://youtu.be/abc123)');
      expect(result).toContain('youtube.com/embed/abc123');
    });

    it('handles /watch?v= URLs', () => {
      const result = renderInline('[Video](https://www.youtube.com/watch?v=abc123)');
      expect(result).toContain('youtube.com/embed/abc123');
    });

    it('handles /embed/ URLs', () => {
      const result = renderInline('[Video](https://www.youtube.com/embed/abc123)');
      expect(result).toContain('youtube.com/embed/abc123');
    });

    it('handles /shorts/ URLs', () => {
      const result = renderInline('[Video](https://www.youtube.com/shorts/abc123)');
      expect(result).toContain('youtube.com/embed/abc123');
    });

    it('handles /live/ URLs', () => {
      const result = renderInline('[Live](https://www.youtube.com/live/abc123)');
      expect(result).toContain('youtube.com/embed/abc123');
    });

    it('captures playlist parameter in href', () => {
      const result = renderInline('[Video](https://www.youtube.com/watch?v=abc123&list=PLxyz)');
      expect(result).toContain('list=PLxyz');
    });

    it('captures start parameter in href', () => {
      const result = renderInline('[Video](https://www.youtube.com/watch?v=abc123&start=120)');
      expect(result).toContain('start=120');
    });

    it('rejects short video IDs', () => {
      const result = renderInline('[Video](https://www.youtube.com/watch?v=ab)');
      expect(result).not.toContain('youtube.com/embed');
    });

    it('adds playsinline and origin params', () => {
      const result = renderInline('[Video](https://www.youtube.com/watch?v=abc123)');
      expect(result).toContain('playsinline=1');
      expect(result).toContain('origin=');
    });
  });

  describe('video MIME types', () => {
    it('returns video/mp4 for .mp4', () => {
      const result = renderInline('![](file.mp4)');
      expect(result).toContain('type="video/mp4"');
    });

    it('returns video/webm for .webm', () => {
      const result = renderInline('![](file.webm)');
      expect(result).toContain('type="video/webm"');
    });

    it('returns video/ogg for .ogv', () => {
      const result = renderInline('![](file.ogv)');
      expect(result).toContain('type="video/ogg"');
    });

    it('returns application/vnd.apple.mpegurl for .m3u8', () => {
      const result = renderInline('![](stream.m3u8)');
      expect(result).toContain('type="application/vnd.apple.mpegurl"');
    });

    it('defaults to video/mp4 for .mkv', () => {
      const result = renderInline('![](file.mkv)');
      expect(result).toContain('type="video/mp4"');
    });
  });

  describe('safe HTML passthrough', () => {
    it('passes through <kbd> tags', () => {
      const result = renderInline('<kbd>Ctrl</kbd>');
      expect(result).toContain('<kbd>Ctrl</kbd>');
    });

    it('passes through <mark> tags', () => {
      const result = renderInline('<mark>highlighted</mark>');
      expect(result).toContain('<mark>highlighted</mark>');
    });

    it('passes through <sub> and <sup>', () => {
      expect(renderInline('H<sub>2</sub>O')).toContain('<sub>2</sub>');
      expect(renderInline('x<sup>2</sup>')).toContain('<sup>2</sup>');
    });

    it('passes through <br> tags', () => {
      const result = renderInline('line1<br/>line2');
      expect(result).toContain('<br/>');
    });

    it('passes through <details> and <summary>', () => {
      const result = renderInline('<details><summary>Click</summary>Content</details>');
      expect(result).toContain('<details>');
    });

    it('passes through <figure> and <figcaption>', () => {
      const result = renderInline('<figure><figcaption>Caption</figcaption></figure>');
      expect(result).toContain('<figcaption>');
    });

    it('escapes non-safe HTML tags', () => {
      const result = renderInline('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
    });
  });

  describe('MDX mode', () => {
    it('converts PascalCase tags to kebab-case', () => {
      const result = renderInline('<MyComponent>hi</MyComponent>', true);
      expect(result).toContain('<my-component>');
      expect(result).toContain('</my-component>');
    });

    it('converts self-closing JSX to explicit closing', () => {
      const result = renderInline('<MyComp />', true);
      expect(result).toContain('</my-comp>');
    });

    it('converts curly brace attributes to string attributes', () => {
      const result = renderInline('<Comp color={"red"} />', true);
      expect(result).toContain('color="red"');
    });

    it('converts event handler attributes to onclick (simple)', () => {
      const result = renderInline('<Comp onClick={handler} />', true);
      expect(result).toContain('onclick=');
    });

    it('converts non-arrow event handlers', () => {
      const result = renderInline('<Comp onClick={handler} />', true);
      expect(result).toContain('onclick="handler(event)"');
    });
  });

  describe('combined inline syntax', () => {
    it('handles bold with inline code', () => {
      const result = renderInline('**Use `npm install`**');
      expect(result).toContain('<strong>');
      expect(result).toContain('<code');
    });

    it('handles link with bold label', () => {
      const result = renderInline('[**Google**](https://google.com)');
      expect(result).toContain('<a');
    });
  });
});
