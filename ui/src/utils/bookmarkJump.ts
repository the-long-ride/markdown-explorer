import { projectMarkdownSource } from '../bookmarks/bookmarkDomAnchors.ts';
import type { BookmarkRecord, BookmarkResolution } from '../bookmarks/types.ts';

const ACTIVE_CLASS = 'mdn-bookmark-jump-target';
const MARK_CLASS = 'mdn-bookmark-jump-mark';
const HIGHLIGHT_NAME = 'mdn-bookmark-jump';
let clearTimer = 0;

export function sourceRangeToRenderedOffsets(source: string, sourceStart: number, sourceEnd: number): { start: number; end: number } {
  const projection = projectMarkdownSource(source);
  const nearest = (offset: number, preferEnd: boolean) => {
    let result = preferEnd ? projection.text.length : 0;
    for (let index = 0; index < projection.boundaries.length; index += 1) {
      const boundary = projection.boundaries[index];
      if (boundary >= offset) return index;
      result = index;
    }
    return result;
  };
  const start = nearest(Math.max(0, sourceStart), false);
  return { start, end: Math.max(start, nearest(Math.max(sourceStart, sourceEnd), true)) };
}

function jumpRoot(): HTMLElement | null {
  return document.getElementById('mdBody');
}

export function clearBookmarkJumpMarks(root = jumpRoot()): void {
  if (clearTimer) window.clearTimeout(clearTimer);
  clearTimer = 0;
  if (root) {
    root.querySelectorAll<HTMLElement>(`.${ACTIVE_CLASS}`).forEach((element) => element.classList.remove(ACTIVE_CLASS));
    root.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`).forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    });
  }
  const highlights = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  highlights?.delete(HIGHLIGHT_NAME);
}

function sourceRange(element: Element): { start: number; end: number } | null {
  const start = Number(element.getAttribute('data-mdn-source-start'));
  const end = Number(element.getAttribute('data-mdn-source-end'));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { start, end } : null;
}

function findSourceElement(root: HTMLElement, start: number, end: number): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]')]
    .map((element) => ({ element, range: sourceRange(element) }))
    .filter((entry): entry is { element: HTMLElement; range: { start: number; end: number } } => Boolean(entry.range && entry.range.start <= start && entry.range.end >= end))
    .sort((left, right) => (left.range.end - left.range.start) - (right.range.end - right.range.start))[0]?.element ?? null;
}

function acceptedTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!node.nodeValue || !parent || parent.closest('button,svg,script,style,iframe,[aria-hidden="true"],.mdn-codeblock-gutter')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as Text | null;
  while (node) { nodes.push(node); node = walker.nextNode() as Text | null; }
  return nodes;
}

function domPoint(nodes: readonly Text[], offset: number): { node: Text; offset: number } | null {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    if (offset <= consumed + length) return { node, offset: Math.max(0, offset - consumed) };
    consumed += length;
  }
  const last = nodes.length > 0 ? nodes[nodes.length - 1] : undefined;
  return last ? { node: last, offset: last.nodeValue?.length ?? 0 } : null;
}

function markRange(range: Range, fallback: HTMLElement): HTMLElement {
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    const mark = document.createElement('mark');
    mark.className = MARK_CLASS;
    try {
      range.surroundContents(mark);
      return mark;
    } catch { /* use highlight/fallback below */ }
  }
  const HighlightConstructor = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  const highlights = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  if (HighlightConstructor && highlights) highlights.set(HIGHLIGHT_NAME, new HighlightConstructor(range));
  fallback.classList.add(ACTIVE_CLASS);
  return fallback;
}

function objectTarget(root: HTMLElement, bookmark: BookmarkRecord, resolution: Extract<BookmarkResolution, { status: 'resolved' }>): HTMLElement | null {
  const exact = [...root.querySelectorAll<HTMLElement>(`[data-mdn-bookmark-kind="${bookmark.targetKind}"]`)].find((element) => {
    const range = sourceRange(element);
    return range?.start === resolution.sourceStart && range.end === resolution.sourceEnd;
  });
  if (exact) return exact;
  const sourceElement = findSourceElement(root, resolution.sourceStart, resolution.sourceEnd);
  if (!sourceElement) return null;
  const candidates = [...sourceElement.querySelectorAll<HTMLElement>(`[data-mdn-bookmark-kind="${bookmark.targetKind}"]`)];
  return candidates[resolution.occurrence] ?? candidates[0] ?? sourceElement;
}

export function scrollToBookmarkTarget(
  bookmark: BookmarkRecord,
  resolution: BookmarkResolution,
  source: string,
  root = jumpRoot(),
): boolean {
  clearBookmarkJumpMarks(root);
  if (!root || resolution.status !== 'resolved') return false;

  if (bookmark.targetKind !== 'text') {
    const object = objectTarget(root, bookmark, resolution);
    if (!object) return false;
    object.classList.add(ACTIVE_CLASS);
    object.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    clearTimer = window.setTimeout(() => clearBookmarkJumpMarks(root), 2400);
    return true;
  }

  const element = findSourceElement(root, resolution.sourceStart, resolution.sourceEnd);
  const elementRange = element ? sourceRange(element) : null;
  if (!element || !elementRange) return false;
  const fragment = source.slice(elementRange.start, elementRange.end);
  const offsets = sourceRangeToRenderedOffsets(fragment, resolution.sourceStart - elementRange.start, resolution.sourceEnd - elementRange.start);
  const nodes = acceptedTextNodes(element);
  const start = domPoint(nodes, offsets.start);
  const end = domPoint(nodes, offsets.end);
  if (!start || !end) return false;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const target = markRange(range, element);
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  clearTimer = window.setTimeout(() => clearBookmarkJumpMarks(root), 2400);
  return true;
}
