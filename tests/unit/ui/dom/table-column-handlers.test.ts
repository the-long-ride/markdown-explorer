import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTableColumnHandlers } from '../../../../ui/src/dom/tableColumnHandlers';

describe('tableColumnHandlers', () => {
  let mockWin: any;
  let syncWidthsMock: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="table-1-columns" class="mdn-table-columns">
        <button id="table-1-columns-toggle" aria-expanded="false">Columns</button>
        <div id="table-1-columns-menu" hidden></div>
      </div>
      <table id="table-1">
        <thead>
          <tr>
            <th><span class="mdn-th-text">Name</span></th>
            <th><span class="mdn-th-text">Age</span></th>
            <th><span class="mdn-th-text">City</span></th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Alice</td><td>30</td><td>NY</td></tr>
          <tr><td>Bob</td><td>25</td><td>LA</td></tr>
        </tbody>
      </table>
    `;

    const state: any = {
      hiddenColumnIdxs: [],
      wrapped: false,
    };

    mockWin = {
      Table: {
        initState: vi.fn(() => state),
        refreshChartAvailability: vi.fn(),
      },
    };
    syncWidthsMock = vi.fn();
    registerTableColumnHandlers(mockWin, syncWidthsMock);
  });

  it('registers expected methods on win.Table', () => {
    expect(typeof mockWin.Table.closeColumnMenu).toBe('function');
    expect(typeof mockWin.Table.toggleColumnMenu).toBe('function');
    expect(typeof mockWin.Table.setColumnVisibility).toBe('function');
    expect(typeof mockWin.Table.showAllColumns).toBe('function');
  });

  it('opens and closes column menu properly', () => {
    const root = document.getElementById('table-1-columns')!;
    const menu = document.getElementById('table-1-columns-menu')!;
    const button = document.getElementById('table-1-columns-toggle')!;

    const event = { stopPropagation: vi.fn() } as any;
    mockWin.Table.toggleColumnMenu('table-1', event);

    expect(root.classList.contains('is-open')).toBe(true);
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    // Toggling again closes it
    mockWin.Table.toggleColumnMenu('table-1', event);
    expect(root.classList.contains('is-open')).toBe(false);
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('hides and unhides columns, updating DOM classes', () => {
    const ths = document.querySelectorAll('thead th');
    const trs = document.querySelectorAll('tbody tr');

    // Hide column 1 (Age)
    const success = mockWin.Table.setColumnVisibility('table-1', 1, false);
    expect(success).toBe(true);

    expect(ths[1].classList.contains('is-hidden-column')).toBe(true);
    expect(trs[0].cells[1].classList.contains('is-hidden-column')).toBe(true);
    expect(document.getElementById('table-1-columns-toggle')?.classList.contains('is-active')).toBe(true);

    // Unhide column 1
    mockWin.Table.setColumnVisibility('table-1', 1, true);
    expect(ths[1].classList.contains('is-hidden-column')).toBe(false);
    expect(trs[0].cells[1].classList.contains('is-hidden-column')).toBe(false);
    expect(document.getElementById('table-1-columns-toggle')?.classList.contains('is-active')).toBe(false);
  });

  it('prevents hiding the last visible column', () => {
    // Hide column 0 and 1
    mockWin.Table.setColumnVisibility('table-1', 0, false);
    mockWin.Table.setColumnVisibility('table-1', 1, false);

    // Attempt to hide column 2 (last remaining visible column)
    const thirdSuccess = mockWin.Table.setColumnVisibility('table-1', 2, false);
    expect(thirdSuccess).toBe(false);
    expect(document.querySelectorAll('thead th.is-hidden-column')).toHaveLength(2);
  });

  it('shows all columns on showAllColumns', () => {
    mockWin.Table.setColumnVisibility('table-1', 0, false);
    mockWin.Table.setColumnVisibility('table-1', 1, false);
    expect(document.querySelectorAll('thead th.is-hidden-column')).toHaveLength(2);

    mockWin.Table.showAllColumns('table-1');
    expect(document.querySelectorAll('thead th.is-hidden-column')).toHaveLength(0);
    expect(document.getElementById('table-1-columns-toggle')?.classList.contains('is-active')).toBe(false);
  });

  it('syncs wrapped column widths when state.wrapped is true', () => {
    mockWin.Table.initState('table-1').wrapped = true;
    mockWin.Table.setColumnVisibility('table-1', 0, false);
    expect(syncWidthsMock).toHaveBeenCalledWith('table-1', true);
  });
});
