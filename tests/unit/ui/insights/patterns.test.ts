import { describe, expect, it } from 'vitest';
import { createInsightsPathMatcher } from '../../../../ui/src/insights/patterns';

describe('createInsightsPathMatcher', () => {
  it('never lets user patterns override hard safety exclusions', () => {
    const matcher = createInsightsPathMatcher({
      gitignore: [],
      userPatterns: ['!.git/**'],
    });
    const result = matcher.explain('.git/config');
    expect(result.included).toBe(false);
    expect(result.source).toBe('hard');
  });

  it('allows user re-includes to override gitignore and built-in defaults', () => {
    const matcher = createInsightsPathMatcher({
      gitignore: ['docs/generated/**'],
      userPatterns: ['!docs/generated/keep.md'],
    });
    expect(matcher.test('docs/generated/drop.md')).toBe(false);
    expect(matcher.test('docs/generated/keep.md')).toBe(true);
    expect(matcher.test('node_modules/pkg/readme.md')).toBe(false);
    expect(createInsightsPathMatcher({ userPatterns: ['!node_modules/pkg/readme.md'] }).test('node_modules/pkg/readme.md')).toBe(true);
  });

  it('applies user rules in last-match-wins order', () => {
    const matcher = createInsightsPathMatcher({ userPatterns: ['docs/**', '!docs/a.md', 'docs/a.md'] });
    expect(matcher.test('docs/a.md')).toBe(false);
  });

  it('rejects invalid patterns instead of silently ignoring them', () => {
    expect(() => createInsightsPathMatcher({ userPatterns: ['[broken'] })).toThrow(/pattern/i);
  });
});
