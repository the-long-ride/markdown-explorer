import { describe, it, expect } from 'vitest';
import {
  isWorkspaceNavigationHref,
  formatPreviewDuration,
  formatTemplate,
} from '../../../../ui/src/components/Content/Content';

describe('Content pure functions', () => {
  describe('isWorkspaceNavigationHref', () => {
    it('returns false for empty string', () => {
      expect(isWorkspaceNavigationHref('')).toBe(false);
    });

    it('returns false for #', () => {
      expect(isWorkspaceNavigationHref('#')).toBe(false);
    });

    it('returns false for #anchor', () => {
      expect(isWorkspaceNavigationHref('#anchor')).toBe(false);
    });

    it('returns false for https://example.com', () => {
      expect(isWorkspaceNavigationHref('https://example.com')).toBe(false);
    });

    it('returns false for http://example.com', () => {
      expect(isWorkspaceNavigationHref('http://example.com')).toBe(false);
    });

    it('returns false for mailto:test@test.com', () => {
      expect(isWorkspaceNavigationHref('mailto:test@test.com')).toBe(false);
    });

    it('returns false for //cdn.example.com', () => {
      expect(isWorkspaceNavigationHref('//cdn.example.com')).toBe(false);
    });

    it('returns true for /absolute/path', () => {
      expect(isWorkspaceNavigationHref('/absolute/path')).toBe(true);
    });

    it('returns true for ./relative/path', () => {
      expect(isWorkspaceNavigationHref('./relative/path')).toBe(true);
    });

    it('returns true for ../parent/path', () => {
      expect(isWorkspaceNavigationHref('../parent/path')).toBe(true);
    });

    it('returns false for whitespace-only', () => {
      expect(isWorkspaceNavigationHref('   ')).toBe(false);
    });

    it('returns false for javascript:alert(1)', () => {
      expect(isWorkspaceNavigationHref('javascript:alert(1)')).toBe(false);
    });

    it('returns false for data:text/plain', () => {
      expect(isWorkspaceNavigationHref('data:text/plain')).toBe(false);
    });

    it('returns false for tel:+1234', () => {
      expect(isWorkspaceNavigationHref('tel:+1234')).toBe(false);
    });

    it('handles whitespace around href', () => {
      expect(isWorkspaceNavigationHref('  /path  ')).toBe(true);
    });
  });

  describe('formatPreviewDuration', () => {
    it('returns empty for undefined', () => {
      expect(formatPreviewDuration(undefined)).toBe('');
    });

    it('returns empty for NaN', () => {
      expect(formatPreviewDuration(NaN)).toBe('');
    });

    it('returns empty for 0', () => {
      expect(formatPreviewDuration(0)).toBe('');
    });

    it('returns empty for Infinity', () => {
      expect(formatPreviewDuration(Infinity)).toBe('');
    });

    it('formats milliseconds under 1000', () => {
      expect(formatPreviewDuration(500)).toBe('500 ms');
    });

    it('rounds to minimum 1ms', () => {
      expect(formatPreviewDuration(0.1)).toBe('1 ms');
    });

    it('formats seconds with 1 decimal under 10s', () => {
      expect(formatPreviewDuration(2500)).toBe('2.5 s');
    });

    it('formats seconds with 0 decimal at 10s+', () => {
      expect(formatPreviewDuration(15000)).toBe('15 s');
    });

    it('formats exactly 1 second', () => {
      expect(formatPreviewDuration(1000)).toBe('1.0 s');
    });

    it('formats 9.9 seconds', () => {
      expect(formatPreviewDuration(9900)).toBe('9.9 s');
    });

    it('rounds 999ms to 1000ms -> 1.0 s', () => {
      expect(formatPreviewDuration(999)).toBe('999 ms');
    });
  });

  describe('formatTemplate', () => {
    it('replaces single placeholder', () => {
      expect(formatTemplate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
    });

    it('replaces multiple placeholders', () => {
      expect(formatTemplate('{a} and {b}', { a: 'X', b: 'Y' })).toBe('X and Y');
    });

    it('leaves unknown placeholders as-is', () => {
      expect(formatTemplate('{a} {unknown}', { a: 'X' })).toBe('X {unknown}');
    });

    it('handles no placeholders', () => {
      expect(formatTemplate('no placeholders', {})).toBe('no placeholders');
    });

    it('replaces repeated occurrences', () => {
      expect(formatTemplate('{a}-{a}', { a: 'X' })).toBe('X-X');
    });

    it('handles empty template', () => {
      expect(formatTemplate('', { a: 'X' })).toBe('');
    });
  });
});
