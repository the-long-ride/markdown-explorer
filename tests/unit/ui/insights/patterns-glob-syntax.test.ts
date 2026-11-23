import { describe, expect, it } from 'vitest';
import { createInsightsPathMatcher } from '../../../../ui/src/insights/patterns';

describe('insights pattern glob syntax', () => {
  it('supports escapes, single-char wildcards, classes and globstars', () => {
    const matcher = createInsightsPathMatcher({
      builtInPatterns: [],
      userPatterns: ['\\#notes.md', 'a?c.md', 'log[0-9].md', 'tmp[!x].md', '**/drafts/**', 'build/', 'src/**/gen.md', '', '!', '!keep/**'],
    });
    expect(matcher.test('abc.md')).toBe(false);
    expect(matcher.test('a/c.md')).toBe(true);
    expect(matcher.test('log5.md')).toBe(false);
    expect(matcher.test('tmpa.md')).toBe(false);
    expect(matcher.test('tmpx.md')).toBe(true);
    expect(matcher.test('x/drafts/y.md')).toBe(false);
    expect(matcher.test('build/out.md')).toBe(false);
    expect(matcher.test('src/gen.md')).toBe(false);
    expect(matcher.test('src/a/b/gen.md')).toBe(false);
    expect(matcher.explain('.git/config')).toMatchObject({ included: false, source: 'hard' });
    expect(matcher.explain('keep/a.md').included).toBe(true);
  });

  it('rejects invalid bracket patterns', () => {
    expect(() => createInsightsPathMatcher({ userPatterns: ['a]'] })).toThrow('Invalid Insights pattern');
    expect(() => createInsightsPathMatcher({ userPatterns: ['a[]'] })).toThrow('Invalid Insights pattern');
    expect(() => createInsightsPathMatcher({ userPatterns: ['a[!]'] })).toThrow('Invalid Insights pattern');
    expect(() => createInsightsPathMatcher({ userPatterns: ['a[\\]]b'] })).not.toThrow();
  });
});
