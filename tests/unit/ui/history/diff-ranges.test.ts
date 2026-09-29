import { describe, expect, it } from 'vitest';
import { changedCharacterRanges } from '../../../../ui/src/history/diffRanges';
import { diffLines } from '../../../../ui/src/history/lineDiff';

describe('changedCharacterRanges', () => {
  it('maps removed and added lines to source character offsets', () => {
    const left = '# Title\n\nold value\nend';
    const right = '# Title\n\nnew value\nend';
    const hunks = diffLines(left, right);

    expect(changedCharacterRanges(left, hunks, 'left')).toEqual([
      { start: left.indexOf('old value'), end: left.indexOf('old value') + 'old value'.length },
    ]);
    expect(changedCharacterRanges(right, hunks, 'right')).toEqual([
      { start: right.indexOf('new value'), end: right.indexOf('new value') + 'new value'.length },
    ]);
  });

  it('merges adjacent changed line ranges', () => {
    const left = 'one\ntwo\nthree\nfour';
    const right = 'one\nTWO\nTHREE\nfour';
    const ranges = changedCharacterRanges(left, diffLines(left, right), 'left');
    expect(ranges).toEqual([{ start: left.indexOf('two'), end: left.indexOf('three') + 'three'.length }]);
  });

  it('returns no ranges for identical sources', () => {
    expect(changedCharacterRanges('same', diffLines('same', 'same'), 'left')).toEqual([]);
  });
});
