import { describe, expect, it } from 'vitest';
import {
  captureBookmarkObjectFromSource,
  captureDomBookmarkTarget,
  locateBookmarkObjectSource,
  mapRenderedOffsetsToSource,
} from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

function body(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

describe('bookmarkDomAnchors object capture', () => {
  it('expands rendered selections over emphasis and inline math delimiters', () => {
    const bold = '**strong** text';
    expect(mapRenderedOffsetsToSource(bold, 0, 6)).toEqual({ start: 0, end: 10 });
    const math = 'see \\(x+1\\) now';
    const range = mapRenderedOffsetsToSource(math, 4, 7);
    expect(math.slice(range.start, range.end)).toContain('x+1');
    expect(mapRenderedOffsetsToSource('abc', 50, 99).end).toBe(3);
  });

  it('locates code, math, link and image objects by identity and occurrence', () => {
    const source = 'Use `one` and ``two`` here. $a+b$ and \\(c\\).\n\n$$\nx^2\n$$\n\n[Site](https://x.test) ![Alt](img.png) <img alt="html" src="h.png"> <a href="https://y.test">Y</a>';
    expect(source.slice(...span(locateBookmarkObjectSource('code', source, {}, 1)))).toBe('``two``');
    expect(locateBookmarkObjectSource('code', source, {}, 9)).toBeNull();
    expect(locateBookmarkObjectSource('math', source, { mathSource: 'c' })).not.toBeNull();
    expect(locateBookmarkObjectSource('math', source, { mathSource: 'x^2' })).not.toBeNull();
    expect(locateBookmarkObjectSource('link', source, { url: 'https://y.test' })).not.toBeNull();
    expect(locateBookmarkObjectSource('image', source, { alt: 'html' })).not.toBeNull();
    const code = captureBookmarkObjectFromSource('code', source, {}, 0, '');
    expect(code).toMatchObject({ targetKind: 'code' });
    expect(captureBookmarkObjectFromSource('code', 'no code', {}, 0)).toBeNull();
  });

  it('captures objects from their source root when direct offsets are missing', () => {
    const source = 'Intro\n\nUse `alpha` then `beta`.\n';
    const start = source.indexOf('Use');
    const root = body(`<p data-mdn-source-start="${start}" data-mdn-source-end="${source.length - 1}">Use <code data-mdn-bookmark-kind="code">alpha</code> then <code data-mdn-bookmark-kind="code">beta</code>.</p>`);
    const second = root.querySelectorAll('code')[1];
    const captured = captureDomBookmarkTarget(root, second, source);
    expect(captured && source.slice(captured.sourceStart, captured.sourceEnd)).toBe('`beta`');
  });

  it('falls back to the whole document and rejects unsupported targets', () => {
    const source = 'A [Docs](https://docs.test) link and [Docs](https://other.test).';
    const root = body('<p>A <a data-mdn-bookmark-kind="link" data-mdn-bookmark-url="https%3A%2F%2Fother.test" data-mdn-bookmark-label="%E0%A4%A">Docs</a></p>');
    const captured = captureDomBookmarkTarget(root, root.querySelector('a')!, source);
    expect(captured && source.slice(captured.sourceStart, captured.sourceEnd)).toContain('other.test');
    const bad = body('<p data-mdn-source-start="0" data-mdn-source-end="9999"><span data-mdn-bookmark-kind="table">t</span><em>x</em></p>');
    expect(captureDomBookmarkTarget(bad, bad.querySelector('span')!, source)).toBeNull();
    expect(captureDomBookmarkTarget(bad, bad.querySelector('em')!, source)).toBeNull();
    const outside = document.createElement('code');
    outside.dataset.mdnBookmarkKind = 'code';
    expect(captureDomBookmarkTarget(bad, outside, source)).toBeNull();
  });

  it('returns null for text ranges outside source roots', () => {
    const root = body('<p>loose text</p>');
    const range = document.createRange();
    range.selectNodeContents(root.querySelector('p')!);
    expect(captureDomBookmarkTarget(root, range, 'loose text')).toBeNull();
    const rooted = body('<p data-mdn-source-start="x" data-mdn-source-end="4">abcd</p>');
    const r2 = document.createRange();
    r2.selectNodeContents(rooted.querySelector('p')!);
    expect(captureDomBookmarkTarget(rooted, r2, 'abcd')).toBeNull();
  });
});

function span(located: { start: number; end: number } | null): [number, number] {
  if (!located) throw new Error('not located');
  return [located.start, located.end];
}
