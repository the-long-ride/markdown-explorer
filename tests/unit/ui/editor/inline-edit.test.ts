import { describe, expect, it } from 'vitest';
import { readEditableRange, replaceSourceRange } from '../../../../ui/src/editor/inlineEdit';

describe('inline Markdown source ranges', () => {
  it('replaces exactly the selected Markdown source range', () => {
    expect(replaceSourceRange('# A\n\nText', { start: 0, end: 3 }, '# B')).toBe('# B\n\nText');
  });

  it('rejects a stale or out-of-bounds source range', () => {
    expect(() => replaceSourceRange('# A', { start: 0, end: 99 }, '# B')).toThrow('Invalid Markdown source range');
  });

  it('reads a valid rendered source range from DOM metadata', () => {
    const element = document.createElement('p');
    element.setAttribute('data-mdn-source-start', '5');
    element.setAttribute('data-mdn-source-end', '9');

    expect(readEditableRange(element, 12)).toEqual({ start: 5, end: 9 });
  });

  it('rejects missing, reversed, and stale rendered source ranges', () => {
    const missing = document.createElement('p');
    expect(readEditableRange(missing, 12)).toBeNull();

    const reversed = document.createElement('p');
    reversed.setAttribute('data-mdn-source-start', '9');
    reversed.setAttribute('data-mdn-source-end', '5');
    expect(readEditableRange(reversed, 12)).toBeNull();

    const stale = document.createElement('p');
    stale.setAttribute('data-mdn-source-start', '5');
    stale.setAttribute('data-mdn-source-end', '99');
    expect(readEditableRange(stale, 12)).toBeNull();
  });
});
