import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableSelectionController } from '../../../../ui/src/editor/tableSelection';

afterEach(() => { document.body.innerHTML = ''; });

function setup(view: any = {}) {
  const container = document.createElement('div');
  const table = document.createElement('table');
  const cells: HTMLElement[][] = [];
  for (let r = -1; r < 2; r++) {
    const tr = table.insertRow();
    cells[r + 1] = [];
    for (let c = 0; c < 3; c++) {
      const td = tr.insertCell();
      td.className = 'cm-table-cell';
      td.tabIndex = 0;
      td.textContent = `${r}${c}`;
      td.setAttribute('data-row', String(r));
      td.setAttribute('data-col', String(c));
      cells[r + 1][c] = td;
    }
  }
  container.appendChild(table);
  document.body.appendChild(container);
  const data = { headers: ['a', 'b', 'c'], rows: [['1', '2', '3'], ['4', '5', '6']], alignments: [null, null, null] };
  const updateDocWith = vi.fn();
  const ctrl = new TableSelectionController({ view, tableFrom: 0, container, table, getData: () => data as any, updateDocWith });
  cells.forEach((row, ri) => row.forEach((cell, ci) => ctrl.bindCell(cell, ri - 1, ci)));
  return { ctrl, cells, updateDocWith, container };
}
const down = (el: HTMLElement, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ...init }));
const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });

describe('TableSelectionController', () => {
  it('extends with shift-click, toggles with ctrl-click and clears selected cells', () => {
    const { ctrl, cells, updateDocWith } = setup();
    down(cells[1][0], { button: 2 });
    down(cells[1][0]);
    down(cells[2][1], { shiftKey: true });
    expect(ctrl.getSelectedCellCoords()).toHaveLength(4);
    expect(ctrl.hasMultiSelection()).toBe(true);
    down(cells[2][1], { ctrlKey: true });
    down(cells[0][2], { metaKey: true });
    expect(ctrl.getSelectedCellCoords().some((c) => c.row === -1)).toBe(true);
    ctrl.clearSelectedCells();
    expect(updateDocWith).toHaveBeenCalled();
    expect(ctrl.isClearing()).toBe(false);
    down(cells[1][1]);
    expect(ctrl.hasMultiSelection()).toBe(false);
    ctrl.clearSelectedCells();
    ctrl.destroy();
  });

  it('ctrl-click adds the anchor when nothing is selected', () => {
    const { ctrl, cells } = setup();
    down(cells[1][0]);
    window.dispatchEvent(new MouseEvent('mouseup'));
    down(cells[1][2], { ctrlKey: true });
    expect(ctrl.getSelectedCellCoords()).toHaveLength(2);
  });

  it('selects by dragging across cells and back', () => {
    const { ctrl, cells } = setup();
    down(cells[1][0]);
    cells[2][2].dispatchEvent(new MouseEvent('mouseenter'));
    cells[1][0].dispatchEvent(new MouseEvent('mouseenter'));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(ctrl.getSelectedCellCoords().length).toBeGreaterThanOrEqual(1);
    cells[2][2].dispatchEvent(new MouseEvent('mouseenter'));
    down(cells[1][1]);
    cells[1][1].dispatchEvent(new MouseEvent('mouseenter'));
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('navigates with shift-arrows, then handles Escape, Tab and focus', () => {
    const { ctrl, cells } = setup();
    cells[1][1].dispatchEvent(new FocusEvent('focus'));
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowDown']) {
      const event = key(k, { shiftKey: true });
      Object.defineProperty(event, 'target', { value: cells[1][1] });
      ctrl.handleKeyDown(event);
    }
    expect(ctrl.getSelectedCellCoords().length).toBeGreaterThan(1);
    expect(ctrl.handleKeyDown(key('Tab'))).toBe(false);
    down(cells[1][0]); down(cells[2][2], { shiftKey: true });
    expect(ctrl.handleKeyDown(key('Escape'))).toBe(true);
    down(cells[1][0]); down(cells[2][2], { shiftKey: true });
    ctrl.handleKeyDown(key('ArrowDown'));
    ctrl.handleKeyDown(key('Delete'));
    ctrl.handleKeyDown(key('Backspace'));
    expect(ctrl.handleKeyDown(key('x'))).toBe(false);
  });

  it('starts keyboard selection from an unfocused cell target', () => {
    const { ctrl, cells } = setup();
    const event = key('ArrowRight', { shiftKey: true });
    Object.defineProperty(event, 'target', { value: cells[2][0] });
    ctrl.handleKeyDown(event);
    const other = key('ArrowLeft', { shiftKey: true });
    Object.defineProperty(other, 'target', { value: document.body });
    const fresh = setup().ctrl;
    fresh.handleKeyDown(other);
    expect(ctrl.getSelectedCellCoords().length).toBeGreaterThan(0);
  });

  it('clears on outside mousedown and restores persisted selection', () => {
    const view = {};
    const first = setup(view);
    down(first.cells[1][0]); down(first.cells[2][1], { shiftKey: true });
    const second = setup(view);
    second.ctrl.restoreStyles();
    expect(second.ctrl.getSelectedCellCoords()).toHaveLength(4);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(first.ctrl.getSelectedCellCoords()).toHaveLength(0);
    const third = setup({});
    third.ctrl.restoreStyles();
    expect(third.ctrl.getSelectedCellCoords()).toHaveLength(0);
  });
});
