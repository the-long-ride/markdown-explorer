import { describe, expect, it } from 'vitest';
import { splitDiffRows } from '../../../../ui/src/history/splitDiffRows';

describe('splitDiffRows', () => {
  it('pairs removed and added lines inside a hunk and pads the shorter side', () => {
    const rows = splitDiffRows('a\nb\nc', 'a\nB\nX\nc');

    expect(rows.map((row) => [row.left?.text ?? null, row.right?.text ?? null])).toEqual([
      ['a', 'a'],
      ['b', 'B'],
      [null, 'X'],
      ['c', 'c'],
    ]);
    expect(rows[1]).toMatchObject({ left: { type: 'remove', line: 2 }, right: { type: 'add', line: 2 } });
    expect(rows[2]).toMatchObject({ right: { type: 'add', line: 3 } });
    expect(rows[2].left).toBeUndefined();
  });

  it('keeps both line numbers on context rows', () => {
    const rows = splitDiffRows('x\nkeep', 'keep');

    expect(rows).toEqual([
      { hunk: 0, left: { line: 1, text: 'x', type: 'remove' } },
      { hunk: 0, left: { line: 2, text: 'keep', type: 'context' }, right: { line: 1, text: 'keep', type: 'context' } },
    ]);
  });

  it('numbers hunks so the view can separate distant changes', () => {
    const left = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n');
    const right = left.replace('line 1', 'line one').replace('line 18', 'line eighteen');

    const hunks = new Set(splitDiffRows(left, right).map((row) => row.hunk));

    expect([...hunks]).toEqual([0, 1]);
  });

  it('returns no rows for identical sources', () => {
    expect(splitDiffRows('same', 'same')).toEqual([]);
  });
});
