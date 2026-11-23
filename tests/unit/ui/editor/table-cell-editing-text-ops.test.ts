import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TABLE_CELL_COMMIT_EVENT, applyCellAltEnter, applyCellShiftEnter, formatFocusedTableCell, normalizeCellLiveInput, setCellCaretOffset, toggleCellBulletList,
} from '../../../../ui/src/editor/tableCellEditing';

function cell(text: string) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  el.className = 'cm-table-cell';
  el.contentEditable = 'true';
  el.tabIndex = 0;
  el.textContent = text;
  host.append(el);
  document.body.append(host);
  return { host, el };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('table cell text operations', () => {
  it('continues bullets with shift/alt enter and plain lines otherwise', () => {
    const { el } = cell('• a');
    setCellCaretOffset(el, 3);
    applyCellShiftEnter(el);
    expect(el.textContent).toBe('• a\n• ');
    const { el: plain } = cell('x\ny');
    setCellCaretOffset(plain, 0);
    applyCellShiftEnter(plain);
    expect(plain.textContent).toBe('\nx\ny');
    const { el: alt } = cell('- a\nb');
    setCellCaretOffset(alt, 1);
    applyCellAltEnter(alt);
    expect(alt.textContent).toBe('- a\n• \nb');
    setCellCaretOffset(alt, alt.textContent!.length);
    applyCellAltEnter(alt);
    expect(alt.textContent!.endsWith('b\n')).toBe(true);
  });

  it('normalizes typed dash bullets only at a collapsed caret', () => {
    const { el } = cell('x\n* ');
    setCellCaretOffset(el, 4);
    normalizeCellLiveInput(el);
    expect(el.textContent).toBe('x\n• ');
    const { el: other } = cell('ab');
    setCellCaretOffset(other, 2);
    normalizeCellLiveInput(other);
    expect(other.textContent).toBe('ab');
  });

  it('toggles bullet lists on and off, keeping blank lines', () => {
    const { el } = cell('a\n\n- b');
    toggleCellBulletList(el);
    expect(el.textContent).toBe('• a\n\n• b');
    toggleCellBulletList(el);
    expect(el.textContent).toBe('a\n\nb');
    const { el: empty } = cell('');
    toggleCellBulletList(empty);
    expect(empty.textContent).toBe('• ');
  });

  it('formats only the focused cell inside the host', () => {
    expect(formatFocusedTableCell(null, 'bold' as any)).toBe(false);
    const { host, el } = cell('word');
    el.focus();
    const commit = vi.fn();
    host.addEventListener(TABLE_CELL_COMMIT_EVENT, commit);
    expect(formatFocusedTableCell(host, 'bullet-list' as any)).toBe(true);
    setCellCaretOffset(el, 0);
    expect(formatFocusedTableCell(host, 'bold' as any)).toBe(true);
    expect(formatFocusedTableCell(host, 'heading' as any)).toBe(false);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(formatFocusedTableCell(document.createElement('div'), 'bold' as any)).toBe(false);
  });
});
