import { describe, expect, it } from 'vitest';
import { locateBookmarkObjectSource, mapRenderedOffsetsToSource } from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

const source = [
  '![Alt](a.png) <img alt="html" src="b.png"> <img src="c.png">',
  '[Link](https://x.dev) <a href="https://y.dev"><b>Y</b></a> <a href="https://z.dev"></a>',
  'Inline \\(a+b\\) and $c$ then',
  '$$',
  'x^2',
  '$$',
  '\\[',
  'y',
  '\\]',
  '`code` and ``more``',
  '```mermaid',
  'graph TD',
  '```',
].join('\n');

describe('locateBookmarkObjectSource kinds', () => {
  it('locates images, links, math, code and mermaid with identities', () => {
    expect(locateBookmarkObjectSource('image', source, { alt: 'Alt', url: 'a.png' })).not.toBeNull();
    expect(locateBookmarkObjectSource('image', source, { url: 'b.png' }, 0)).not.toBeNull();
    expect(locateBookmarkObjectSource('image', source, {}, 2)).not.toBeNull();
    expect(locateBookmarkObjectSource('link', source, { url: 'https://y.dev' })).not.toBeNull();
    expect(locateBookmarkObjectSource('link', source, {}, 2)).not.toBeNull();
    expect(locateBookmarkObjectSource('math', source, { mathSource: 'a+b' })).not.toBeNull();
    expect(locateBookmarkObjectSource('math', source, { mathSource: 'x^2' })).not.toBeNull();
    expect(locateBookmarkObjectSource('math', source, {}, 3)).not.toBeNull();
    expect(locateBookmarkObjectSource('code', source, {}, 1)).not.toBeNull();
    expect(locateBookmarkObjectSource('mermaid', source, { mermaidSource: 'graph TD' })).not.toBeNull();
    expect(locateBookmarkObjectSource('mermaid', source, { mermaidSource: 'nope' })).toBeNull();
    expect(locateBookmarkObjectSource('text' as any, source)).toBeNull();
  });

  it('expands rendered offsets over emphasis and math delimiters', () => {
    const md = 'a **bold** and \\(m\\) end';
    const bold = mapRenderedOffsetsToSource(md, 2, 6);
    expect(md.slice(bold.start, bold.end)).toContain('bold');
    const range = mapRenderedOffsetsToSource(md, 0, 999);
    expect(range.end).toBeLessThanOrEqual(md.length);
  });
});
