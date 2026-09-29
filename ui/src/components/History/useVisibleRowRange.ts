import { useLayoutEffect, useState, type RefObject } from 'react';

export interface VisibleRowRange {
  readonly start: number;
  readonly end: number;
}

/** Rows rendered when the scroll container has no measurable height (tests, hidden panels). */
const UNMEASURED_ROW_BUDGET = 60;

function computeRange(container: HTMLElement | null, rowCount: number, rowHeight: number, overscan: number): VisibleRowRange {
  const height = container?.clientHeight ?? 0;
  if (!container || height <= 0) return { start: 0, end: Math.min(rowCount, UNMEASURED_ROW_BUDGET) };
  const first = Math.floor(container.scrollTop / rowHeight);
  const last = Math.ceil((container.scrollTop + height) / rowHeight);
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(rowCount, last + overscan),
  };
}

/**
 * Tracks which fixed-height rows of a list are near the viewport of its
 * scroll container (`selector` is matched with `closest` from `anchorRef`).
 * `end` is exclusive.
 */
export function useVisibleRowRange(
  anchorRef: RefObject<HTMLElement | null>,
  selector: string,
  rowCount: number,
  rowHeight: number,
  overscan = 10,
): VisibleRowRange {
  const [range, setRange] = useState<VisibleRowRange>(() => ({ start: 0, end: Math.min(rowCount, UNMEASURED_ROW_BUDGET) }));

  useLayoutEffect(() => {
    const container = anchorRef.current?.closest<HTMLElement>(selector) ?? null;
    const update = () => {
      const next = computeRange(container, rowCount, rowHeight, overscan);
      setRange((current) => (current.start === next.start && current.end === next.end ? current : next));
    };
    update();
    if (!container) return undefined;
    container.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(container);
    return () => {
      container.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [anchorRef, overscan, rowCount, rowHeight, selector]);

  return range;
}
