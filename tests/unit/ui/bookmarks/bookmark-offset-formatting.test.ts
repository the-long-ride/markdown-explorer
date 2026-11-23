import { describe, expect, it } from 'vitest';
import { mapRenderedOffsetsToSource, projectMarkdownSource } from '../../../../ui/src/bookmarks/bookmarkDomAnchors';

function select(source: string, word: string) {
  const text = projectMarkdownSource(source).text;
  const start = text.indexOf(word);
  return mapRenderedOffsetsToSource(source, start, start + word.length);
}

describe('mapRenderedOffsetsToSource formatting expansion', () => {
  it('expands nested emphasis, code and inline math markers', () => {
    const bold = 'a ***b*** c';
    const r = select(bold, 'b');
    expect(bold.slice(r.start, r.end)).toBe('***b***');
    const code = 'x `y` z';
    const c = select(code, 'y');
    expect(code.slice(c.start, c.end)).toBe('`y`');
    const math = 'p \\(q\\) r';
    const m = mapRenderedOffsetsToSource(math, math.indexOf('q'), math.indexOf('q') + 1);
    expect(m.end).toBeGreaterThan(m.start);
  });

  it('clamps out-of-range rendered offsets', () => {
    const src = 'hello';
    expect(mapRenderedOffsetsToSource(src, -5, 999)).toEqual({ start: 0, end: 5 });
    expect(mapRenderedOffsetsToSource(src, 3, 1).start).toBe(mapRenderedOffsetsToSource(src, 3, 1).end);
  });
});
