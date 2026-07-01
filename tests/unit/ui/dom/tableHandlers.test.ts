import { describe, it, expect } from 'vitest';
import { normalizeFilterValues, getActiveFilterEntries, setColumnFilterValues } from '../../../../ui/src/dom/tableHandlers';

describe('dom/tableHandlers pure functions', () => {
  describe('normalizeFilterValues', () => {
    it('returns array from string', () => {
      expect(normalizeFilterValues('active')).toEqual(['active']);
    });

    it('returns array from array', () => {
      expect(normalizeFilterValues(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('returns empty array for null', () => {
      expect(normalizeFilterValues(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(normalizeFilterValues(undefined)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(normalizeFilterValues('')).toEqual([]);
    });

    it('filters out empty strings from array', () => {
      expect(normalizeFilterValues(['a', '', 'b'])).toEqual(['a', 'b']);
    });

    it('converts array values to strings', () => {
      expect(normalizeFilterValues([1, 2] as any)).toEqual(['1', '2']);
    });
  });

  describe('getActiveFilterEntries', () => {
    it('returns entries with valid values', () => {
      const filters = { '0': 'active', '1': null, '2': ['a', 'b'] };
      const entries = getActiveFilterEntries(filters);
      expect(entries).toEqual([[0, ['active']], [2, ['a', 'b']]]);
    });

    it('returns empty array for empty filters', () => {
      expect(getActiveFilterEntries({})).toEqual([]);
    });

    it('returns empty array for null filters', () => {
      expect(getActiveFilterEntries(null as any)).toEqual([]);
    });

    it('filters out entries with empty values', () => {
      const filters = { '0': '', '1': 'active' };
      const entries = getActiveFilterEntries(filters);
      expect(entries).toEqual([[1, ['active']]]);
    });

    it('parses colIdx as integer', () => {
      const filters = { '3': 'x' };
      const entries = getActiveFilterEntries(filters);
      expect(entries[0][0]).toBe(3);
    });
  });

  describe('setColumnFilterValues', () => {
    it('sets filter values on state', () => {
      const state = { filters: {} as Record<string, any> } as any;
      setColumnFilterValues(state, 2, ['a', 'b']);
      expect(state.filters[2]).toEqual(['a', 'b']);
    });

    it('deletes filter when values are empty', () => {
      const state = { filters: { '2': ['a'] } as Record<string, any> } as any;
      setColumnFilterValues(state, 2, []);
      expect(state.filters[2]).toBeUndefined();
    });

    it('overrides existing filter values', () => {
      const state = { filters: { '1': ['old'] } as Record<string, any> } as any;
      setColumnFilterValues(state, 1, ['new']);
      expect(state.filters[1]).toEqual(['new']);
    });
  });
});
