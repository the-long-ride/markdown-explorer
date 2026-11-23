import { describe, expect, it } from 'vitest';
import { locateBookmarkObjectSource } from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

describe('locateBookmarkObjectSource image and math kinds', () => {
  it('filters images by alt and url and falls back to bare urls', () => {
    const source = '![](https://a.dev/x.png) ![logo](b.png) see https://c.dev/y.png';
    expect(locateBookmarkObjectSource('image', source, { url: 'https://a.dev/x.png' })).not.toBeNull();
    expect(locateBookmarkObjectSource('image', source, { alt: 'logo', url: 'b.png' })).not.toBeNull();
    expect(locateBookmarkObjectSource('image', source, { alt: 'nope' })).toBeNull();
  });

  it('matches inline and display math by source', () => {
    const source = 'a \\(x+1\\) b $y$ c\n$$\nz\n$$\n\\[\nw\n\\]';
    for (const mathSource of ['x+1', 'y', 'z', 'w']) {
      expect(locateBookmarkObjectSource('math', source, { mathSource } as any)).not.toBeNull();
    }
    expect(locateBookmarkObjectSource('math', source, { mathSource: 'q' } as any)).toBeNull();
    expect(locateBookmarkObjectSource('math', source, {}, 99)).toBeNull();
  });
});
