import type { MarkdownSelection } from './markdownFormatting';
import { findTableRanges } from './tableEditor';

export interface MarkdownSourceRange {
  readonly start: number;
  readonly end: number;
}

export interface TextareaHistorySnapshot {
  readonly text: string;
  readonly selection?: MarkdownSelection;
}

export interface TextareaHistoryState {
  readonly past: TextareaHistorySnapshot[];
  readonly future: TextareaHistorySnapshot[];
}

export const INITIAL_TEXTAREA_HISTORY: TextareaHistoryState = { past: [], future: [] };

export function pushTextareaSnapshot(
  history: TextareaHistoryState,
  snapshot: TextareaHistorySnapshot,
): TextareaHistoryState {
  return {
    past: [...history.past, snapshot],
    future: [],
  };
}

export function undoTextareaStep(
  history: TextareaHistoryState,
  current: TextareaHistorySnapshot,
): { state: TextareaHistoryState; snapshot: TextareaHistorySnapshot } | null {
  if (history.past.length === 0) return null;
  const target = history.past[history.past.length - 1];
  return {
    state: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
    snapshot: target,
  };
}

export function redoTextareaStep(
  history: TextareaHistoryState,
  current: TextareaHistorySnapshot,
): { state: TextareaHistoryState; snapshot: TextareaHistorySnapshot } | null {
  if (history.future.length === 0) return null;
  const target = history.future[0];
  return {
    state: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
    snapshot: target,
  };
}

export const MIN_INLINE_ROWS = 3;
export const MAX_INLINE_ROWS = 24;

export function anchorFor(target: HTMLElement): HTMLElement {
  if (!target.classList.contains('mdn-heading-text')) return target;
  return target.closest<HTMLElement>('h1, h2, h3, h4, h5, h6') ?? target;
}

export function rowsFor(draft: string): number {
  return Math.min(MAX_INLINE_ROWS, Math.max(MIN_INLINE_ROWS, draft.split('\n').length + 1));
}

export function isTableTarget(target: HTMLElement, initialDraft: string): boolean {
  if (target.classList.contains('mdn-table-source') || Boolean(target.closest('.mdn-table-source'))) return true;
  return findTableRanges(initialDraft).length > 0;
}

function isValidRange(range: MarkdownSourceRange, sourceLength: number): boolean {
  return Number.isInteger(range.start)
    && Number.isInteger(range.end)
    && range.start >= 0
    && range.end >= range.start
    && range.end <= sourceLength;
}

export function readEditableRange(
  element: Element,
  sourceLength: number,
): MarkdownSourceRange | null {
  const startAttr = element.getAttribute('data-mdn-source-start');
  const endAttr = element.getAttribute('data-mdn-source-end');
  if (startAttr === null || endAttr === null) return null;

  const range = {
    start: Number(startAttr),
    end: Number(endAttr),
  };
  return isValidRange(range, sourceLength) ? range : null;
}

export function replaceSourceRange(
  source: string,
  range: MarkdownSourceRange,
  replacement: string,
): string {
  if (!isValidRange(range, source.length)) {
    throw new Error('Invalid Markdown source range');
  }
  return source.slice(0, range.start) + replacement + source.slice(range.end);
}
