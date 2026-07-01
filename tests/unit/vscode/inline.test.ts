import { describe, expect, test } from 'vitest';
import { renderInline } from '../../../vscode/src/markdown/inline';

describe('renderInline', () => {
  test('returns empty string for empty input', () => {
    expect(renderInline('')).toBe('');
  });

  test('handles null/undefined text', () => {
    expect(renderInline(null as any)).toBe('');
    expect(renderInline(undefined as any)).toBe('');
  });

  describe('basic inline syntax', () => {
    test('renders bold with double asterisks', () => {
      expect(renderInline('**bold**')).toBe('<strong>bold</strong>');
    });

    test('renders bold with double underscores', () => {
      expect(renderInline('__bold__')).toBe('<strong>bold</strong>');
    });

    test('renders italic with single asterisks', () => {
      expect(renderInline('*italic*')).toBe('<em>italic</em>');
    });

    test('renders italic with single underscores', () => {
      expect(renderInline('_italic_')).toBe('<em>italic</em>');
    });

    test('renders bold+italic with triple asterisks', () => {
      expect(renderInline('***both***')).toBe('<strong><em>both</em></strong>');
    });

    test('renders strikethrough', () => {
      expect(renderInline('~~deleted~~')).toBe('<del>deleted</del>');
    });

    test('renders inline code', () => {
      const result = renderInline('`code`');
      expect(result).toContain('mdn-inline-code');
      expect(result).toContain('code');
    });

    test('renders inline math with \\(...\\)', () => {
      const result = renderInline('\\(x^2\\)');
      expect(result).toContain('mdn-math');
      expect(result).toContain('mdn-math-inline');
    });

    test('renders inline math with $...$', () => {
      const result = renderInline('$x = y$');
      expect(result).toContain('mdn-math');
    });

    test('escaped dollar sign before inline math prevents math rendering', () => {
      const result = renderInline('\\$x$');
      expect(result).toContain('$x$');
    });
  });

  describe('links', () => {
    test('renders external link with target _blank', () => {
      const result = renderInline('[google](https://google.com)');
      expect(result).toContain('href="https://google.com"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('>google<');
    });

    test('renders internal .md link with Nav.go', () => {
      const result = renderInline('[doc](guide.md)');
      expect(result).toContain('onclick="Nav.go');
      expect(result).toContain('guide.md');
    });

    test('renders internal .md link with fragment', () => {
      const result = renderInline('[doc](guide.md#section)');
      expect(result).toContain('onclick="Nav.go');
    });

    test('renders bare URL as link', () => {
      const result = renderInline('visit https://example.com now');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('target="_blank"');
    });
  });

  describe('images', () => {
    test('renders image tag', () => {
      const result = renderInline('![alt text](image.png)');
      expect(result).toContain('<img');
      expect(result).toContain('alt="alt text"');
      expect(result).toContain('src="image.png"');
      expect(result).toContain('mdn-img');
    });

    test('renders image with video source as video embed', () => {
      const result = renderInline('![video](demo.mp4)');
      expect(result).toContain('mdn-video-wrap');
      expect(result).toContain('<video');
    });

    test('renders image with youtube URL as embed', () => {
      const result = renderInline('![](https://youtube.com/watch?v=dQw4w9WgXcQ)');
      expect(result).toContain('mdn-video-wrap--embed');
      expect(result).toContain('youtube.com/embed/');
    });
  });

  describe('video embeds', () => {
    test('renders video embed for mp4 source', () => {
      const result = renderInline('[link](sample.mp4)');
      expect(result).toContain('mdn-video-wrap');
      expect(result).toContain('video/mp4');
    });

    test('renders youtube embed from watch URL', () => {
      const result = renderInline('[link](https://www.youtube.com/watch?v=videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('renders youtube embed from youtu.be short link', () => {
      const result = renderInline('[link](https://youtu.be/videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('renders youtube embed from embed URL', () => {
      const result = renderInline('[link](https://www.youtube.com/embed/videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('renders youtube embed from shorts URL', () => {
      const result = renderInline('[link](https://www.youtube.com/shorts/videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('renders youtube embed from live URL', () => {
      const result = renderInline('[link](https://www.youtube.com/live/videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('renders youtube embed from nocookie domain', () => {
      const result = renderInline('[link](https://www.youtube-nocookie.com/watch?v=videoid123)');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('falls back to link for invalid youtube URL', () => {
      const result = renderInline('[link](https://youtube.com/playlist?v=bad)');
      expect(result).not.toContain('iframe');
      expect(result).toContain('href=');
    });
  });

  describe('safe HTML passthrough', () => {
    test('passes through safe tags like kbd', () => {
      const result = renderInline('Press <kbd>Ctrl</kbd>+<kbd>C</kbd>');
      expect(result).toContain('<kbd>');
    });

    test('passes through sub and sup', () => {
      const result = renderInline('H<sub>2</sub>O and E=mc<sup>2</sup>');
      expect(result).toContain('<sub>');
      expect(result).toContain('<sup>');
    });

    test('passes through mark, abbr, u, s tags', () => {
      const result = renderInline('<mark>highlighted</mark> <abbr title="HyperText">HTML</abbr> <u>underlined</u> <s>struck</s>');
      expect(result).toContain('<mark>');
      expect(result).toContain('<abbr');
      expect(result).toContain('<u>');
      expect(result).toContain('<s>');
    });

    test('passes through img tag with attributes', () => {
      const result = renderInline('<img src="test.png" alt="test" width="100" />');
      expect(result).toContain('<img');
      expect(result).toContain('src="test.png"');
    });

    test('passes through details/summary', () => {
      const result = renderInline('<details><summary>Click me</summary>hidden content</details>');
      expect(result).toContain('<details>');
      expect(result).toContain('<summary>');
    });

    test('passes through div, span, p, a, h1-h6', () => {
      const result = renderInline('<div><p><span>text</span></p></div>');
      expect(result).toContain('<div>');
      expect(result).toContain('<p>');
      expect(result).toContain('<span>');
    });

    test('passes through strong, em, code, pre', () => {
      const result = renderInline('<strong>bold</strong> <em>italic</em> <code>code</code>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('<code>');
    });

    test('passes through br and hr', () => {
      const result = renderInline('line<br>br<br/>hr<hr>');
      expect(result).toContain('<br>');
      expect(result).toContain('<hr>');
    });

    test('escapes unsafe tags like script', () => {
      const result = renderInline('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('MDX mode', () => {
    test('converts PascalCase component to kebab-case', () => {
      const result = renderInline('<MyComponent />', true);
      expect(result).toContain('my-component');
    });

    test('converts curly brace string attributes', () => {
      const result = renderInline('<Layout title={"Hello World"} />', true);
      expect(result).toContain('layout');
      expect(result).toContain('title="Hello World"');
    });

    test('converts curly brace single-quoted string attributes', () => {
      const result = renderInline("<Layout title={'Single Quote'} />", true);
      expect(result).toContain('title="Single Quote"');
    });

    test('passes through components in links as safe HTML', () => {
      const result = renderInline('Text [link](url) <UserBadge /> text', true);
      expect(result).toContain('user-badge');
    });

    test('converts non-arrow event handlers', () => {
      const result = renderInline('<Button onChange={handleChange} />', true);
      expect(result).toContain('button');
    });

    test('converts non-arrow event handlers', () => {
      const result = renderInline('<Button onChange={handler} />', true);
      expect(result).toContain('onchange="handler(event)"');
    });

    test('handles self-closing tags', () => {
      const result = renderInline('<InputField />', true);
      expect(result).toContain('</input-field>');
    });

    test('handles closing tags', () => {
      const result = renderInline('<Card><Header>Title</Header></Card>', true);
      expect(result).toContain('card');
      expect(result).toContain('header');
    });

    test('converts curly brace non-identifier event handler', () => {
      const result = renderInline('<Button onChange={myHandler} />', true);
      expect(result).toContain('onchange="myHandler(event)"');
    });

    test('converts curly brace non-string non-event attribute value', () => {
      const result = renderInline('<Counter step={42} />', true);
      expect(result).toContain('step="42"');
    });

    test('converts opening tag with uppercase to kebab-case in MDX', () => {
      const result = renderInline('<MyPanel className="x">content</MyPanel>', true);
      expect(result).toContain('<my-panel');
      expect(result).toContain('</my-panel>');
    });

    test('converts closing tag with uppercase to kebab-case in MDX', () => {
      const result = renderInline('</MyWidget>', true);
      expect(result).toContain('</my-widget>');
    });
  });

  describe('video mime types', () => {
    test('renders webm video with correct mime type', () => {
      const result = renderInline('![vid](clip.webm)');
      expect(result).toContain('video/webm');
      expect(result).toContain('mdn-video-wrap');
    });

    test('renders ogv video with correct mime type', () => {
      const result = renderInline('![vid](clip.ogv)');
      expect(result).toContain('video/ogg');
    });

    test('renders ogg video with correct mime type', () => {
      const result = renderInline('![vid](clip.ogg)');
      expect(result).toContain('video/ogg');
    });

    test('renders m3u8 stream with correct mime type', () => {
      const result = renderInline('![vid](stream.m3u8)');
      expect(result).toContain('application/vnd.apple.mpegurl');
    });

    test('renders mkv video with default video/mp4 mime type', () => {
      const result = renderInline('![vid](clip.mkv)');
      expect(result).toContain('video/mp4');
    });

    test('renders mov video with correct mime type', () => {
      const result = renderInline('![vid](clip.mov)');
      expect(result).toContain('video/mp4');
    });
  });

  describe('isVideoSource', () => {
    test('recognizes m4v extension', () => {
      const result = renderInline('![vid](clip.m4v)');
      expect(result).toContain('mdn-video-wrap');
    });

    test('recognizes webm with query string', () => {
      const result = renderInline('![vid](clip.webm?t=1)');
      expect(result).toContain('mdn-video-wrap');
    });

    test('recognizes mkv extension', () => {
      const result = renderInline('![vid](video.mkv)');
      expect(result).toContain('mdn-video-wrap');
    });

    test('recognizes m3u8 extension', () => {
      const result = renderInline('![vid](stream.m3u8)');
      expect(result).toContain('mdn-video-wrap');
    });

    test('recognizes ogv extension', () => {
      const result = renderInline('![vid](movie.ogv)');
      expect(result).toContain('mdn-video-wrap');
    });

    test('recognizes ogg extension', () => {
      const result = renderInline('![vid](movie.ogg)');
      expect(result).toContain('mdn-video-wrap');
    });
  });

  describe('getYouTubeEmbedSrc', () => {
    test('handles youtube.com /playlist path (non-matching path branch)', () => {
      const result = renderInline('[link](https://www.youtube.com/playlist?list=PLxxxx)');
      expect(result).not.toContain('iframe');
    });

    test('rejects short video ID less than 6 characters', () => {
      const result = renderInline('[link](https://youtu.be/abc)');
      expect(result).not.toContain('iframe');
    });

    test('includes playlist param in embed URL', () => {
      const result = renderInline('[vid](https://www.youtube.com/watch?v=videoid123&list=PLtest123)');
      expect(result).toContain('list=PLtest123');
      expect(result).toContain('youtube.com/embed/videoid123');
    });

    test('includes start param from start query', () => {
      const result = renderInline('[vid](https://www.youtube.com/watch?v=videoid123&start=45)');
      expect(result).toContain('start=45');
    });

    test('includes start param from youtu.be with start query', () => {
      const result = renderInline('[vid](https://youtu.be/videoid123?start=60)');
      expect(result).toContain('start=60');
    });

    test('includes t param in escaped URL for watch links', () => {
      const result = renderInline('[vid](https://www.youtube.com/watch?v=videoid123&t=120s)');
      expect(result).toContain('t=120s');
    });

    test('ignores start param with invalid format', () => {
      const result = renderInline('[vid](https://www.youtube.com/watch?v=videoid123&t=invalid)');
      expect(result).toContain('youtube.com/embed/videoid123');
      expect(result).not.toContain('start=invalid');
    });

    test('includes playlist param from youtu.be URL', () => {
      const result = renderInline('[vid](https://youtu.be/videoid123?list=PLabc456)');
      expect(result).toContain('list=PLabc456');
    });

    test('includes start param from youtu.be t query with s suffix', () => {
      const result = renderInline('[vid](https://youtu.be/videoid123?t=120s)');
      expect(result).toContain('start=120');
    });

    test('includes start param from youtu.be t query without s suffix', () => {
      const result = renderInline('[vid](https://youtu.be/videoid123?t=30s)');
      expect(result).toContain('start=30');
      expect(result).toContain('iframe');
    });
  });

  describe('renderVideo caption branches', () => {
    test('renders video without caption (empty alt)', () => {
      const result = renderInline('![](clip.mp4)');
      expect(result).toContain('aria-label="Video"');
      expect(result).not.toContain('mdn-video-caption');
    });

    test('renders video with caption', () => {
      const result = renderInline('![My Video](clip.mp4)');
      expect(result).toContain('mdn-video-caption');
      expect(result).toContain('My Video');
    });
  });

  describe('renderYouTubeEmbed caption branches', () => {
    test('renders YouTube embed with caption', () => {
      const result = renderInline('![Cool Video](https://www.youtube.com/watch?v=videoid123)');
      expect(result).toContain('mdn-video-caption');
      expect(result).toContain('Cool Video');
      expect(result).toContain('Watch on YouTube');
    });

    test('renders YouTube embed without caption (empty alt)', () => {
      const result = renderInline('![](https://www.youtube.com/watch?v=videoid123)');
      expect(result).toContain('mdn-video-caption');
      expect(result).toContain('Watch on YouTube');
      expect(result).not.toContain('\u00b7');
    });
  });

  describe('bare URL rendering', () => {
    test('renders bare YouTube URL as embed', () => {
      const result = renderInline('https://www.youtube.com/watch?v=videoid123');
      expect(result).toContain('youtube.com/embed/videoid123');
      expect(result).toContain('iframe');
    });

    test('renders bare video URL as video embed', () => {
      const result = renderInline('https://example.com/clip.mp4');
      expect(result).toContain('mdn-video-wrap');
      expect(result).toContain('<video');
    });

    test('renders bare webm URL as video embed', () => {
      const result = renderInline('https://example.com/clip.webm');
      expect(result).toContain('video/webm');
    });

    test('renders bare m3u8 URL as video embed', () => {
      const result = renderInline('https://example.com/stream.m3u8');
      expect(result).toContain('application/vnd.apple.mpegurl');
    });
  });

  describe('link with YouTube/video sources', () => {
    test('renders YouTube link with label as embed with caption', () => {
      const result = renderInline('[My Show](https://www.youtube.com/watch?v=videoid123)');
      expect(result).toContain('mdn-video-caption');
      expect(result).toContain('My Show');
    });

    test('renders video link with label as embed with caption', () => {
      const result = renderInline('[Demo](clip.mp4)');
      expect(result).toContain('mdn-video-caption');
      expect(result).toContain('Demo');
    });
  });

  describe('normalizeInlineCode', () => {
    test('normalizes newlines in inline code', () => {
      const result = renderInline('`hello\nworld`');
      expect(result).toContain('helloworld');
    });

    test('normalizes spaces and newlines in inline code', () => {
      const result = renderInline('`code \n with \n spaces`');
      expect(result).toContain('codewithspaces');
    });

    test('normalizes tabs and newlines in inline code', () => {
      const result = renderInline('`hello\t\nworld`');
      expect(result).toContain('helloworld');
    });
  });

  describe('default video mime type for unknown extension', () => {
    test('falls back to video/mp4 for unknown video extension', () => {
      const result = renderInline('![vid](clip.mkv)');
      expect(result).toContain('video/mp4');
    });
  });

  describe('bare YouTube URL with t start param', () => {
    test('renders bare youtu.be URL with start param', () => {
      const result = renderInline('https://youtu.be/videoid123?t=60s');
      expect(result).toContain('start=60');
      expect(result).toContain('iframe');
    });
  });

  describe('MDX onClick event handler', () => {
    test('converts onClick identifier to lowercase', () => {
      const result = renderInline('<Button onClick={doClick} />', true);
      expect(result).toContain('onclick="doClick(event)"');
    });
  });
});
