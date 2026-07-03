import { describe, it, expect } from 'vitest';
import { renderHighlightedExcerpt } from '../../../../ui/src/components/Search/SearchOverlay';

describe('renderHighlightedExcerpt', () => {
  it('returns unchanged excerpt when query is empty', () => {
    expect(renderHighlightedExcerpt('hello world', '')).toBe('hello world');
  });

  it('returns unchanged excerpt when query is whitespace', () => {
    expect(renderHighlightedExcerpt('hello world', '   ')).toBe('hello world');
  });

  it('highlights matching text in excerpt', () => {
    const result = renderHighlightedExcerpt('hello world', 'world');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('returns original excerpt when no match found', () => {
    expect(renderHighlightedExcerpt('hello world', 'xyz')).toBe('hello world');
  });

  it('highlights multiple matches', () => {
    const result = renderHighlightedExcerpt('abc abc abc', 'abc');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(3);
  });

  it('returns pieces with strong elements and text between', () => {
    const result = renderHighlightedExcerpt('hello world hello', 'hello') as any[];
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('handles single character match', () => {
    const result = renderHighlightedExcerpt('abc', 'b');
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles match at the start', () => {
    const result = renderHighlightedExcerpt('hello world', 'hello');
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles match at the end', () => {
    const result = renderHighlightedExcerpt('hello world', 'world');
    expect(Array.isArray(result)).toBe(true);
  });

  it('normalizes whitespace in query before matching', () => {
    const result = renderHighlightedExcerpt('hello world', 'hello  world');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe('SearchOverlay props', () => {
  it('exports renderHighlightedExcerpt as a named export', () => {
    expect(typeof renderHighlightedExcerpt).toBe('function');
  });
});
