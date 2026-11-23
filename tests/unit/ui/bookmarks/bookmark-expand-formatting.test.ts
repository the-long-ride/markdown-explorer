import { describe, expect, it } from 'vitest';
import { mapRenderedOffsetsToSource } from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

const slice = (source: string, start: number, end: number) => {
  const range = mapRenderedOffsetsToSource(source, start, end);
  return source.slice(range.start, range.end);
};

describe('mapRenderedOffsetsToSource formatting expansion', () => {
  it('widens a fully selected emphasised word to include its markers', () => {
    expect(slice('a **b** c', 2, 3)).toBe('**b**');
    expect(slice('a ***b*** c', 2, 3)).toBe('***b***');
    expect(slice('x ~~gone~~ y', 2, 6)).toBe('~~gone~~');
  });

  it('widens inline math delimiters and clamps out-of-range offsets', () => {
    expect(slice('see \\(x+1\\) now', 4, 7)).toContain('x+1');
    const range = mapRenderedOffsetsToSource('plain', -5, 99);
    expect(range).toEqual({ start: 0, end: 5 });
  });
});
