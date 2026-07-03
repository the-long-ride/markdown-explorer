import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

function createTableFixture(id: string, headers: string[], rows: string[][]) {
  const table = document.createElement('table');
  table.id = id;
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((text, idx) => {
    const th = document.createElement('th');
    th.className = 'mdn-th';
    th.dataset.col = String(idx);
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((cells) => {
    const tr = document.createElement('tr');
    cells.forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

describe('Table.sort', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Table: {} } as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sorts rows ascending on first call', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Charlie', '10'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[1]?.textContent?.trim()).toBe('10');
    expect(rows[1].cells[1]?.textContent?.trim()).toBe('20');
    expect(rows[2].cells[1]?.textContent?.trim()).toBe('30');
  });

  it('sorts rows descending on second call', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Charlie', '10'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    win.Table.sort('t1', 1);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[1]?.textContent?.trim()).toBe('30');
    expect(rows[1].cells[1]?.textContent?.trim()).toBe('20');
    expect(rows[2].cells[1]?.textContent?.trim()).toBe('10');
  });

  it('adds sort-asc class on first sort', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    const ths = table.querySelectorAll('.mdn-th');
    expect(ths[1].classList.contains('sort-asc')).toBe(true);
    expect(ths[1].classList.contains('sort-desc')).toBe(false);
  });

  it('adds sort-desc class on second sort call', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    win.Table.sort('t1', 1);
    const ths = table.querySelectorAll('.mdn-th');
    expect(ths[1].classList.contains('sort-desc')).toBe(true);
    expect(ths[1].classList.contains('sort-asc')).toBe(false);
  });

  it('removes sort classes from other columns when sorting a new column', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 0);
    expect(table.querySelectorAll('.mdn-th')[0].classList.contains('sort-asc')).toBe(true);

    win.Table.sort('t1', 1);
    expect(table.querySelectorAll('.mdn-th')[0].classList.contains('sort-asc')).toBe(false);
    expect(table.querySelectorAll('.mdn-th')[0].classList.contains('sort-desc')).toBe(false);
    expect(table.querySelectorAll('.mdn-th')[1].classList.contains('sort-asc')).toBe(true);
  });

  it('sorts string columns alphabetically ascending', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Charlie', '10'],
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 0);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[0]?.textContent?.trim()).toBe('Alice');
    expect(rows[1].cells[0]?.textContent?.trim()).toBe('Bob');
    expect(rows[2].cells[0]?.textContent?.trim()).toBe('Charlie');
  });

  it('sorts string columns alphabetically descending on second call', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Charlie', '10'],
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 0);
    win.Table.sort('t1', 0);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[0]?.textContent?.trim()).toBe('Charlie');
    expect(rows[1].cells[0]?.textContent?.trim()).toBe('Bob');
    expect(rows[2].cells[0]?.textContent?.trim()).toBe('Alice');
  });

  it('sorts numeric columns correctly even with currency symbols', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Item', 'Price'], [
      ['A', '$300'],
      ['B', '$100'],
      ['C', '$200'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[1]?.textContent?.trim()).toBe('$100');
    expect(rows[1].cells[1]?.textContent?.trim()).toBe('$200');
    expect(rows[2].cells[1]?.textContent?.trim()).toBe('$300');
  });

  it('sorts numeric columns correctly with percent values', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Item', 'Rate'], [
      ['A', '75%'],
      ['B', '25%'],
      ['C', '50%'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[1]?.textContent?.trim()).toBe('25%');
    expect(rows[1].cells[1]?.textContent?.trim()).toBe('50%');
    expect(rows[2].cells[1]?.textContent?.trim()).toBe('75%');
  });

  it('toggles sort back to ascending after descending on third call', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Charlie', '10'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.sort('t1', 1);
    win.Table.sort('t1', 1);
    win.Table.sort('t1', 1);
    const ths = table.querySelectorAll('.mdn-th');
    expect(ths[1].classList.contains('sort-asc')).toBe(true);
    expect(ths[1].classList.contains('sort-desc')).toBe(false);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[1]?.textContent?.trim()).toBe('10');
  });

  it('does nothing when table element is missing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.sort('nonexistent', 0)).not.toThrow();
  });

  it('does nothing when no tbody exists', () => {
    registerTableHandlers(win);
    const table = document.createElement('table');
    table.id = 't-no-tbody';
    document.body.appendChild(table);
    expect(() => win.Table.sort('t-no-tbody', 0)).not.toThrow();
  });

  it('does nothing when column index is out of bounds', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name'], [
      ['Alice'],
      ['Bob'],
    ]);
    document.body.appendChild(table);
    expect(() => win.Table.sort('t1', 99)).not.toThrow();
  });

  it('sorts via click on th header element', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Charlie', '10'],
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    const th = table.querySelectorAll('.mdn-th')[0] as HTMLElement;
    th.onclick = () => win.Table.sort('t1', 0);
    th.click();
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].cells[0]?.textContent?.trim()).toBe('Alice');
  });

  it('excludes toggle rows from sort', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    const toggleRow = document.createElement('tr');
    toggleRow.id = 't1-toggle-row';
    const td = document.createElement('td');
    td.textContent = 'toggle';
    toggleRow.appendChild(td);
    table.querySelector('tbody')!.appendChild(toggleRow);
    document.body.appendChild(table);

    win.Table.sort('t1', 0);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows).toHaveLength(3);
    const toggleRowEl = rows.find((r) => r.id === 't1-toggle-row');
    expect(toggleRowEl).toBeDefined();
  });

  it('calls applyAllFilters after sorting', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const spy = vi.spyOn(win.Table, 'applyAllFilters');
    win.Table.sort('t1', 0);
    expect(spy).toHaveBeenCalledWith('t1');
  });
});
