import { describe, it, expect } from 'vitest';
import {
  computeLineClasses,
  lineFromPosition,
  mergeLineRanges,
  computeVisibleRows,
} from '../../../../ui/src/dom/codeLineHandlers';

describe('computeLineClasses', () => {
  it('no active, no selection → both false', () => {
    expect(computeLineClasses(1, null, null, null)).toEqual({ isActive: false, isSelected: false });
  });

  it('line matches activeLine → isActive true', () => {
    expect(computeLineClasses(3, 3, null, null)).toEqual({ isActive: true, isSelected: false });
  });

  it('line does not match activeLine → isActive false', () => {
    expect(computeLineClasses(2, 5, null, null)).toEqual({ isActive: false, isSelected: false });
  });

  it('line in selection range → isSelected true', () => {
    expect(computeLineClasses(3, null, 2, 5)).toEqual({ isActive: false, isSelected: true });
  });

  it('line at rangeStart → isSelected true', () => {
    expect(computeLineClasses(2, null, 2, 5)).toEqual({ isActive: false, isSelected: true });
  });

  it('line at rangeEnd → isSelected true', () => {
    expect(computeLineClasses(5, null, 2, 5)).toEqual({ isActive: false, isSelected: true });
  });

  it('line outside range → isSelected false', () => {
    expect(computeLineClasses(6, null, 2, 5)).toEqual({ isActive: false, isSelected: false });
  });

  it('selection reversed (end < start) → still works with min/max', () => {
    expect(computeLineClasses(3, null, 5, 2)).toEqual({ isActive: false, isSelected: true });
  });

  it('activeLine and selected at same time', () => {
    expect(computeLineClasses(3, 3, 2, 5)).toEqual({ isActive: true, isSelected: true });
  });

  it('selectedStart without end → no selection', () => {
    expect(computeLineClasses(3, null, 2, null)).toEqual({ isActive: false, isSelected: false });
  });
});

describe('lineFromPosition', () => {
  it('clientY at top of element → line 1', () => {
    expect(lineFromPosition(0, 0, 20, 10)).toBe(1);
  });

  it('clientY one lineHeight below → line 2', () => {
    expect(lineFromPosition(20, 0, 20, 10)).toBe(2);
  });

  it('clientY clamped to 1 if above element', () => {
    expect(lineFromPosition(-50, 0, 20, 10)).toBe(1);
  });

  it('clientY clamped to count if below element', () => {
    expect(lineFromPosition(500, 0, 20, 10)).toBe(10);
  });

  it('clientY at arbitrary position', () => {
    expect(lineFromPosition(45, 0, 20, 10)).toBe(3);
  });

  it('lineHeight of 0 should not crash', () => {
    expect(() => lineFromPosition(10, 0, 0, 10)).not.toThrow();
  });
});

describe('mergeLineRanges', () => {
  it('both null → null', () => {
    expect(mergeLineRanges(null, null)).toBeNull();
  });

  it('only offset → offset', () => {
    expect(mergeLineRanges({ start: 2, end: 5 }, null)).toEqual({ start: 2, end: 5 });
  });

  it('only rect → rect', () => {
    expect(mergeLineRanges(null, { start: 3, end: 7 })).toEqual({ start: 3, end: 7 });
  });

  it('both present → merged min start, max end', () => {
    expect(mergeLineRanges({ start: 2, end: 5 }, { start: 3, end: 7 })).toEqual({ start: 2, end: 7 });
  });

  it('offset empty (end <= start) → rect', () => {
    expect(mergeLineRanges({ start: 5, end: 3 }, { start: 1, end: 4 })).toEqual({ start: 1, end: 4 });
  });

  it('both empty → null', () => {
    expect(mergeLineRanges({ start: 5, end: 3 }, { start: 4, end: 2 })).toBeNull();
  });
});

describe('computeVisibleRows', () => {
  const makeRow = (id: string, hidden = false) => ({
    classList: { contains: (s: string) => s === 'is-hidden' ? hidden : false },
    id,
  });

  it('returns visible rows excluding hidden', () => {
    const rows = [makeRow('r1'), makeRow('r2', true), makeRow('r3')];
    expect(computeVisibleRows(rows, 'tbl')).toHaveLength(2);
  });

  it('excludes toggle-row by id', () => {
    const rows = [makeRow('r1'), makeRow('tbl-toggle-row')];
    expect(computeVisibleRows(rows, 'tbl')).toHaveLength(1);
  });

  it('respects maxRows limit', () => {
    const rows = Array.from({ length: 60 }, (_, i) => makeRow(`r${i}`));
    expect(computeVisibleRows(rows, 'tbl', 50)).toHaveLength(50);
  });

  it('uses default maxRows of 50', () => {
    const rows = Array.from({ length: 60 }, (_, i) => makeRow(`r${i}`));
    expect(computeVisibleRows(rows, 'tbl')).toHaveLength(50);
  });

  it('returns all when under maxRows', () => {
    const rows = [makeRow('r1'), makeRow('r2')];
    expect(computeVisibleRows(rows, 'tbl')).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    expect(computeVisibleRows([], 'tbl')).toEqual([]);
  });
});
