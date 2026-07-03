import { describe, it, expect } from 'vitest';
import {
  normalizeFilterValues,
  getActiveFilterEntries,
  setColumnFilterValues,
  compareRows,
  formatRowCount,
  truncateLabel,
  detectColumnTypes,
} from '../../../../ui/src/dom/tableHandlers';

describe('tableHandlers pure utilities', () => {
  describe('normalizeFilterValues', () => {
    it('returns empty for nullish', () => {
      expect(normalizeFilterValues(null)).toEqual([]);
      expect(normalizeFilterValues(undefined)).toEqual([]);
    });

    it('returns single string in array', () => {
      expect(normalizeFilterValues('foo')).toEqual(['foo']);
    });

    it('returns string array unchanged', () => {
      expect(normalizeFilterValues(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('filters out empty strings', () => {
      expect(normalizeFilterValues(['a', '', 'b'])).toEqual(['a', 'b']);
      expect(normalizeFilterValues('')).toEqual([]);
    });
  });

  describe('getActiveFilterEntries', () => {
    it('returns empty for empty object', () => {
      expect(getActiveFilterEntries({})).toEqual([]);
    });

    it('returns only entries with values', () => {
      const result = getActiveFilterEntries({ 0: ['a'], 1: [], 2: 'x', 3: null, 4: undefined });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0, ['a']]);
      expect(result[1]).toEqual([2, ['x']]);
    });
  });

  describe('setColumnFilterValues', () => {
    it('sets values when non-empty', () => {
      const state = { filters: {} };
      setColumnFilterValues(state as any, 1, ['a', 'b']);
      expect(state.filters[1]).toEqual(['a', 'b']);
    });

    it('deletes key when empty', () => {
      const state = { filters: { 1: ['a'] } };
      setColumnFilterValues(state as any, 1, []);
      expect(1 in state.filters).toBe(false);
    });
  });

  describe('compareRows', () => {
    it('compares numbers ascending', () => {
      expect(compareRows('10', '5', true)).toBe(5);
      expect(compareRows('10', '5', false)).toBe(-5);
    });

    it('compares strings ascending', () => {
      expect(compareRows('apple', 'banana', true)).toBeLessThan(0);
      expect(compareRows('banana', 'apple', true)).toBeGreaterThan(0);
    });

    it('handles currency symbols', () => {
      expect(compareRows('$10.50', '$5.25', true)).toBe(5.25);
      expect(compareRows('10%', '5%', true)).toBe(5);
    });

    it('falls back to localeCompare for non-numeric', () => {
      expect(compareRows('abc', 'def', true)).toBeLessThan(0);
      expect(compareRows('def', 'abc', false)).toBeLessThan(0);
    });
  });

  describe('formatRowCount', () => {
    it('shows total only when not filtered and all match', () => {
      expect(formatRowCount(10, 10, false)).toBe('10 rows');
    });

    it('shows match / total when filtered', () => {
      expect(formatRowCount(5, 10, true)).toBe('5 / 10 rows');
    });

    it('shows match / total when partial match even if not filtered', () => {
      expect(formatRowCount(5, 10, false)).toBe('5 / 10 rows');
    });
  });

  describe('truncateLabel', () => {
    it('returns original text when under max', () => {
      expect(truncateLabel('short')).toBe('short');
    });

    it('truncates long text with ellipsis', () => {
      expect(truncateLabel('a very long label that exceeds limit', 10)).toBe('a very ...');
    });

    it('uses default maxLength of 25', () => {
      const text = 'a'.repeat(30);
      expect(truncateLabel(text)).toHaveLength(25);
    });
  });

  describe('detectColumnTypes', () => {
    const makeGetter = (rows: string[][]) => (rowIdx: number, colIdx: number) => rows[rowIdx]?.[colIdx] ?? '';

    it('detects all numeric columns', () => {
      const rows = [['1', '2'], ['3', '4'], ['5', '6']];
      const result = detectColumnTypes({ length: 2 }, makeGetter(rows));
      expect(result.numericCols).toEqual([0, 1]);
      expect(result.labelCols).toEqual([]);
    });

    it('detects all text columns', () => {
      const rows = [['foo', 'bar'], ['baz', 'qux']];
      const result = detectColumnTypes({ length: 2 }, makeGetter(rows));
      expect(result.numericCols).toEqual([]);
      expect(result.labelCols).toEqual([0, 1]);
    });

    it('detects mixed columns', () => {
      const rows = [['Alice', '30'], ['Bob', '25'], ['Carol', '35']];
      const result = detectColumnTypes({ length: 2 }, makeGetter(rows));
      expect(result.numericCols).toEqual([1]);
      expect(result.labelCols).toEqual([0]);
    });

    it('handles currency and percentage as numeric', () => {
      const rows = [['$10', '10%'], ['$20', '20%']];
      const result = detectColumnTypes({ length: 2 }, makeGetter(rows));
      expect(result.numericCols).toEqual([0, 1]);
      expect(result.labelCols).toEqual([]);
    });

    it('respects maxRows parameter', () => {
      const rows = [['1'], ['not'], ['3']];
      // Only checks first row which is numeric
      const result = detectColumnTypes({ length: 1 }, makeGetter(rows), 1);
      expect(result.numericCols).toEqual([0]);
    });
  });
});
