import { describe, it, expect } from 'vitest';
import { _selectMatchIndex, clearSearchJumpMarks, _shouldSkipSearchJumpTextNode } from '../../../ui/src/utils/searchJump';

describe('searchJump pure functions', () => {
  describe('_selectMatchIndex', () => {
    const makeMatches = (offsets: number[]) =>
      offsets.map((o) => ({ cumulativeTextOffset: o, matchLength: 4 }));

    it('returns -1 for empty matches', () => {
      expect(_selectMatchIndex([], 'test', 0, undefined, null, '')).toBe(-1);
    });

    it('selects by ordinal when no matchIndex', () => {
      const matches = makeMatches([0, 10, 20]);
      expect(_selectMatchIndex(matches, 'test', 2, undefined, null, 'hello test world test more test')).toBe(2);
    });

    it('selects ordinal 0 by default', () => {
      const matches = makeMatches([0, 10, 20]);
      expect(_selectMatchIndex(matches, 'test', 0, undefined, null, 'hello test world test more test')).toBe(0);
    });

    it('falls back to 0 when ordinal exceeds matches', () => {
      const matches = makeMatches([0, 10]);
      expect(_selectMatchIndex(matches, 'test', 99, undefined, null, 'ab test cd test')).toBe(0);
    });

    it('selects closest match by proximity without markdown source', () => {
      const matches = makeMatches([5, 50, 100]);
      expect(_selectMatchIndex(matches, 'test', 0, 48, undefined, 'text')).toBe(1);
    });

    it('selects closest match at start', () => {
      const matches = makeMatches([5, 50, 100]);
      expect(_selectMatchIndex(matches, 'test', 0, 2, undefined, 'text')).toBe(0);
    });

    it('selects closest match at end', () => {
      const matches = makeMatches([5, 50, 100]);
      expect(_selectMatchIndex(matches, 'test', 0, 90, undefined, 'text')).toBe(2);
    });

    it('uses context-based matching with rawMarkdownSource', () => {
      const matches = makeMatches([0, 100]);
      const md = 'some intro text before the actual content here test word that follows more text';
      const rendered = 'some intro text before the actual content here test word that follows more text';
      expect(_selectMatchIndex(matches, 'test', 0, 60, md, rendered)).toBe(1);
    });

    it('context matching gives higher score for overlapping before-words', () => {
      const matches = makeMatches([0, 100]);
      const md = 'alpha beta gamma test delta epsilon';
      const rendered = 'alpha beta gamma test delta epsilon   other test here';
      expect(_selectMatchIndex(matches, 'test', 0, 18, md, rendered)).toBe(0);
    });

    it('context matching gives higher score for overlapping after-words', () => {
      const matches = makeMatches([0, 100]);
      const md = 'prefix test unique_after_word suffix';
      const rendered = 'prefix test unique_after_word suffix some test other';
      expect(_selectMatchIndex(matches, 'test', 0, 7, md, rendered)).toBe(0);
    });

    it('proxximity tie-breaker when context scores are equal', () => {
      const matches = makeMatches([50, 200]);
      const md = 'abc test def';
      const rendered = 'xyz test abc test def';
      const result = _selectMatchIndex(matches, 'test', 0, 4, md, rendered);
      expect(result).toBe(0);
    });

    it('handles matchIndex of 0', () => {
      const matches = makeMatches([100]);
      expect(_selectMatchIndex(matches, 'test', 0, 0, undefined, 'text')).toBe(0);
    });

    it('handles NaN matchIndex by falling back to ordinal', () => {
      const matches = makeMatches([0, 10, 20]);
      expect(_selectMatchIndex(matches, 'test', 1, NaN, undefined, 'text')).toBe(1);
    });
  });

  describe('clearSearchJumpMarks', () => {
    it('does nothing when root is null', () => {
      expect(() => clearSearchJumpMarks(null)).not.toThrow();
    });

    it('replaces marks with text nodes', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Hello <mark class="mdn-search-jump-mark">world</mark> end</p>';
      clearSearchJumpMarks(div);
      expect(div.querySelector('mark')).toBeNull();
      expect(div.querySelector('p')!.textContent).toBe('Hello world end');
    });

    it('replaces secondary marks', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p><mark class="mdn-search-jump-mark-secondary">text</mark></p>';
      clearSearchJumpMarks(div);
      expect(div.querySelector('mark')).toBeNull();
    });

    it('handles marks with no parent', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>no marks here</p>';
      expect(() => clearSearchJumpMarks(div)).not.toThrow();
    });
  });

  describe('_shouldSkipSearchJumpTextNode', () => {
    it('skips empty text nodes', () => {
      const el = document.createElement('div');
      el.textContent = '';
      const node = document.createTextNode('');
      el.appendChild(node);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
    });

    it('skips whitespace-only text nodes', () => {
      const el = document.createElement('p');
      const node = document.createTextNode('   ');
      el.appendChild(node);
      document.body.appendChild(el);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
      document.body.removeChild(el);
    });

    it('skips text inside buttons', () => {
      const btn = document.createElement('button');
      const node = document.createTextNode('click me');
      btn.appendChild(node);
      document.body.appendChild(btn);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
      document.body.removeChild(btn);
    });

    it('skips text inside textareas', () => {
      const ta = document.createElement('textarea');
      const node = document.createTextNode('content');
      ta.appendChild(node);
      document.body.appendChild(ta);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
      document.body.removeChild(ta);
    });

    it('does not skip regular text nodes', () => {
      const p = document.createElement('p');
      const node = document.createTextNode('hello world');
      p.appendChild(node);
      document.body.appendChild(p);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(false);
      document.body.removeChild(p);
    });

    it('skips text with no parent element', () => {
      const node = document.createTextNode('orphan');
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
    });

    it('skips text inside script tags', () => {
      const script = document.createElement('script');
      const node = document.createTextNode('var x = 1;');
      script.appendChild(node);
      document.body.appendChild(script);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
      document.body.removeChild(script);
    });

    it('skips text inside svg', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const node = document.createTextNode('icon');
      svg.appendChild(node);
      document.body.appendChild(svg);
      expect(_shouldSkipSearchJumpTextNode(node, 'mdn-search-jump-mark')).toBe(true);
      document.body.removeChild(svg);
    });
  });
});
