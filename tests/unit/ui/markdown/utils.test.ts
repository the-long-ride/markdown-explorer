import { describe, it, expect, vi } from 'vitest';
import { escHtml, escAttr, slugify, shortId, renderButton } from '../../../../ui/src/markdown/utils';

const AMP = '\x26';
const AMP_E = AMP + 'amp;';
const LT_E = AMP + 'lt;';
const GT_E = AMP + 'gt;';
const QUOT_E = AMP + 'quot;';

describe('markdown/utils', () => {
  describe('escHtml', () => {
    it('escapes ampersands', () => {
      expect(escHtml('a ' + AMP + ' b')).toBe('a ' + AMP_E + ' b');
    });

    it('escapes less-than', () => {
      expect(escHtml('<div>')).toBe(LT_E + 'div' + GT_E);
    });

    it('escapes greater-than', () => {
      expect(escHtml('a>b')).toBe('a' + GT_E + 'b');
    });

    it('escapes double quotes', () => {
      expect(escHtml('"hello"')).toBe(QUOT_E + 'hello' + QUOT_E);
    });

    it('handles empty string', () => {
      expect(escHtml('')).toBe('');
    });

    it('escapes all entities in one string', () => {
      const input = '<a href="x' + AMP + 'y">';
      const expected = LT_E + 'a href=' + QUOT_E + 'x' + AMP_E + 'y' + QUOT_E + GT_E;
      expect(escHtml(input)).toBe(expected);
    });
  });

  describe('escAttr', () => {
    it('escapes backslashes', () => {
      expect(escAttr('a\\b')).toBe('a\\\\b');
    });

    it('escapes single quotes', () => {
      const result = escAttr("it's");
      expect(result).toBe("it\\'s");
    });

    it('handles both', () => {
      const result = escAttr("a\\b'c");
      expect(result).toBe("a\\\\b\\'c");
    });
  });

  describe('slugify', () => {
    it('lowercases text', () => {
      expect(slugify('Hello')).toBe('hello');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(slugify('hello @world!')).toBe('hello-world');
    });

    it('deduplicates hyphens', () => {
      expect(slugify('a - b')).toBe('a-b');
    });

    it('preserves alphanumeric, hyphens, underscores', () => {
      expect(slugify('my-heading_1')).toBe('my-heading_1');
    });

    it('trims whitespace from result', () => {
      expect(slugify('  hello  ')).toBe('-hello-');
    });
  });

  describe('shortId', () => {
    it('returns string with prefix', () => {
      const id = shortId('test');
      expect(id).toMatch(/^test_[a-z0-9]{6}$/);
    });

    it('uses default prefix "id"', () => {
      const id = shortId();
      expect(id).toMatch(/^id_[a-z0-9]{6}$/);
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 50 }, () => shortId()));
      expect(ids.size).toBeGreaterThan(40);
    });
  });

  describe('renderButton', () => {
    it('renders minimal button with required fields', () => {
      const html = renderButton({ onClick: 'doThing()', label: 'Click' });
      expect(html).toContain('onclick="doThing()"');
      expect(html).toContain('tooltip-container');
      expect(html).toContain('Click');
    });

    it('includes id when provided', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', id: 'my-btn' });
      expect(html).toContain('id="my-btn"');
    });

    it('includes disabled attribute', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', disabled: true });
      expect(html).toContain(' disabled');
    });

    it('includes onkeydown when provided', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', onKeyDown: 'handleKey()' });
      expect(html).toContain('onkeydown="handleKey()"');
    });

    it('uses tooltip over label when provided', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', tooltip: 'Tip text' });
      expect(html).toContain('Tip text');
    });

    it('falls back to label for tooltip when no tooltip given', () => {
      const html = renderButton({ onClick: 'x()', label: 'My Label' });
      expect(html).toContain('My Label');
    });

    it('adds data-tooltip-pos when tooltipPos provided', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', tooltipPos: 'above' });
      expect(html).toContain('data-tooltip-pos="above"');
    });

    it('includes custom className', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', className: 'my-class' });
      expect(html).toContain('my-class');
      expect(html).toContain('tooltip-container');
    });

    it('renders icon directly in onlyIcon mode (default)', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', iconHtml: '<svg/>' });
      expect(html).toContain('<svg/>');
      expect(html).not.toContain('btn-label');
    });

    it('renders label and icon when onlyIcon is false', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', iconHtml: '<svg/>', onlyIcon: false });
      expect(html).toContain('btn-icon');
      expect(html).toContain('btn-label');
    });

    it('escapes tooltip text', () => {
      const s = 'a' + AMP + 'b <c>'; 
      const html = renderButton({ onClick: 'x()', label: 'L', tooltip: s });
      expect(html).toContain(AMP_E);
      expect(html).toContain(LT_E);
    });

    it('renders icon without label in onlyIcon mode with no iconHtml', () => {
      const html = renderButton({ onClick: 'x()', label: 'L' });
      expect(html).toContain('button');
    });

    it('renders with no icon when onlyIcon is false and no iconHtml', () => {
      const html = renderButton({ onClick: 'x()', label: 'L', onlyIcon: false });
      expect(html).toContain('btn-label');
      expect(html).not.toContain('btn-icon');
    });
  });
});
