import { diffLines, type DiffHunk, type DiffLine } from './lineDiff';

export interface SplitDiffCell<T extends DiffLine['type']> {
  readonly line: number;
  readonly text: string;
  readonly type: T;
}

export interface SplitDiffRow {
  readonly hunk: number;
  readonly left?: SplitDiffCell<'context' | 'remove'>;
  readonly right?: SplitDiffCell<'context' | 'add'>;
}

/**
 * Side-by-side rows for a line diff: context lines sit on both sides, and each
 * run of removals is zipped with the run of additions that follows it.
 */
export function splitDiffRows(left: string, right: string): readonly SplitDiffRow[] {
  return splitDiffRowsFromHunks(diffLines(left, right));
}

/** `splitDiffRows` for hunks the caller already computed (e.g. via `diffLinesDetailed`). */
export function splitDiffRowsFromHunks(hunks: readonly DiffHunk[]): readonly SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    let removed: SplitDiffCell<'remove'>[] = [];
    let added: SplitDiffCell<'add'>[] = [];
    const flush = () => {
      for (let index = 0; index < Math.max(removed.length, added.length); index += 1) {
        rows.push({
          hunk: hunkIndex,
          ...(removed[index] ? { left: removed[index] } : {}),
          ...(added[index] ? { right: added[index] } : {}),
        });
      }
      removed = [];
      added = [];
    };
    for (const line of hunk.lines) {
      if (line.type === 'remove') {
        if (added.length > 0) flush();
        removed.push({ line: line.left, text: line.text, type: 'remove' });
      } else if (line.type === 'add') {
        added.push({ line: line.right, text: line.text, type: 'add' });
      } else {
        flush();
        rows.push({
          hunk: hunkIndex,
          left: { line: line.left, text: line.text, type: 'context' },
          right: { line: line.right, text: line.text, type: 'context' },
        });
      }
    }
    flush();
  });
  return rows;
}
