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
    const filterBtn = document.createElement('button');
    filterBtn.className = 'mdn-table-filter-btn';
    filterBtn.textContent = 'Filter';
    th.appendChild(filterBtn);
    const textSpan = document.createElement('span');
    textSpan.className = 'mdn-th-text';
    textSpan.textContent = text;
    th.appendChild(textSpan);
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

describe('Table.filter', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Table: {} } as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets searchQuery on the table state', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.filter('t1', 'alice');
    const state = win.Table.initState('t1');
    expect(state.searchQuery).toBe('alice');
  });

  it('hides rows that do not match search query', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
      ['Charlie', '10'],
    ]);
    document.body.appendChild(table);

    win.Table.filter('t1', 'alice');
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
    expect(rows[2].classList.contains('is-hidden')).toBe(true);
  });

  it('shows all rows when search query is cleared', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.filter('t1', 'alice');
    win.Table.filter('t1', '');
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(false);
  });

  it('search is case-insensitive', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.filter('t1', 'ALICE');
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
  });

  it('search matches text in any cell', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.filter('t1', '20');
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(true);
    expect(rows[1].classList.contains('is-hidden')).toBe(false);
  });
});

describe('Table.showFilterMenu', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Table: {} } as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a filter dropdown element', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const dropdown = document.querySelector('.mdn-filter-dropdown');
    expect(dropdown).toBeInTheDocument();
  });

  it('removes existing dropdown before creating new one', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    win.Table.showFilterMenu('t1', 0, btn);
    const dropdowns = document.querySelectorAll('.mdn-filter-dropdown');
    expect(dropdowns).toHaveLength(1);
  });

  it('renders header with Filter Values text', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const header = document.querySelector('.mdn-filter-dropdown-header');
    expect(header?.textContent).toBe('Filter Values');
  });

  it('renders (All) item as active when no filter is set', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const allItem = document.querySelector('.mdn-filter-item');
    expect(allItem?.textContent).toContain('(All)');
    expect(allItem?.classList.contains('is-active')).toBe(true);
  });

  it('renders unique column values as filter items', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
      ['Alice', '40'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => el.textContent !== '(All)');
    expect(valueItems).toHaveLength(2);
  });

  it('sorts unique values in dropdown', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Charlie', '10'],
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => !el.textContent?.includes('(All)'));
    const labels = valueItems.map((el) => el.querySelector('.mdn-filter-label')?.textContent);
    expect(labels).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('clicking (All) clears column filter and applies filters', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];

    win.Table.showFilterMenu('t1', 0, btn);
    const allItem = document.querySelector('.mdn-filter-item') as HTMLElement;
    allItem.click();
    expect(state.filters[0]).toBeUndefined();
  });

  it('clicking a value item toggles column filter', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => !el.textContent?.includes('(All)'));
    const aliceItem = valueItems.find((el) => el.querySelector('.mdn-filter-label')?.textContent === 'Alice');
    aliceItem?.click();
    const state = win.Table.initState('t1');
    expect(state.filters[0]).toEqual(['Alice']);
  });

  it('clicking a value item again removes it from filter', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => !el.textContent?.includes('(All)'));
    const aliceItem = valueItems.find((el) => el.querySelector('.mdn-filter-label')?.textContent === 'Alice');
    aliceItem?.click();
    aliceItem?.click();
    const state = win.Table.initState('t1');
    expect(state.filters[0]).toBeUndefined();
  });

  it('renders check mark for active filter values', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];
    win.Table.showFilterMenu('t1', 0, btn);

    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => !el.textContent?.includes('(All)'));
    const aliceItem = valueItems.find((el) => el.querySelector('.mdn-filter-label')?.textContent === 'Alice');
    const check = aliceItem?.querySelector('.mdn-filter-check');
    expect(check?.textContent).toBe('✓');
  });

  it('sets aria-checked on filter items', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];
    win.Table.showFilterMenu('t1', 0, btn);

    const items = [...document.querySelectorAll('.mdn-filter-item')];
    const valueItems = items.filter((el) => !el.textContent?.includes('(All)'));
    const aliceItem = valueItems.find((el) => el.querySelector('.mdn-filter-label')?.textContent === 'Alice');
    const bobItem = valueItems.find((el) => el.querySelector('.mdn-filter-label')?.textContent === 'Bob');
    expect(aliceItem?.getAttribute('aria-checked')).toBe('true');
    expect(bobItem?.getAttribute('aria-checked')).toBe('false');
  });

  it('shows No values when column has no data', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], []);
    document.body.appendChild(table);
    const btn = table.querySelector('.mdn-table-filter-btn') as HTMLElement;

    win.Table.showFilterMenu('t1', 0, btn);
    const empty = document.querySelector('.mdn-filter-empty');
    expect(empty?.textContent).toBe('No values');
  });

  it('does nothing when table element is missing', () => {
    registerTableHandlers(win);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    expect(() => win.Table.showFilterMenu('missing', 0, btn)).not.toThrow();
  });
});

describe('Table.applyAllFilters', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Table: {} } as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows all rows when no filters and no search', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.applyAllFilters('t1');
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(false);
  });

  it('hides rows not matching column filter', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
      ['Alice', '10'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];
    win.Table.applyAllFilters('t1');

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
    expect(rows[2].classList.contains('is-hidden')).toBe(false);
  });

  it('hides rows not matching search query', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.searchQuery = 'alice';
    win.Table.applyAllFilters('t1');

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
  });

  it('combines search and column filters', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Alice', '20'],
      ['Bob', '30'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.searchQuery = '30';
    state.filters[0] = ['Alice'];
    win.Table.applyAllFilters('t1');

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
    expect(rows[2].classList.contains('is-hidden')).toBe(true);
  });

  it('shows row only when both search and column filters match', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Alice', '20'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.searchQuery = '20';
    state.filters[0] = ['Alice'];
    win.Table.applyAllFilters('t1');

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(true);
    expect(rows[1].classList.contains('is-hidden')).toBe(false);
    expect(rows[2].classList.contains('is-hidden')).toBe(true);
  });

  it('updates count element with filtered count', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
      ['Charlie', '10'],
    ]);
    document.body.appendChild(table);
    const countEl = document.createElement('span');
    countEl.id = 't1-count';
    document.body.appendChild(countEl);

    const state = win.Table.initState('t1');
    state.searchQuery = 'alice';
    win.Table.applyAllFilters('t1');

    expect(countEl.textContent).toBe('1 / 3 rows');
  });

  it('updates count element with total count when no filter active', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const countEl = document.createElement('span');
    countEl.id = 't1-count';
    document.body.appendChild(countEl);

    win.Table.applyAllFilters('t1');

    expect(countEl.textContent).toBe('2 rows');
  });

  it('does nothing when table element is missing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.applyAllFilters('nonexistent')).not.toThrow();
  });

  it('marks filter button as active when column has filter', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];
    win.Table.applyAllFilters('t1');

    const filterBtns = table.querySelectorAll('.mdn-table-filter-btn');
    expect(filterBtns[0].classList.contains('is-active')).toBe(true);
    expect(filterBtns[1].classList.contains('is-active')).toBe(false);
  });

  it('marks filter button as inactive when column has no filter', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    win.Table.applyAllFilters('t1');

    const filterBtns = table.querySelectorAll('.mdn-table-filter-btn');
    expect(filterBtns[0].classList.contains('is-active')).toBe(false);
    expect(filterBtns[1].classList.contains('is-active')).toBe(false);
  });

  it('handles multiple column filters', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Category'], [
      ['Alice', 'A'],
      ['Bob', 'B'],
      ['Charlie', 'A'],
    ]);
    document.body.appendChild(table);

    const state = win.Table.initState('t1');
    state.filters[0] = ['Alice'];
    state.filters[1] = ['A'];
    win.Table.applyAllFilters('t1');

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows[0].classList.contains('is-hidden')).toBe(false);
    expect(rows[1].classList.contains('is-hidden')).toBe(true);
    expect(rows[2].classList.contains('is-hidden')).toBe(true);
  });

  it('removes is-collapsed-row from hidden rows', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);

    const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    rows[1].classList.add('is-collapsed-row');

    const state = win.Table.initState('t1');
    state.searchQuery = 'alice';
    win.Table.applyAllFilters('t1');

    expect(rows[1].classList.contains('is-collapsed-row')).toBe(false);
  });

  it('toggles show/hide for toggle button based on matched count', () => {
    registerTableHandlers(win);
    const rows = Array.from({ length: 20 }, (_, i) => [`Item${i}`, String(i * 5)]);
    const table = createTableFixture('t1', ['Name', 'Score'], rows);
    document.body.appendChild(table);
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 't1-toggle-btn';
    document.body.appendChild(toggleBtn);

    win.Table.applyAllFilters('t1');
    expect(toggleBtn.style.display).toBe('');
    expect(toggleBtn.textContent).toBe('Show More');
  });

  it('hides toggle button when matched count is under collapse limit', () => {
    registerTableHandlers(win);
    const table = createTableFixture('t1', ['Name', 'Score'], [
      ['Alice', '30'],
      ['Bob', '20'],
    ]);
    document.body.appendChild(table);
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 't1-toggle-btn';
    document.body.appendChild(toggleBtn);

    win.Table.applyAllFilters('t1');
    expect(toggleBtn.style.display).toBe('none');
  });
});
