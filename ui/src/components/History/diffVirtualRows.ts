import { useMemo, type RefObject } from 'react';
import { useCssVars } from '../../utils/useCssVars';
import { useVisibleRowRange, type VisibleRowRange } from './useVisibleRowRange';

/** Fixed height (px) of every source-diff row, separators included; mirrored in global-history-diff.css. */
export const DIFF_ROW_HEIGHT = 20;

/**
 * Scroll containers that host source diffs: the file history modal body, split panes and the
 * main content area. The diff table itself never scrolls vertically.
 */
export const DIFF_SCROLL_CONTAINER_SELECTOR = '.file-history__diff-body, .split-document-pane__scroll, .content__scroll';

/** Generous overscan: rows start below the diff toolbar/header, which the range math ignores. */
const DIFF_ROW_OVERSCAN = 20;

/**
 * Windows a fixed-height diff table and publishes the spacer heights as
 * `--{prefix}-rows-before` / `--{prefix}-rows-after` on `tableRef`.
 */
export function useDiffRowWindow(
  tableRef: RefObject<HTMLTableElement | null>,
  rowCount: number,
  prefix: string,
): VisibleRowRange {
  const range = useVisibleRowRange(tableRef, DIFF_SCROLL_CONTAINER_SELECTOR, rowCount, DIFF_ROW_HEIGHT, DIFF_ROW_OVERSCAN);
  const { start, end } = range;
  const variables = useMemo(() => ({
    [`--${prefix}-rows-before`]: `${start * DIFF_ROW_HEIGHT}px`,
    [`--${prefix}-rows-after`]: `${Math.max(0, rowCount - end) * DIFF_ROW_HEIGHT}px`,
  }), [end, prefix, rowCount, start]);
  useCssVars(tableRef, variables);
  return range;
}
