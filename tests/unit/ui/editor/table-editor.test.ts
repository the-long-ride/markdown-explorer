import { describe, expect, it } from 'vitest';
import {
  buildCustomTable,
  clearCells,
  deleteColumn,
  deleteRow,
  findTableRanges,
  insertColumn,
  insertRow,
  isPipeTableSeparator,
  parseMarkdownTable,
  serializeMarkdownTable,
  splitPipeCells,
  tablesEqual,
  updateCell,
  type TableData,
} from '../../../../ui/src/editor/tableEditor';

describe('tableEditor', () => {
  it('splits cells with escaped pipes and inline code', () => {
    const cells = splitPipeCells('| A | B\\|C | `X|Y` | D |');
    expect(cells).toEqual(['A', 'B|C', '`X|Y`', 'D']);
  });

  it('detects pipe table separators with alignments', () => {
    expect(isPipeTableSeparator('| --- | :--- | :---: | ---: |')).toBe(true);
    expect(isPipeTableSeparator('| normal | text |')).toBe(false);
  });

  it('parses markdown table with alignments', () => {
    const markdown = [
      '| Name | Age | City |',
      '| :--- | :---: | ---: |',
      '| Alice | 30 | Paris |',
      '| Bob | 25 | London |',
    ].join('\n');

    const parsed = parseMarkdownTable(markdown);
    expect(parsed).not.toBeNull();
    expect(parsed?.headers).toEqual(['Name', 'Age', 'City']);
    expect(parsed?.alignments).toEqual(['left', 'center', 'right']);
    expect(parsed?.rows).toEqual([
      ['Alice', '30', 'Paris'],
      ['Bob', '25', 'London'],
    ]);
  });

  it('serializes table data back to aligned markdown', () => {
    const data: TableData = {
      headers: ['A', 'B'],
      alignments: ['left', 'center'],
      rows: [['1', '2'], ['hello', 'world']],
    };
    const serialized = serializeMarkdownTable(data);
    expect(serialized).toContain('| A     | B     |');
    expect(serialized).toContain('| :---- | :---: |');
    expect(serialized).toContain('| 1     | 2     |');
    expect(serialized).toContain('| hello | world |');
  });

  it('builds custom table with specified rows and cols', () => {
    const table = buildCustomTable(3, 2);
    const parsed = parseMarkdownTable(table);
    expect(parsed).not.toBeNull();
    expect(parsed?.headers).toEqual(['Column 1', 'Column 2']);
    expect(parsed?.rows.length).toBe(2);
    expect(parsed?.rows[0]).toEqual(['Value 1', 'Value 2']);
    expect(parsed?.rows[1]).toEqual(['Value 3', 'Value 4']);
  });

  it('inserts and deletes rows', () => {
    const initial: TableData = {
      headers: ['Col 1', 'Col 2'],
      alignments: [null, null],
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    };

    const insertedAbove = insertRow(initial, 1, 'above');
    expect(insertedAbove.rows.length).toBe(3);
    expect(insertedAbove.rows[1]).toEqual(['', '']);

    const insertedBelow = insertRow(initial, 0, 'below');
    expect(insertedBelow.rows.length).toBe(3);
    expect(insertedBelow.rows[1]).toEqual(['', '']);

    const deleted = deleteRow(initial, 0);
    expect(deleted.rows.length).toBe(1);
    expect(deleted.rows[0]).toEqual(['C', 'D']);

    const deletedAll = deleteRow(deleted, 0);
    expect(deletedAll.rows.length).toBe(1);
    expect(deletedAll.rows[0]).toEqual(['', '']);
  });

  it('inserts and deletes columns', () => {
    const initial: TableData = {
      headers: ['Col 1', 'Col 2'],
      alignments: [null, null],
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    };

    const insertedLeft = insertColumn(initial, 1, 'left', 'New Col');
    expect(insertedLeft.headers).toEqual(['Col 1', 'New Col', 'Col 2']);
    expect(insertedLeft.rows[0]).toEqual(['A', '', 'B']);

    const insertedRight = insertColumn(initial, 1, 'right');
    expect(insertedRight.headers).toEqual(['Col 1', 'Col 2', 'Column 3']);
    expect(insertedRight.rows[0]).toEqual(['A', 'B', '']);

    const deletedCol = deleteColumn(initial, 0);
    expect(deletedCol.headers).toEqual(['Col 2']);
    expect(deletedCol.rows[0]).toEqual(['B']);

    // Cannot delete last column
    const deleteLast = deleteColumn(deletedCol, 0);
    expect(deleteLast.headers).toEqual(['Col 2']);
  });

  it('updates cell values in header and body', () => {
    const initial: TableData = {
      headers: ['Col 1', 'Col 2'],
      alignments: [null, null],
      rows: [['A', 'B']],
    };

    const headerUpdated = updateCell(initial, -1, 0, 'Updated Header');
    expect(headerUpdated.headers[0]).toBe('Updated Header');

    const cellUpdated = updateCell(initial, 0, 1, 'Updated Cell');
    expect(cellUpdated.rows[0][1]).toBe('Updated Cell');
  });

  it('compares table equality', () => {
    const a: TableData = { headers: ['1'], alignments: [null], rows: [['a']] };
    const b: TableData = { headers: ['1'], alignments: [null], rows: [['a']] };
    const c: TableData = { headers: ['1'], alignments: [null], rows: [['b']] };
    expect(tablesEqual(a, b)).toBe(true);
    expect(tablesEqual(a, c)).toBe(false);
  });

  it('finds table ranges across multiline document and skips code blocks', () => {
    const doc = [
      '# Document',
      '',
      '| Header 1 | Header 2 |',
      '| --- | --- |',
      '| Cell 1 | Cell 2 |',
      '',
      'Some text',
      '',
      '```markdown',
      '| Not | A | Real | Table |',
      '| --- | - | ---- | ----- |',
      '```',
      '',
      '| Another | Table |',
      '| :---: | ---: |',
      '| X | Y |',
    ].join('\n');

    const ranges = findTableRanges(doc);
    expect(ranges.length).toBe(2);
    expect(ranges[0].data.headers).toEqual(['Header 1', 'Header 2']);
    expect(ranges[1].data.headers).toEqual(['Another', 'Table']);
  });

  it('bounds table ranges to exact table block so trailing content is editable', () => {
    const docWithTrailingNewlines = [
      '# Document',
      '',
      '| Col 1 | Col 2 |',
      '| --- | --- |',
      '| Val 1 | Val 2 |',
      '',
      '',
    ].join('\n');

    const ranges = findTableRanges(docWithTrailingNewlines);
    expect(ranges.length).toBe(1);
    expect(ranges[0].to).toBeLessThan(docWithTrailingNewlines.length);

    const docWithTrailingText = [
      '| Col 1 | Col 2 |',
      '| --- | --- |',
      '| Val 1 | Val 2 |',
      '',
      'Trailing text',
    ].join('\n');

    const rangesWithText = findTableRanges(docWithTrailingText);
    expect(rangesWithText.length).toBe(1);
    expect(rangesWithText[0].to).toBeLessThan(docWithTrailingText.length);
  });

  it('clears specific cells in table headers and body', () => {
    const initial: TableData = {
      headers: ['Col 1', 'Col 2', 'Col 3'],
      alignments: [null, null, null],
      rows: [
        ['A1', 'B1', 'C1'],
        ['A2', 'B2', 'C2'],
      ],
    };

    const cleared = clearCells(initial, [
      { row: -1, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);

    expect(cleared.headers).toEqual(['', 'Col 2', 'Col 3']);
    expect(cleared.rows).toEqual([
      ['A1', '', 'C1'],
      ['A2', '', ''],
    ]);
  });
});
