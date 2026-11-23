import { describe, expect, it } from 'vitest';
import { buildTextStream, findMatchesInStream, findMatchesWithCandidates } from '../../../../ui/src/utils/searchJumpDom';

function container(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

describe('searchJumpDom collapsed whitespace fallback', () => {
  it('matches needles whose whitespace differs from the rendered text', () => {
    const el = container('<p>foo bar baz</p><p>foo bar again</p>');
    const stream = buildTextStream(el, false);
    expect(findMatchesInStream(stream, '', false)).toEqual([]);
    expect(findMatchesInStream(stream, '   ', false)).toEqual([]);
    const matches = findMatchesInStream(stream, 'foo   bar', false);
    expect(matches.length).toBe(2);
    expect(matches[0].matchLength).toBeGreaterThan(0);
    expect(findMatchesInStream(stream, 'FOO   BAR', true)).toEqual([]);
    expect(findMatchesWithCandidates(el, ['nope', 'bar\n  baz'], false, false)?.candidate).toBe('bar\n  baz');
    el.remove();
  });
});
