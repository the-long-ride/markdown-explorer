import { describe, it, expect } from 'vitest';
import {
  readCodeLine,
  clampCodeLine,
  offsetToCodeLine,
  computeLineClasses,
  lineFromPosition,
  mergeLineRanges,
  computeVisibleRows,
} from '../../../../ui/src/dom/codeLineHandlers';

describe('codeLineHandlers pure utilities', () => {
  describe('readCodeLine', () => {
    it('returns line number for valid string', () => {
      expect(readCodeLine('42')).toBe(42);
      expect(readCodeLine('1')).toBe(1);
    });

    it('returns null for undefined', () => {
      expect(readCodeLine(undefined)).toBeNull();
    });

    it('returns null for non-positive numbers', () => {
      expect(readCodeLine('0')).toBeNull();
      expect(readCodeLine('-1')).toBeNull();
      expect(readCodeLine('NaN')).toBeNull();
    });

    it('returns null for non-numeric', () => {
      expect(readCodeLine('abc')).toBeNull();
      expect(readCodeLine('')).toBeNull();
    });
  });

  describe('clampCodeLine', () => {
    it('clamps to 1 minimum', () => {
      expect(clampCodeLine(-5, 10)).toBe(1);
      expect(clampCodeLine(0, 10)).toBe(1);
    });

    it('clamps to count maximum', () => {
      expect(clampCodeLine(15, 10)).toBe(10);
    });

    it('clamps to 1 even when count is 0', () => {
      expect(clampCodeLine(5, 0)).toBe(1);
    });

    it('returns exact value within range', () => {
      expect(clampCodeLine(5, 10)).toBe(5);
      expect(clampCodeLine(10, 10)).toBe(10);
    });

    it('rounds to nearest integer', () => {
      expect(clampCodeLine(5.7, 10)).toBe(6);
      expect(clampCodeLine(5.2, 10)).toBe(5);
    });
  });

  describe('offsetToCodeLine', () => {
    it('returns line number at offset', () => {
      expect(offsetToCodeLine('line1\nline2\nline3', 7)).toBe(2); // starts at line2
    });

    it('clamps offset to bounds', () => {
      expect(offsetToCodeLine('line1', -1)).toBe(1);
      expect(offsetToCodeLine('line1', 100)).toBe(1);
    });

    it('handles empty string', () => {
      expect(offsetToCodeLine('', 0)).toBe(1);
    });
  });

  describe('computeLineClasses', () => {
    it('marks active when line matches', () => {
      const result = computeLineClasses(5, 5, null, null);
      expect(result.isActive).toBe(true);
      expect(result.isSelected).toBe(false);
    });

    it('does not mark active when line differs', () => {
      const result = computeLineClasses(5, 3, null, null);
      expect(result.isActive).toBe(false);
    });

    it('marks selected within range', () => {
      const result = computeLineClasses(5, null, 3, 7);
      expect(result.isSelected).toBe(true);
    });

    it('does not select outside range', () => {
      expect(computeLineClasses(2, null, 3, 7).isSelected).toBe(false);
      expect(computeLineClasses(8, null, 3, 7).isSelected).toBe(false);
    });

    it('handles reversed selection range', () => {
      const result = computeLineClasses(5, null, 7, 3);
      expect(result.isSelected).toBe(true);
    });
  });

  describe('lineFromPosition', () => {
    it('computes line from pixel position', () => {
      expect(lineFromPosition(100, 0, 20, 10)).toBe(6); // (100 - 0) / 20 + 1 rounded = 5.x -> floor = 5 -> +1 = 6... wait, floor((100-0)/20)+1 = floor(5)+1 = 6
    });

    it('clamps to count', () => {
      expect(lineFromPosition(1000, 0, 20, 10)).toBe(10);
    });

    it('clamps to 1 minimum', () => {
      expect(lineFromPosition(-5, 0, 20, 10)).toBe(1);
    });
  });

  describe('mergeLineRanges', () => {
    it('returns rect range when offset is invalid', () => {
      expect(mergeLineRanges({ start: 5, end: 5 }, { start: 1, end: 3 })).toEqual({ start: 1, end: 3 });
    });

    it('returns null when both are invalid', () => {
      expect(mergeLineRanges({ start: 3, end: 3 }, { start: 5, end: 5 })).toBeNull();
    });

    it('returns offset when rect is absent', () => {
      expect(mergeLineRanges({ start: 1, end: 5 }, null)).toEqual({ start: 1, end: 5 });
    });

    it('returns rect when offset is null', () => {
      expect(mergeLineRanges(null, { start: 2, end: 4 })).toEqual({ start: 2, end: 4 });
    });

    it('merges ranges', () => {
      expect(mergeLineRanges({ start: 1, end: 5 }, { start: 3, end: 7 })).toEqual({ start: 1, end: 7 });
      expect(mergeLineRanges({ start: 5, end: 10 }, { start: 1, end: 3 })).toEqual({ start: 1, end: 10 });
    });
  });

  describe('computeVisibleRows', () => {
    it('filters hidden rows', () => {
      const rows = [
        { classList: { contains: () => false }, id: 'row1' },
        { classList: { contains: () => true }, id: 'row2' },
        { classList: { contains: () => false }, id: 'tbl-toggle-row' },
        { classList: { contains: () => false }, id: 'row4' },
      ];
      const result = computeVisibleRows(rows as any, 'tbl', 50);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('row1');
      expect(result[1].id).toBe('row4');
    });

    it('respects maxRows limit', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        classList: { contains: () => false },
        id: `row${i}`,
      }));
      const result = computeVisibleRows(rows as any, 'tbl', 5);
      expect(result).toHaveLength(5);
    });
  });
});
