import { describe, expect, it } from 'vitest';
import {
  buildCustomTable, clearCells, deleteRow, isPipeTableSeparator, parseMarkdownTable, serializeMarkdownTable, splitPipeCells, tablesEqual, updateCell,
} from '../../../../ui/src/editor/tableEditor';

describe('tableEditor edge cases', () => {
  it('splits cells with code spans and unbounded pipes', () => {
    expect(splitPipeCells('a | `x|y` | ``b`` ')).toEqual(['a', '`x|y`', '``b``']);
    expect(isPipeTableSeparator('no pipes')).toBe(false);
  });

  it('rejects malformed tables and pads short rows', () => {
    expect(parseMarkdownTable('| a |')).toBeNull();
    expect(parseMarkdownTable('a b\n| --- |')).toBeNull();
    expect(parseMarkdownTable('| a |\n| b |')).toBeNull();
    const data = parseMarkdownTable('| a | b | c |\n| :-- | --: |\n| 1 |\nnot a row\n| --- | --- |\n| 2 | 3 | 4 |')!;
    expect(data.rows[0]).toEqual(['1', '', '']);
    expect(data.alignments[2]).toBeNull();
    expect(serializeMarkdownTable(data)).toContain('--:');
    expect(serializeMarkdownTable({ headers: [], rows: [], alignments: [] } as any)).toBe('');
    expect(serializeMarkdownTable({ headers: ['h'], rows: [[]], alignments: ['right'] } as any)).toContain(':');
  });

  it('builds header-only tables and guards out-of-range edits', () => {
    expect(buildCustomTable(1, 2).split('\n').length).toBeGreaterThanOrEqual(3);
    const data = parseMarkdownTable('| a | b |\n| --- | --- |\n| 1 | 2 |')!;
    expect(deleteRow(data, 5)).toBe(data);
    expect(updateCell(data, -1, 9, 'x')).toBe(data);
    expect(updateCell(data, 0, 9, 'x')).toBe(data);
    expect(clearCells(data, [])).toBe(data);
    expect(clearCells(data, [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 9, col: 0 }] as any).rows[0]).toEqual(['1', '']);
    expect(clearCells(data, [{ row: 0, col: 99 }] as any)).toEqual(data);
  });

  it('compares tables structurally', () => {
    const a = parseMarkdownTable('| a |\n| --- |\n| 1 |')!;
    expect(tablesEqual(a, a)).toBe(true);
    expect(tablesEqual(a, { ...a, headers: ['a', 'b'] })).toBe(false);
    expect(tablesEqual(a, { ...a, rows: [] })).toBe(false);
    expect(tablesEqual(a, { ...a, headers: ['z'] })).toBe(false);
    expect(tablesEqual(a, { ...a, rows: [['2']] })).toBe(false);
  });
});
