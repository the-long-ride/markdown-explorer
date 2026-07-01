import { describe, it, expect } from 'vitest';
import { readCodeLine, clampCodeLine, offsetToCodeLine } from '../../../../ui/src/dom/codeLineHandlers';

describe('codeLineHandlers pure functions', () => {
  describe('readCodeLine', () => {
    it('parses valid number string', () => {
      expect(readCodeLine('5')).toBe(5);
    });

    it('parses "1" as 1', () => {
      expect(readCodeLine('1')).toBe(1);
    });

    it('returns null for "0"', () => {
      expect(readCodeLine('0')).toBeNull();
    });

    it('returns null for negative', () => {
      expect(readCodeLine('-1')).toBeNull();
    });

    it('returns null for NaN string', () => {
      expect(readCodeLine('abc')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(readCodeLine(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(readCodeLine('')).toBeNull();
    });

    it('returns null for Infinity', () => {
      expect(readCodeLine('Infinity')).toBeNull();
    });

    it('returns 3.7 for float string (Number does not truncate)', () => {
      expect(readCodeLine('3.7')).toBe(3.7);
    });
  });

  describe('clampCodeLine', () => {
    it('clamps to minimum of 1', () => {
      expect(clampCodeLine(0, 10)).toBe(1);
    });

    it('clamps to maximum of count', () => {
      expect(clampCodeLine(15, 10)).toBe(10);
    });

    it('returns line when in range', () => {
      expect(clampCodeLine(5, 10)).toBe(5);
    });

    it('rounds to nearest integer', () => {
      expect(clampCodeLine(3.7, 10)).toBe(4);
    });

    it('handles count of 0 (returns at least 1)', () => {
      expect(clampCodeLine(5, 0)).toBe(1);
    });

    it('handles negative line by clamping to 1', () => {
      expect(clampCodeLine(-3, 10)).toBe(1);
    });

    it('clamps to 1 when line equals count', () => {
      expect(clampCodeLine(1, 1)).toBe(1);
    });

    it('rounds 2.1 to 2', () => {
      expect(clampCodeLine(2.1, 10)).toBe(2);
    });

    it('rounds 2.6 to 3', () => {
      expect(clampCodeLine(2.6, 10)).toBe(3);
    });
  });

  describe('offsetToCodeLine', () => {
    it('returns 1 for first line', () => {
      expect(offsetToCodeLine('hello', 0)).toBe(1);
    });

    it('returns 2 for second line', () => {
      expect(offsetToCodeLine('line1\nline2', 6)).toBe(2);
    });

    it('returns correct line for multi-line text', () => {
      expect(offsetToCodeLine('a\nb\nc', 4)).toBe(3);
    });

    it('handles offset at end', () => {
      expect(offsetToCodeLine('a\nb', 3)).toBe(2);
    });

    it('clamps negative offset to 0', () => {
      expect(offsetToCodeLine('hello', -5)).toBe(1);
    });

    it('clamps offset beyond length', () => {
      expect(offsetToCodeLine('hi', 100)).toBe(1);
    });

    it('handles empty text', () => {
      expect(offsetToCodeLine('', 0)).toBe(1);
    });

    it('counts last line correctly', () => {
      expect(offsetToCodeLine('a\nb\nc\nd', 7)).toBe(4);
    });
  });
});
