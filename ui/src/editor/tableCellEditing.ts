import { type Extension, Prec, type StateField } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { applyMarkdownFormat, type MarkdownFormatCommand } from './markdownFormatting';
import { findTableRanges } from './tableEditor';

const BULLET_LINE_RE = /^\s*(?:•|[-*+])\s+(.*)$/;
export const TABLE_CELL_COMMIT_EVENT = 'cm-table-cell-commit';

function maskInlineCodeSpans(raw: string): { maskedText: string; spans: string[] } {
  const spans: string[] = [];
  let out = '';
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === '`' && (i === 0 || raw[i - 1] !== '\\')) {
      let tickLen = 1;
      while (raw[i + tickLen] === '`') tickLen++;
      let closeIdx = -1;
      let j = i + tickLen;
      while (j < raw.length) {
        if (raw[j] === '`') {
          let runLen = 1;
          while (raw[j + runLen] === '`') runLen++;
          if (runLen === tickLen) {
            closeIdx = j;
            break;
          }
          j += runLen;
          continue;
        }
        j++;
      }
      if (closeIdx !== -1) {
        const end = closeIdx + tickLen;
        const placeholder = `\uE000${spans.length}\uE001`;
        spans.push(raw.slice(i, end));
        out += placeholder;
        i = end;
        continue;
      }
      out += raw.slice(i, i + tickLen);
      i += tickLen;
      continue;
    }
    out += raw[i];
    i++;
  }

  return { maskedText: out, spans };
}

export function markdownCellToDisplayText(raw: string): string {
  const { maskedText, spans } = maskInlineCodeSpans(raw);
  const withNewlines = maskedText.replace(/<br\s*\/?>/gi, '\n');
  const withBullets = withNewlines.replace(
    /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
    (match: string, inner: string, offset: number, full: string) => {
      const items: string[] = [];
      for (const li of inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
        items.push(`• ${li[1].trim()}`);
      }
      if (items.length === 0) return '';
      const prev = offset > 0 ? full[offset - 1] : '';
      const next = offset + match.length < full.length ? full[offset + match.length] : '';
      const prefix = prev && prev !== '\n' ? '\n' : '';
      const suffix = next && next !== '\n' ? '\n' : '';
      return `${prefix}${items.join('\n')}${suffix}`;
    },
  );
  return withBullets.replace(/\uE000(\d+)\uE001/g, (_, idx) => spans[Number(idx)] ?? '');
}

export function displayTextToMarkdownCell(displayText: string): string {
  const lines = displayText.replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 1) {
    const match = lines[0].match(BULLET_LINE_RE);
    return match ? `<ul><li>${match[1].trim()}</li></ul>` : lines[0];
  }

  const blocks: string[] = [];
  let bulletItems: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length > 0) {
      blocks.push(`<ul>${bulletItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      bulletItems = [];
    }
  };

  for (const line of lines) {
    const match = line.match(BULLET_LINE_RE);
    if (match) {
      bulletItems.push(match[1].trim());
    } else {
      flushBullets();
      blocks.push(line);
    }
  }
  flushBullets();

  return blocks.join('<br>');
}

export function getCellSelectionOffsets(cell: HTMLElement): { start: number; end: number } {
  const len = (cell.textContent ?? '').length;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (cell.contains(range.startContainer) && cell.contains(range.endContainer)) {
      const preStart = document.createRange();
      preStart.selectNodeContents(cell);
      preStart.setEnd(range.startContainer, range.startOffset);
      const preEnd = document.createRange();
      preEnd.selectNodeContents(cell);
      preEnd.setEnd(range.endContainer, range.endOffset);
      const a = Math.max(0, Math.min(len, preStart.toString().length));
      const b = Math.max(0, Math.min(len, preEnd.toString().length));
      return { start: Math.min(a, b), end: Math.max(a, b) };
    }
  }
  return { start: len, end: len };
}

export function setCellCaretOffset(cell: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const text = cell.textContent ?? '';
  const clamped = Math.max(0, Math.min(text.length, offset));
  const range = document.createRange();
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  let remaining = clamped;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const nodeLen = node.data.length;
    if (remaining <= nodeLen) {
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= nodeLen;
    node = walker.nextNode() as Text | null;
  }

  range.setStart(cell, cell.childNodes.length);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function getLineStart(text: string, offset: number): number {
  return offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
}

export function applyCellShiftEnter(cell: HTMLElement): void {
  const text = cell.textContent ?? '';
  const { start, end } = getCellSelectionOffsets(cell);
  const lineStart = getLineStart(text, start);
  const lineBeforeCaret = text.slice(lineStart, start);
  const isBullet = /^\s*(?:•|[-*+])\s+/.test(lineBeforeCaret);
  const insert = isBullet ? '\n• ' : '\n';
  cell.textContent = text.slice(0, start) + insert + text.slice(end);
  setCellCaretOffset(cell, start + insert.length);
}

export function applyCellAltEnter(cell: HTMLElement): void {
  const text = cell.textContent ?? '';
  const { start, end } = getCellSelectionOffsets(cell);
  const nextNl = text.indexOf('\n', end);
  const lineEnd = nextNl === -1 ? text.length : nextNl;
  const lineStart = getLineStart(text, start);
  const currentLine = text.slice(lineStart, lineEnd);
  const bulletPrefix = /^\s*(?:•|[-*+])\s+/.test(currentLine) ? '• ' : '';
  const insert = `\n${bulletPrefix}`;
  cell.textContent = text.slice(0, lineEnd) + insert + text.slice(lineEnd);
  setCellCaretOffset(cell, lineEnd + insert.length);
}

export function normalizeCellLiveInput(cell: HTMLElement): void {
  const text = cell.textContent ?? '';
  const { start, end } = getCellSelectionOffsets(cell);
  if (start !== end) return;
  const lineStart = getLineStart(text, start);
  const prefix = text.slice(lineStart, start);
  if (prefix === '- ' || prefix === '* ') {
    cell.textContent = text.slice(0, lineStart) + '• ' + text.slice(lineStart + 2);
    setCellCaretOffset(cell, start);
  }
}

export function toggleCellBulletList(cell: HTMLElement): string {
  const lines = (cell.textContent ?? '').replace(/\r\n/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const allBullets = nonEmpty.length > 0 && nonEmpty.every((l) => BULLET_LINE_RE.test(l));

  const nextLines = lines.map((line) => {
    if (allBullets) return line.replace(/^\s*(?:•|[-*+])\s+/, '');
    const match = line.match(BULLET_LINE_RE);
    if (match) return `• ${match[1]}`;
    if (lines.length === 1 || line.length > 0) return `• ${line}`;
    return line;
  });

  const nextDisplay = nextLines.join('\n');
  cell.textContent = nextDisplay;
  setCellCaretOffset(cell, nextDisplay.length);
  return displayTextToMarkdownCell(nextDisplay);
}

export function formatFocusedTableCell(host: HTMLElement | null, command: MarkdownFormatCommand): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!host || !active || !active.classList.contains('cm-table-cell') || !host.contains(active)) {
    return false;
  }

  if (command === 'bullet-list') {
    toggleCellBulletList(active);
    active.dispatchEvent(new CustomEvent(TABLE_CELL_COMMIT_EVENT, { bubbles: true }));
    return true;
  }

  if (command === 'bold' || command === 'italic' || command === 'underline' || command === 'inline-code') {
    const text = active.textContent ?? '';
    const { start, end } = getCellSelectionOffsets(active);
    const result = applyMarkdownFormat(text, { from: start, to: end }, command);
    active.textContent = result.source;
    setCellCaretOffset(active, result.selection.to);
    active.dispatchEvent(new CustomEvent(TABLE_CELL_COMMIT_EVENT, { bubbles: true }));
    return true;
  }

  return false;
}

export interface TableCellKeyDownContext {
  e: KeyboardEvent;
  target: HTMLElement;
  rowCount: number;
  colCount: number;
  focusCell: (row: number, col: number) => void;
  commitBeforeExit: (target: HTMLElement) => number;
  onExitBelow: (to: number) => void;
  onExitAbove: () => void;
  onInsertRowBelow: (rowIdx: number) => void;
}

export function handleTableCellKeyDown(ctx: TableCellKeyDownContext): boolean {
  const { e, target, rowCount, colCount, focusCell, commitBeforeExit, onExitBelow, onExitAbove, onInsertRowBelow } = ctx;
  const rIdx = parseInt(target.getAttribute('data-row') ?? '0', 10);
  const cIdx = parseInt(target.getAttribute('data-col') ?? '0', 10);
  const isLastRow = rIdx === rowCount - 1;
  const noMods = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

  if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    applyCellShiftEnter(target);
    return true;
  }

  if (e.key === 'Enter' && e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    applyCellAltEnter(target);
    return true;
  }

  if ((e.key === 'Enter' || e.key === 'ArrowDown') && noMods) {
    e.preventDefault();
    if (rIdx === -1) {
      if (rowCount > 0) focusCell(0, cIdx);
      else onExitBelow(commitBeforeExit(target));
    } else if (!isLastRow) {
      focusCell(rIdx + 1, cIdx);
    } else {
      onExitBelow(commitBeforeExit(target));
    }
    return true;
  }

  if (e.key === 'ArrowUp' && noMods) {
    e.preventDefault();
    if (rIdx > 0) focusCell(rIdx - 1, cIdx);
    else if (rIdx === 0) focusCell(-1, cIdx);
    else {
      commitBeforeExit(target);
      onExitAbove();
    }
    return true;
  }

  if (e.key === 'ArrowRight' && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    if (cIdx + 1 < colCount) focusCell(rIdx, cIdx + 1);
    else if (rIdx === -1 && rowCount > 0) focusCell(0, 0);
    else if (rIdx + 1 < rowCount) focusCell(rIdx + 1, 0);
    else onExitBelow(commitBeforeExit(target));
    return true;
  }

  if (e.key === 'ArrowLeft' && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    const lastCol = colCount - 1;
    if (cIdx > 0) focusCell(rIdx, cIdx - 1);
    else if (rIdx > 0) focusCell(rIdx - 1, lastCol);
    else if (rIdx === 0) focusCell(-1, lastCol);
    else {
      commitBeforeExit(target);
      onExitAbove();
    }
    return true;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (!e.shiftKey) {
      if (cIdx + 1 < colCount) focusCell(rIdx, cIdx + 1);
      else if (rIdx + 1 < rowCount) focusCell(rIdx + 1, 0);
      else onInsertRowBelow(rIdx);
    } else {
      if (cIdx > 0) focusCell(rIdx, cIdx - 1);
      else if (rIdx > 0) focusCell(rIdx - 1, colCount - 1);
      else if (rIdx === 0) focusCell(-1, colCount - 1);
    }
    return true;
  }

  return false;
}

export function focusTableCellAtEdge(
  viewDom: HTMLElement,
  tableFrom: number,
  edge: 'first' | 'last',
): boolean {
  const prefix = `[data-table-from="${tableFrom}"]`;
  const cell =
    edge === 'first'
      ? viewDom.querySelector<HTMLElement>(`${prefix} [data-row="-1"][data-col="0"]`)
      : (viewDom.querySelector<HTMLElement>(`${prefix} tbody tr:last-child td:last-child`) ??
        viewDom.querySelector<HTMLElement>(`${prefix} thead tr:last-child th:last-child`));
  if (!cell) return false;
  cell.focus();
  setCellCaretOffset(cell, (cell.textContent ?? '').length);
  return true;
}

function enterAdjacentTable(
  view: EditorView,
  rawTableOffsetsField: StateField<Set<number>>,
  edge: 'first' | 'last',
): boolean {
  const { from, empty } = view.state.selection.main;
  if (!empty) return false;
  const line = view.state.doc.lineAt(from);
  const rawOffsets = view.state.field(rawTableOffsetsField);
  const target = findTableRanges(view.state.doc.toString()).find(
    (r) => !rawOffsets.has(r.from) && (edge === 'first' ? r.from === line.to + 1 : r.to === line.from - 1),
  );
  return target ? focusTableCellAtEdge(view.dom, target.from, edge) : false;
}

export function createTableBoundaryKeymap(rawTableOffsetsField: StateField<Set<number>>): Extension {
  return Prec.high(
    keymap.of([
      { key: 'ArrowDown', run: (view) => enterAdjacentTable(view, rawTableOffsetsField, 'first') },
      { key: 'ArrowUp', run: (view) => enterAdjacentTable(view, rawTableOffsetsField, 'last') },
      {
        key: 'Backspace',
        run(view) {
          const { from, empty } = view.state.selection.main;
          if (!empty) return false;
          const line = view.state.doc.lineAt(from);
          if (line.from === from && line.from === line.to && line.number > 1) {
            const ranges = findTableRanges(view.state.doc.toString());
            const tableBefore = ranges.find((r) => r.to === line.from - 1);
            if (tableBefore) {
              view.dispatch({
                changes: { from: line.from - 1, to: line.to },
                selection: { anchor: tableBefore.from },
              });
              const lastWidget = view.dom.querySelector('.cm-table-widget:last-of-type');
              const lastCell = lastWidget?.querySelector('tbody tr:last-child td:last-child') as HTMLElement;
              lastCell?.focus();
              return true;
            }
          }
          return false;
        },
      },
    ]),
  );
}
