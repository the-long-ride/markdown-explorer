import { describe, it, expect } from 'vitest';
import { makeSearchExcerpt } from '../../../chromium-xtension/src/search-index';

describe('makeSearchExcerpt', () => {
  it('returns match text when short content', () => {
    const result = makeSearchExcerpt('hello world foo bar', 6, 5);
    expect(result).toContain('world');
  });

  it('truncates long before-text to 10 words', () => {
    const before = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    const text = `${before} matchword rest of text here`;
    const result = makeSearchExcerpt(text, text.indexOf('matchword'), 9);
    expect(result).toContain('...');
    expect(result).toContain('matchword');
  });

  it('truncates long after-text to 10 words', () => {
    const after = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    const text = `matchword ${after}`;
    const result = makeSearchExcerpt(text, 0, 9);
    expect(result).toContain('...');
  });

  it('does not add ellipsis for short context', () => {
    const text = 'short matchword end';
    const result = makeSearchExcerpt(text, 6, 9);
    expect(result).not.toContain('...');
  });

  it('handles index at start of text', () => {
    const result = makeSearchExcerpt('matchword after text', 0, 9);
    expect(result).toContain('matchword');
  });

  it('handles index at end of text', () => {
    const text = 'before matchword';
    const idx = text.indexOf('matchword');
    const result = makeSearchExcerpt(text, idx, 9);
    expect(result).toContain('matchword');
  });

  it('collapses whitespace in before/after text', () => {
    const text = 'before   \n\t  matchword   \n  after';
    const idx = text.indexOf('matchword');
    const result = makeSearchExcerpt(text, idx, 9);
    expect(result).toContain('matchword');
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\t');
  });

  it('handles empty before text', () => {
    const result = makeSearchExcerpt('matchword', 0, 9);
    expect(result).toContain('matchword');
  });

  it('handles empty after text', () => {
    const text = 'prefix matchword';
    const idx = text.indexOf('matchword');
    const result = makeSearchExcerpt(text, idx, 9);
    expect(result).toContain('matchword');
  });

  it('handles matchLength of 0', () => {
    const result = makeSearchExcerpt('hello world', 6, 0);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns trimmed result', () => {
    const result = makeSearchExcerpt('  before matchword after  ', 10, 9);
    expect(result).toBe(result.trim());
  });

  it('both ellipses appear for very long content', () => {
    const before = Array.from({ length: 20 }, (_, i) => `bw${i}`).join(' ');
    const after = Array.from({ length: 20 }, (_, i) => `aw${i}`).join(' ');
    const text = `${before} TARGET ${after}`;
    const idx = text.indexOf('TARGET');
    const result = makeSearchExcerpt(text, idx, 6);
    const ellipsisCount = (result.match(/\.\.\./g) || []).length;
    expect(ellipsisCount).toBe(2);
  });
});
