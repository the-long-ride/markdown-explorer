import { describe, it, expect } from 'vitest';
import { compareRows, formatRowCount, truncateLabel, detectColumnTypes } from '../../../../ui/src/dom/tableHandlers';

describe('compareRows', () => {
  it('numeric ascending: "100" vs "200" = -1', () => {
    expect(compareRows('100', '200', true)).toBe(-100);
  });

  it('numeric descending: "100" vs "200" = 1 (positive)', () => {
    expect(compareRows('100', '200', false)).toBe(100);
  });

  it('string ascending: "apple" vs "banana" = negative', () => {
    expect(compareRows('apple', 'banana', true)).toBeLessThan(0);
  });

  it('string descending: "apple" vs "banana" = positive', () => {
    expect(compareRows('apple', 'banana', false)).toBeGreaterThan(0);
  });

  it('dollar sign stripped: "$100" vs "$200" numeric compare', () => {
    expect(compareRows('$100', '$200', true)).toBe(-100);
  });

  it('percent stripped: "50%" vs "75%" numeric compare', () => {
    expect(compareRows('50%', '75%', true)).toBe(-25);
  });

  it('mixed $ and %: "$100" vs "75%" numeric compare', () => {
    expect(compareRows('$100', '75%', true)).toBe(25);
  });

  it('NaN falls back to string: "abc" vs "def" string compare ascending', () => {
    expect(compareRows('abc', 'def', true)).toBeLessThan(0);
  });

  it('empty string vs number: falls back to string compare', () => {
    expect(compareRows('', '5', true)).not.toBe(0);
  });

  it('both NaN: "abc" vs "xyz" string localeCompare ascending', () => {
    expect(compareRows('abc', 'xyz', true)).toBeLessThan(0);
  });

  it('both NaN descending', () => {
    expect(compareRows('abc', 'xyz', false)).toBeGreaterThan(0);
  });

  it('equal numeric values return 0 ascending', () => {
    expect(compareRows('50', '50', true)).toBe(0);
  });

  it('equal string values return 0 ascending', () => {
    expect(compareRows('hello', 'hello', true)).toBe(0);
  });

  it('comma is stripped by regex: "1,000" vs "2,000" numeric compare', () => {
    expect(compareRows('1,000', '2,000', true)).toBe(-1000);
  });
});

describe('formatRowCount', () => {
  it('no filter, all rows match: "15 rows"', () => {
    expect(formatRowCount(15, 15, false)).toBe('15 rows');
  });

  it('filtered, some match: "10 / 15 rows"', () => {
    expect(formatRowCount(10, 15, true)).toBe('10 / 15 rows');
  });

  it('not filtered but matched < total: "8 / 15 rows"', () => {
    expect(formatRowCount(8, 15, false)).toBe('8 / 15 rows');
  });

  it('zero matched: "0 / 10 rows"', () => {
    expect(formatRowCount(0, 10, false)).toBe('0 / 10 rows');
  });

  it('all matched with filter still shows fraction', () => {
    expect(formatRowCount(10, 10, true)).toBe('10 / 10 rows');
  });

  it('single row matched, no filter', () => {
    expect(formatRowCount(1, 1, false)).toBe('1 rows');
  });
});

describe('truncateLabel', () => {
  it('short text unchanged', () => {
    expect(truncateLabel('hello')).toBe('hello');
  });

  it('text at maxLength unchanged', () => {
    const text = 'a'.repeat(25);
    expect(truncateLabel(text)).toBe(text);
  });

  it('text over maxLength gets truncated with "..."', () => {
    const text = 'a'.repeat(26);
    expect(truncateLabel(text)).toBe('a'.repeat(22) + '...');
  });

  it('custom maxLength', () => {
    const text = 'abcdefghij';
    expect(truncateLabel(text, 8)).toBe('abcde...');
  });

  it('empty string', () => {
    expect(truncateLabel('')).toBe('');
  });

  it('text exactly at custom maxLength unchanged', () => {
    const text = 'abc';
    expect(truncateLabel(text, 3)).toBe('abc');
  });

  it('text one over custom maxLength truncates', () => {
    const text = 'abcd';
    expect(truncateLabel(text, 3)).toBe('...');
  });

  it('text well over maxLength truncates correctly', () => {
    const text = 'a'.repeat(100);
    expect(truncateLabel(text)).toBe('a'.repeat(22) + '...');
  });
});

describe('detectColumnTypes', () => {
  const makeGrid = (rows: string[][]) => {
    const colCount = rows[0]?.length ?? 0;
    return {
      headers: { length: colCount },
      getCellText: (rowIdx: number, colIdx: number) => rows[rowIdx]?.[colIdx] ?? ''
    };
  };

  it('all numeric columns', () => {
    const data = [['10', '20'], ['30', '40']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([0, 1]);
    expect(result.labelCols).toEqual([]);
  });

  it('all text columns', () => {
    const data = [['alice', 'bob'], ['carol', 'dave']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([]);
    expect(result.labelCols).toEqual([0, 1]);
  });

  it('mixed columns', () => {
    const data = [['alice', '100'], ['bob', '200']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([1]);
    expect(result.labelCols).toEqual([0]);
  });

  it('empty rows', () => {
    const { headers, getCellText } = makeGrid([]);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([]);
    expect(result.labelCols).toEqual([]);
  });

  it('some cells empty does not affect numeric detection', () => {
    const data = [['', ''], ['10', '20']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([0, 1]);
    expect(result.labelCols).toEqual([]);
  });

  it('columns with $ and % still numeric', () => {
    const data = [['$10', '50%'], ['$20', '75%']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([0, 1]);
    expect(result.labelCols).toEqual([]);
  });

  it('header with no data rows flagged as label', () => {
    const getCellText = () => '';
    const result = detectColumnTypes({ length: 2 }, getCellText);
    expect(result.numericCols).toEqual([]);
    expect(result.labelCols).toEqual([0, 1]);
  });

  it('respects maxRows parameter', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ['text', String(i * 10)]);
    const { headers, getCellText } = makeGrid(rows);
    const result5 = detectColumnTypes(headers, getCellText, 5);
    expect(result5.numericCols).toEqual([1]);
    expect(result5.labelCols).toEqual([0]);

    const result1 = detectColumnTypes(headers, getCellText, 1);
    expect(result1.numericCols).toEqual([1]);
    expect(result1.labelCols).toEqual([0]);
  });

  it('mixed content in column makes it label', () => {
    const data = [['100'], ['hello'], ['200']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([]);
    expect(result.labelCols).toEqual([0]);
  });

  it('single numeric row is enough for numeric column', () => {
    const data = [['42']];
    const { headers, getCellText } = makeGrid(data);
    const result = detectColumnTypes(headers, getCellText);
    expect(result.numericCols).toEqual([0]);
    expect(result.labelCols).toEqual([]);
  });
});
