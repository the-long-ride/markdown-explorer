import { describe, expect, it } from 'vitest';
import { diffLines, diffLinesDetailed } from '../../../../ui/src/history/lineDiff';

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

  it('matches the LCS edit distance and reconstructs both sides for random inputs', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const lcsLength = (left: string[], right: string[]) => {
      const table = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
      for (let i = 1; i <= left.length; i += 1) {
        for (let j = 1; j <= right.length; j += 1) {
          table[i][j] = left[i - 1] === right[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
        }
      }
      return table[left.length][right.length];
    };
    for (let round = 0; round < 300; round += 1) {
      const make = () => Array.from({ length: Math.floor(random() * 12) + 1 }, () => 'abcd'[Math.floor(random() * 4)]);
      const left = make();
      const right = make();
      const lines = diffLines(left.join('\n'), right.join('\n'), 1_000).flatMap((hunk) => hunk.lines);
      const context = lines.filter((line) => line.type === 'context').length;
      if (lines.length > 0) {
        expect(lines.filter((line) => line.type !== 'add').map((line) => line.text)).toEqual(left);
        expect(lines.filter((line) => line.type !== 'remove').map((line) => line.text)).toEqual(right);
        expect(context).toBe(lcsLength(left, right));
      } else {
        expect(left).toEqual(right);
      }
    }
  });

  it('reports tooDifferent=false with the same hunks for ordinary diffs', () => {
    const detailed = diffLinesDetailed('a\nb\nc', 'a\nx\nc');
    expect(detailed.tooDifferent).toBe(false);
    expect(detailed.hunks).toEqual(diffLines('a\nb\nc', 'a\nx\nc'));
  });

  it('falls back to a whole-block replacement quickly when every line of a 10k-line file differs', () => {
    const left = Array.from({ length: 10_000 }, (_, index) => `old-${index}`).join('\n');
    const right = Array.from({ length: 10_000 }, (_, index) => `  new-${index}`).join('\n');
    const startedAt = performance.now();
    const { hunks, tooDifferent } = diffLinesDetailed(left, right);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeLessThan(2_000);
    expect(tooDifferent).toBe(true);
    expect(hunks).toHaveLength(1);
    const lines = hunks[0].lines;
    expect(lines).toHaveLength(20_000);
    expect(lines.slice(0, 10_000).every((line) => line.type === 'remove')).toBe(true);
    expect(lines.slice(10_000).every((line) => line.type === 'add')).toBe(true);
    expect(lines[0]).toEqual({ type: 'remove', left: 1, text: 'old-0' });
    expect(lines[10_000]).toEqual({ type: 'add', right: 1, text: '  new-0' });
    expect(hunks[0]).toMatchObject({ oldStart: 1, oldLines: 10_000, newStart: 1, newLines: 10_000 });
  });

  it('produces a minimal diff for scattered edits in a 10k-line file', () => {
    const left = Array.from({ length: 10_000 }, (_, index) => `line-${index}`);
    const right: string[] = [];
    const expectedRemoved: string[] = [];
    const expectedAdded: string[] = [];
    left.forEach((line, index) => {
      if (index % 500 === 250) {
        expectedRemoved.push(line);
        return;
      }
      if (index % 500 === 100) {
        right.push(`edited-${index}`);
        expectedRemoved.push(line);
        expectedAdded.push(`edited-${index}`);
        return;
      }
      right.push(line);
      if (index % 500 === 400) {
        right.push(`inserted-${index}`);
        expectedAdded.push(`inserted-${index}`);
      }
    });

    const startedAt = performance.now();
    const { hunks, tooDifferent } = diffLinesDetailed(left.join('\n'), right.join('\n'));
    expect(performance.now() - startedAt).toBeLessThan(2_000);
    expect(tooDifferent).toBe(false);
    const lines = hunks.flatMap((hunk) => hunk.lines);
    expect(lines.filter((line) => line.type === 'remove').map((line) => line.text)).toEqual(expectedRemoved);
    expect(lines.filter((line) => line.type === 'add').map((line) => line.text)).toEqual(expectedAdded);
    expect(hunks).toHaveLength(60);
    for (const hunk of hunks) {
      const first = hunk.lines[0];
      expect(first.type).toBe('context');
      if (first.type === 'context') expect([hunk.oldStart, hunk.newStart]).toEqual([first.left, first.right]);
      expect(hunk.oldLines).toBe(hunk.lines.filter((line) => line.type !== 'add').length);
      expect(hunk.newLines).toBe(hunk.lines.filter((line) => line.type !== 'remove').length);
    }
  });
});
