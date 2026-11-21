import { HEADING_SECTION_STATE_CHANGE_EVENT } from '../dom/headingSectionHandlers';
import { setHeadingSectionExpanded } from '../components/Content/enhancements/headingSectionState';
import { findNextInText } from './searchJumpResolver';

export const SEARCH_JUMP_MARK_CLASS = 'mdn-search-jump-mark';
export const SEARCH_JUMP_TARGET_CLASS = 'mdn-search-jump-target';

export const SKIP_CHROME_SELECTOR = [
  'mark.mdn-find-mark',
  'button',
  'input',
  'textarea',
  'select',
  'script',
  'style',
  'iframe',
  'svg',
  'canvas',
  'template',
  '.mdn-line-numbers',
  '.mdn-codeblock-gutter',
  '.mdn-codeblock-header',
  '.mdn-heading-level',
  '.mdn-table-toolbar',
  '.mdn-th-actions',
  '.mdn-filter-dropdown',
  '.mdn-align-dropdown',
  '.mdn-table-columns-menu',
  '.mdn-table-view-menu',
  '.tooltip-text',
  '.toc-compact',
  '.document-preview-notice',
  '[aria-hidden="true"]',
].join(',');

const BLOCK_BOUNDARY_SELECTOR = 'td,th,tr,p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,div,section,article,summary,dt,dd';

export interface TextSlice {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
}

export interface DomTextMatch {
  readonly slices: readonly TextSlice[];
  readonly cumulativeTextOffset: number;
  readonly matchLength: number;
  readonly firstNode: Text;
}

export interface TextStream {
  readonly raw: string;
  readonly rawMap: ReadonlyArray<{ node: Text | null; offset: number }>;
  readonly collapsed: string;
  readonly collapsedRanges: ReadonlyArray<{ start: number; end: number }>;
}

function shouldSkipStreamTextNode(node: Text, includeHiddenCodeSource: boolean): boolean {
  if (!node.nodeValue) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(`mark.${SEARCH_JUMP_MARK_CLASS},mark.mdn-search-jump-mark-secondary,${SKIP_CHROME_SELECTOR}`)) {
    return true;
  }
  if (!includeHiddenCodeSource) {
    const codeSource = parent.closest<HTMLElement>('.mdn-code-source');
    const codeBlock = codeSource?.closest<HTMLElement>('.mdn-codeblock');
    if (codeSource && codeBlock?.dataset.mode === 'preview') return true;
    const previewBody = parent.closest<HTMLElement>('.mdn-csv-preview-body, .mdn-html-preview-body');
    const previewBlock = previewBody?.closest<HTMLElement>('.mdn-codeblock');
    if (previewBody && previewBlock?.dataset.mode === 'code') return true;
  }
  return false;
}

export function buildTextStream(container: HTMLElement, includeHiddenCodeSource: boolean): TextStream {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldSkipStreamTextNode(node as Text, includeHiddenCodeSource)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  const chars: string[] = [];
  const rawMap: Array<{ node: Text | null; offset: number }> = [];
  let prevOwner: Element | null = null;
  let prevEndedWithSpace = true;

  let current = walker.nextNode() as Text | null;
  while (current) {
    const value = current.nodeValue ?? '';
    const owner = current.parentElement?.closest(BLOCK_BOUNDARY_SELECTOR) ?? current.parentElement;
    const startsWithSpace = /^\s/.test(value);
    if (prevOwner && owner !== prevOwner && !prevEndedWithSpace && !startsWithSpace && chars.length > 0) {
      chars.push(' ');
      rawMap.push({ node: null, offset: -1 });
    }
    for (let index = 0; index < value.length; index += 1) {
      chars.push(value[index]);
      rawMap.push({ node: current, offset: index });
    }
    prevOwner = owner;
    prevEndedWithSpace = /\s$/.test(value);
    current = walker.nextNode() as Text | null;
  }

  const raw = chars.join('');
  const collapsedChars: string[] = [];
  const collapsedRanges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor < raw.length) {
    if (/\s/.test(raw[cursor])) {
      const start = cursor;
      while (cursor < raw.length && /\s/.test(raw[cursor])) cursor += 1;
      if (collapsedChars.length > 0 && cursor < raw.length) {
        collapsedChars.push(' ');
        collapsedRanges.push({ start, end: cursor });
      }
    } else {
      collapsedChars.push(raw[cursor]);
      collapsedRanges.push({ start: cursor, end: cursor + 1 });
      cursor += 1;
    }
  }

  return { raw, rawMap, collapsed: collapsedChars.join(''), collapsedRanges };
}

function slicesFromRawRange(stream: TextStream, start: number, end: number): TextSlice[] {
  const slices: TextSlice[] = [];
  let activeNode: Text | null = null;
  let sliceStart = 0;
  let sliceEnd = 0;

  const flush = () => {
    if (activeNode && sliceEnd > sliceStart) {
      slices.push({ node: activeNode, start: sliceStart, end: sliceEnd });
    }
    activeNode = null;
  };

  for (let index = start; index < end && index < stream.rawMap.length; index += 1) {
    const entry = stream.rawMap[index];
    if (!entry.node) {
      flush();
      continue;
    }
    if (entry.node === activeNode && entry.offset === sliceEnd) {
      sliceEnd += 1;
    } else {
      flush();
      activeNode = entry.node;
      sliceStart = entry.offset;
      sliceEnd = entry.offset + 1;
    }
  }
  flush();
  return slices;
}

export function findMatchesInStream(stream: TextStream, needle: string, matchCase: boolean): DomTextMatch[] {
  const matches: DomTextMatch[] = [];
  if (!needle) return matches;

  let cursor = 0;
  while (cursor < stream.raw.length) {
    const hit = findNextInText(stream.raw, needle, cursor, matchCase);
    if (!hit) break;
    const slices = slicesFromRawRange(stream, hit.index, hit.index + hit.matchLength);
    if (slices.length > 0) {
      matches.push({
        slices,
        cumulativeTextOffset: hit.index,
        matchLength: hit.matchLength,
        firstNode: slices[0].node,
      });
    }
    cursor = hit.index + Math.max(1, hit.matchLength);
  }
  if (matches.length > 0) return matches;

  const normalizedNeedle = needle.replace(/\s+/g, ' ').trim();
  if (!normalizedNeedle) return matches;
  cursor = 0;
  while (cursor < stream.collapsed.length) {
    const hit = findNextInText(stream.collapsed, normalizedNeedle, cursor, matchCase);
    if (!hit) break;
    const rawStart = stream.collapsedRanges[hit.index]?.start ?? 0;
    const rawEnd = stream.collapsedRanges[hit.index + hit.matchLength - 1]?.end ?? rawStart;
    const slices = slicesFromRawRange(stream, rawStart, rawEnd);
    if (slices.length > 0) {
      matches.push({
        slices,
        cumulativeTextOffset: rawStart,
        matchLength: Math.max(1, rawEnd - rawStart),
        firstNode: slices[0].node,
      });
    }
    cursor = hit.index + Math.max(1, hit.matchLength);
  }
  return matches;
}

export function findMatchesWithCandidates(
  container: HTMLElement,
  candidates: readonly string[],
  matchCase: boolean,
  includeHiddenCodeSource: boolean,
): { matches: DomTextMatch[]; stream: TextStream; candidate: string } | null {
  const stream = buildTextStream(container, includeHiddenCodeSource);
  for (const candidate of candidates) {
    const matches = findMatchesInStream(stream, candidate, matchCase);
    if (matches.length > 0) return { matches, stream, candidate };
  }
  return null;
}

function revealTableRow(element: HTMLElement, win: any): void {
  const row = element.closest<HTMLTableRowElement>('tr');
  const table = row?.closest<HTMLTableElement>('table.mdn-table') ?? element.closest<HTMLTableElement>('table.mdn-table');
  if (!table) return;
  const tableId = table.id;
  const tableWrap = table.closest<HTMLElement>('.mdn-table-wrap');
  if (tableId && win?.Table?.states?.[tableId]?.currentView && win.Table.states[tableId].currentView !== 'table') {
    win.Table.switchView?.(tableId, 'table');
  }
  if (!row || (!row.classList.contains('is-collapsed-row') && !row.classList.contains('is-hidden'))) return;
  if (tableId && win?.Table?.initState && win?.Table?.applyAllFilters) {
    const tableState = win.Table.initState(tableId);
    if (row.classList.contains('is-hidden')) {
      tableState.searchQuery = '';
      tableState.filters = {};
      const input = tableWrap?.querySelector<HTMLInputElement>('.mdn-table-input');
      if (input) input.value = '';
    }
    tableState.expanded = true;
    win.Table.applyAllFilters(tableId);
    return;
  }
  table.querySelectorAll<HTMLElement>('tbody tr').forEach((tr) => {
    tr.classList.remove('is-collapsed-row', 'is-hidden');
    tr.dataset.mdnFilterMatch = 'true';
  });
  tableWrap?.querySelector<HTMLElement>('.mdn-table-toggle-btn')?.classList.add('is-expanded');
}

function revealCodeBlock(element: HTMLElement, win: any): void {
  const codeSource = element.closest<HTMLElement>('.mdn-code-source');
  const codeBlock = element.closest<HTMLElement>('.mdn-codeblock');
  if (codeSource && codeBlock?.dataset.mode === 'preview') {
    const htmlToggle = codeBlock.querySelector<HTMLElement>('.mdn-toggle-preview-btn');
    const csvToggle = codeBlock.querySelector<HTMLElement>('.mdn-toggle-csv-btn');
    if (htmlToggle && win?.UI?.toggleHtmlMode) {
      win.UI.toggleHtmlMode(htmlToggle);
    } else if (csvToggle && win?.UI?.toggleCsvMode) {
      win.UI.toggleCsvMode(csvToggle);
    } else {
      codeBlock.dataset.mode = 'code';
      codeSource.style.display = '';
      const previewBody = codeBlock.querySelector<HTMLElement>('.mdn-html-preview-body, .mdn-csv-preview-body');
      if (previewBody) previewBody.style.display = 'none';
    }
  }
  if (codeBlock?.dataset.collapsed === 'true') {
    const toggleBtn = codeBlock.querySelector<HTMLElement>(':scope > .mdn-codeblock-toggle-btn');
    if (toggleBtn && win?.UI?.toggleCodeCollapse) {
      win.UI.toggleCodeCollapse(toggleBtn);
    } else {
      codeBlock.dataset.collapsed = 'false';
      if (toggleBtn?.dataset.labelShowLess) toggleBtn.textContent = toggleBtn.dataset.labelShowLess;
    }
  }
}

export function revealElementAncestors(element: HTMLElement): void {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;

  let section = element.closest<HTMLElement>('.mdn-section');
  while (section) {
    if (section.getAttribute('data-expanded') !== 'true') {
      setHeadingSectionExpanded(section, true);
      window.dispatchEvent(new CustomEvent(HEADING_SECTION_STATE_CHANGE_EVENT, {
        detail: { section, expanded: true },
      }));
    }
    section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }

  let details = element.closest<HTMLDetailsElement>('details');
  while (details) {
    details.open = true;
    details = details.parentElement?.closest<HTMLDetailsElement>('details') ?? null;
  }

  revealTableRow(element, win);
  revealCodeBlock(element, win);
}

export function wrapMatches(matches: readonly DomTextMatch[], selectedMatchIndex: number): HTMLElement | null {
  const nodeSlicesMap = new Map<Text, Array<{ start: number; end: number; isPrimary: boolean }>>();

  for (let index = 0; index < matches.length; index += 1) {
    const isPrimary = index === selectedMatchIndex;
    for (const slice of matches[index].slices) {
      let list = nodeSlicesMap.get(slice.node);
      if (!list) {
        list = [];
        nodeSlicesMap.set(slice.node, list);
      }
      list.push({ start: slice.start, end: slice.end, isPrimary });
    }
  }

  let activeMark: HTMLElement | null = null;

  for (const [textNode, slices] of nodeSlicesMap.entries()) {
    const parent = textNode.parentNode;
    if (!parent) continue;
    slices.sort((left, right) => left.start - right.start);

    const text = textNode.nodeValue ?? '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const slice of slices) {
      if (slice.start < cursor || slice.end <= slice.start) continue;
      if (slice.start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, slice.start)));
      }
      const mark = document.createElement('mark');
      mark.textContent = text.slice(slice.start, slice.end);
      if (slice.isPrimary) {
        mark.className = SEARCH_JUMP_MARK_CLASS;
        if (!activeMark) activeMark = mark;
      } else {
        mark.className = 'mdn-search-jump-mark-secondary';
      }
      fragment.appendChild(mark);
      cursor = slice.end;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    parent.replaceChild(fragment, textNode);
  }

  return activeMark;
}

export function scrollToActiveElement(target: HTMLElement, isTextMark: boolean): void {
  revealElementAncestors(target);

  const isMarkVisible = (el: HTMLElement): boolean => {
    const scrollContainer = el.closest<HTMLElement>(
      '[data-search-scroll-container], .content__scroll, .split-document-pane__scroll',
    );
    if (!scrollContainer) return false;
    const markRect = el.getBoundingClientRect();
    if (markRect.top === 0 && markRect.bottom === 0 && markRect.width === 0 && markRect.height === 0) {
      return false;
    }
    const containerRect = scrollContainer.getBoundingClientRect();
    return markRect.top >= containerRect.top - 20 && markRect.bottom <= containerRect.bottom + 20;
  };

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  for (const delay of [250, 600]) {
    window.setTimeout(() => {
      if (!target.isConnected) return;
      revealElementAncestors(target);
      if (!isMarkVisible(target)) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, delay);
  }

  if (isTextMark) {
    window.setTimeout(() => target.classList.add('is-active'), 120);
  }
}
