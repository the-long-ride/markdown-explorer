import { describe, it, expect } from 'vitest';
import { cleanClonedText, computeSectionOccurrence } from '../../../../ui/src/dom/copyHandlers';

describe('cleanClonedText', () => {
  it('no extra newlines → unchanged', () => {
    expect(cleanClonedText('hello world')).toBe('hello world');
  });

  it('three newlines → two', () => {
    expect(cleanClonedText('a\n\n\nb')).toBe('a\n\nb');
  });

  it('five newlines → two', () => {
    expect(cleanClonedText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('leading/trailing whitespace trimmed', () => {
    expect(cleanClonedText('  hello  ')).toBe('hello');
  });

  it('mix of content and excessive newlines', () => {
    expect(cleanClonedText('line1\n\n\n\nline2\n\nline3  ')).toBe('line1\n\nline2\n\nline3');
  });
});

describe('computeSectionOccurrence', () => {
  const makeEl = () => ({}) as Element;

  it('found at index 0 → 0', () => {
    const el = makeEl();
    expect(computeSectionOccurrence([el], el)).toBe(0);
  });

  it('found at index 3 → 3', () => {
    const target = makeEl();
    const sections = [makeEl(), makeEl(), makeEl(), target];
    expect(computeSectionOccurrence(sections, target)).toBe(3);
  });

  it('not found (-1) → 0 via Math.max', () => {
    expect(computeSectionOccurrence([makeEl()], makeEl())).toBe(0);
  });

  it('empty array → 0', () => {
    expect(computeSectionOccurrence([], makeEl())).toBe(0);
  });

  it('single element array', () => {
    const el = makeEl();
    expect(computeSectionOccurrence([el], el)).toBe(0);
  });
});
