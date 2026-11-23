import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableSelectionController } from '../../../../ui/src/editor/tableSelection';

afterEach(() => { document.body.innerHTML = ''; });

function setup() {
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
  const ctrl = new TableSelectionController({ view: {} as any, tableFrom: 0, container, table, getData: () => data as any, updateDocWith });
  cells.forEach((row, ri) => row.forEach((cell, ci) => ctrl.bindCell(cell, ri - 1, ci)));
  return { ctrl, cells, updateDocWith };
}

function key(k: string, target: EventTarget | null, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('TableSelectionController keyboard', () => {
  it('extends selection with shift+arrows from a focused cell and clamps at edges', () => {
    const { ctrl, cells } = setup();
    expect(ctrl.handleKeyDown(key('ArrowRight', cells[1][1], { shiftKey: true }))).toBe(true);
    expect(ctrl.getSelectedCellCoords()).toHaveLength(2);
    ctrl.handleKeyDown(key('ArrowRight', cells[1][1], { shiftKey: true }));
    ctrl.handleKeyDown(key('ArrowRight', cells[1][1], { shiftKey: true }));
    ctrl.handleKeyDown(key('ArrowDown', null, { shiftKey: true }));
    ctrl.handleKeyDown(key('ArrowDown', null, { shiftKey: true }));
    ctrl.handleKeyDown(key('ArrowUp', null, { shiftKey: true }));
    expect(ctrl.hasMultiSelection()).toBe(true);
    expect(ctrl.handleKeyDown(key('Tab', null))).toBe(false);
    expect(ctrl.hasMultiSelection()).toBe(false);
  });

  it('starts at the origin for non-cell targets and handles delete, plain arrows and escape', () => {
    const { ctrl, updateDocWith } = setup();
    ctrl.handleKeyDown(key('ArrowDown', document.body, { shiftKey: true }));
    expect(ctrl.handleKeyDown(key('Delete', null))).toBe(true);
    expect(updateDocWith).toHaveBeenCalled();
    ctrl.handleKeyDown(key('ArrowLeft', document.body, { shiftKey: true }));
    expect(ctrl.handleKeyDown(key('ArrowUp', null))).toBe(false);
    ctrl.handleKeyDown(key('ArrowRight', null, { shiftKey: true }));
    expect(ctrl.handleKeyDown(key('Escape', null))).toBe(true);
    expect(ctrl.handleKeyDown(key('Escape', null))).toBe(false);
    expect(ctrl.handleKeyDown(key('Backspace', null))).toBe(false);
    expect(ctrl.handleKeyDown(key('a', null))).toBe(false);
  });
});
