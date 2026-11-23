import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TABLE_CELL_COMMIT_EVENT, applyCellAltEnter, applyCellShiftEnter, formatFocusedTableCell, getCellSelectionOffsets,
  handleTableCellKeyDown, markdownCellToDisplayText, normalizeCellLiveInput, setCellCaretOffset, toggleCellBulletList,
} from '../../../../ui/src/editor/tableCellEditing';

afterEach(() => { document.body.innerHTML = ''; });

function cell(text: string, row = 0, col = 0) {
  const el = document.createElement('div');
  el.className = 'cm-table-cell';
  el.contentEditable = 'true';
  el.tabIndex = 0;
  el.setAttribute('data-row', String(row));
  el.setAttribute('data-col', String(col));
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function run(key: string, mods: Partial<KeyboardEvent>, row: number, col: number, rowCount = 3, colCount = 2) {
  const ctx = {
    e: { key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...mods } as any,
    target: cell('x', row, col), rowCount, colCount,
    focusCell: vi.fn(), commitBeforeExit: vi.fn(() => 7), onExitBelow: vi.fn(), onExitAbove: vi.fn(), onInsertRowBelow: vi.fn(),
  };
  return { handled: handleTableCellKeyDown(ctx), ...ctx };
}

describe('table cell editing helpers', () => {
  it('converts inline code spans with mismatched backticks', () => {
    expect(markdownCellToDisplayText('a ``x ` y`` b `open')).toContain('x ` y');
    expect(markdownCellToDisplayText('`a` and ``')).toContain('a');
  });

  it('reads and sets caret offsets across text nodes', () => {
    const el = cell('');
    el.append('ab', 'cd');
    expect(getCellSelectionOffsets(el)).toEqual({ start: 4, end: 4 });
    setCellCaretOffset(el, 3);
    expect(getCellSelectionOffsets(el)).toEqual({ start: 3, end: 3 });
    setCellCaretOffset(el, 99);
    const empty = cell('');
    setCellCaretOffset(empty, 0);
  });

  it('applies enter variants, bullets and live input normalization', () => {
    const el = cell('line one\nline two');
    setCellCaretOffset(el, 3);
    applyCellShiftEnter(el);
    applyCellAltEnter(el);
    expect(el.textContent).toContain('\n');
    const bullet = cell('- ');
    setCellCaretOffset(bullet, 2);
    normalizeCellLiveInput(bullet);
    const star = cell('* ');
    setCellCaretOffset(star, 2);
    normalizeCellLiveInput(star);
    const plain = cell('ab');
    setCellCaretOffset(plain, 1);
    normalizeCellLiveInput(plain);
    expect(toggleCellBulletList(cell('a\n\nb'))).toContain('<li>a</li>');
    expect(toggleCellBulletList(cell('• a\n- b'))).not.toContain('<li>');
    expect(toggleCellBulletList(cell('* x'))).toBe('x');
  });

  it('formats the focused cell', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    expect(formatFocusedTableCell(null, 'bold')).toBe(false);
    const el = cell('word');
    host.appendChild(el);
    el.focus();
    const commits = vi.fn();
    host.addEventListener(TABLE_CELL_COMMIT_EVENT, commits);
    expect(formatFocusedTableCell(host, 'bullet-list')).toBe(true);
    expect(formatFocusedTableCell(host, 'bold')).toBe(true);
    expect(formatFocusedTableCell(host, 'heading-1')).toBe(false);
    expect(commits).toHaveBeenCalledTimes(2);
  });
});

describe('handleTableCellKeyDown navigation', () => {
  it('moves vertically and exits the table', () => {
    expect(run('Enter', {}, -1, 1).focusCell).toHaveBeenCalledWith(0, 1);
    expect(run('Enter', {}, -1, 1, 0).onExitBelow).toHaveBeenCalledWith(7);
    expect(run('ArrowDown', {}, 0, 1).focusCell).toHaveBeenCalledWith(1, 1);
    expect(run('Enter', {}, 2, 0).onExitBelow).toHaveBeenCalled();
    expect(run('ArrowUp', {}, 2, 0).focusCell).toHaveBeenCalledWith(1, 0);
    expect(run('ArrowUp', {}, 0, 0).focusCell).toHaveBeenCalledWith(-1, 0);
    expect(run('ArrowUp', {}, -1, 0).onExitAbove).toHaveBeenCalled();
    expect(run('Enter', { shiftKey: true }, 0, 0).handled).toBe(true);
    expect(run('Enter', { altKey: true }, 0, 0).handled).toBe(true);
  });

  it('moves horizontally with alt arrows and tab', () => {
    expect(run('ArrowRight', { altKey: true }, 0, 0).focusCell).toHaveBeenCalledWith(0, 1);
    expect(run('ArrowRight', { altKey: true }, -1, 1).focusCell).toHaveBeenCalledWith(0, 0);
    expect(run('ArrowRight', { altKey: true }, 0, 1).focusCell).toHaveBeenCalledWith(1, 0);
    expect(run('ArrowRight', { altKey: true }, 2, 1).onExitBelow).toHaveBeenCalled();
    expect(run('ArrowLeft', { altKey: true }, 0, 1).focusCell).toHaveBeenCalledWith(0, 0);
    expect(run('ArrowLeft', { altKey: true }, 1, 0).focusCell).toHaveBeenCalledWith(0, 1);
    expect(run('ArrowLeft', { altKey: true }, 0, 0).focusCell).toHaveBeenCalledWith(-1, 1);
    expect(run('ArrowLeft', { altKey: true }, -1, 0).onExitAbove).toHaveBeenCalled();
    expect(run('Tab', {}, 0, 0).focusCell).toHaveBeenCalledWith(0, 1);
    expect(run('Tab', {}, 0, 1).focusCell).toHaveBeenCalledWith(1, 0);
    expect(run('Tab', {}, 2, 1).onInsertRowBelow).toHaveBeenCalledWith(2);
    expect(run('Tab', { shiftKey: true }, 0, 1).focusCell).toHaveBeenCalledWith(0, 0);
    expect(run('Tab', { shiftKey: true }, 1, 0).focusCell).toHaveBeenCalledWith(0, 1);
    expect(run('Tab', { shiftKey: true }, 0, 0).focusCell).toHaveBeenCalledWith(-1, 1);
    expect(run('Tab', { shiftKey: true }, -1, 0).focusCell).not.toHaveBeenCalled();
    expect(run('a', {}, 0, 0).handled).toBe(false);
  });
});
