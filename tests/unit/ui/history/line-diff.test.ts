import { describe, expect, it } from 'vitest';
import { diffLines } from '../../../../ui/src/history/lineDiff';

describe('diffLines', () => {
  it('produces deterministic add/remove/context lines', () => {
    const hunks = diffLines('a\nb\nc', 'a\nx\nc');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toEqual([
      { type: 'context', left: 1, right: 1, text: 'a' },
      { type: 'remove', left: 2, text: 'b' },
      { type: 'add', right: 2, text: 'x' },
      { type: 'context', left: 3, right: 3, text: 'c' },
    ]);
  });

  it('normalizes CRLF and preserves a trailing empty line', () => {
    expect(diffLines('a\r\n', 'a\r\nx\r\n', 1)[0].lines).toEqual([
      { type: 'context', left: 1, right: 1, text: 'a' },
      { type: 'add', right: 2, text: 'x' },
      { type: 'context', left: 2, right: 3, text: '' },
    ]);
  });

  it('trims unchanged regions into separate hunks', () => {
    const left = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n');
    const right = ['a', 'B', 'c', 'd', 'e', 'f', 'G', 'h'].join('\n');
    const hunks = diffLines(left, right, 1);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3 });
    expect(hunks[1]).toMatchObject({ oldStart: 6, oldLines: 3, newStart: 6, newLines: 3 });
  });

  it('handles repeated lines and unicode deterministically', () => {
    const hunks = diffLines('α\nsame\nsame\nω', 'α\nsame\n新\nω');
    expect(hunks.flatMap((hunk) => hunk.lines).filter((line) => line.type !== 'context')).toEqual([
      { type: 'remove', left: 3, text: 'same' },
      { type: 'add', right: 3, text: '新' },
    ]);
  });

  it('handles a 10k-line mostly-identical document without matrix allocation', () => {
    const left = Array.from({ length: 10_000 }, (_, index) => `line-${index}`);
    const right = [...left];
    right[5_000] = 'changed-middle';
    const hunks = diffLines(left.join('\n'), right.join('\n'));
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.some((line) => line.type === 'remove' && line.text === 'line-5000')).toBe(true);
    expect(hunks[0].lines.some((line) => line.type === 'add' && line.text === 'changed-middle')).toBe(true);
  });
});
