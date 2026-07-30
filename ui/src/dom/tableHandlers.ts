import { registerTableChartHandlers } from './tableChartHandlers';

type TableFilterValue = string | string[] | null | undefined;
type TableFilterMap = Record<string, TableFilterValue>;
export type TableState = {
  expanded: boolean;
  searchQuery: string;
  filters: TableFilterMap;
  chartInstance: any;
  currentView: string;
  wrapped: boolean;
  chartable: boolean;
  labelColIdx: number;
  dataColIdxs: number[];
};

const TABLE_COLLAPSE_LIMIT = 15;
const MIN_WRAPPED_COLUMN_CHARS = 10;
const MAX_WRAPPED_COLUMN_CHARS = 28;

export function normalizeFilterValues(value: TableFilterValue): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}

export function getActiveFilterEntries(filters: TableFilterMap) {
  return Object.entries(filters || {})
    .map(([colIdx, value]) => [Number.parseInt(colIdx, 10), normalizeFilterValues(value)] as const)
    .filter(([colIdx, values]) => Number.isFinite(colIdx) && values.length > 0);
}

export function setColumnFilterValues(state: TableState, colIndex: number, values: string[]) {
  if (values.length > 0) {
    state.filters[colIndex] = values;
  } else {
    delete state.filters[colIndex];
  }
}

export function compareRows(at: string, bt: string, asc: boolean): number {
  const an = parseFloat(at.replace(/[\$,%]/g, ''));
  const bn = parseFloat(bt.replace(/[\$,%]/g, ''));
  if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
  return asc ? at.localeCompare(bt) : bt.localeCompare(at);
}

export function formatRowCount(matchedCount: number, totalRows: number, isFiltered: boolean): string {
  return isFiltered || matchedCount < totalRows
    ? `${matchedCount} / ${totalRows} rows`
    : `${totalRows} rows`;
}

export function truncateLabel(text: string, maxLength = 25): string {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}

export function detectColumnTypes(
  headers: { length: number },
  getCellText: (rowIdx: number, colIdx: number) => string,
  maxRows = 10
): { numericCols: number[]; labelCols: number[] } {
  const numericCols: number[] = [];
  const labelCols: number[] = [];

  for (let idx = 0; idx < headers.length; idx++) {
    let isNumeric = true;
    let hasVal = false;
    for (let row = 0; row < maxRows; row++) {
      const text = getCellText(row, idx);
      if (!text) continue;
      const clean = text.replace(/[\$,%]/g, '');
      if (isNaN(Number(clean))) {
        isNumeric = false;
      } else {
        hasVal = true;
      }
    }
    if (isNumeric && hasVal) {
      numericCols.push(idx);
    } else {
      labelCols.push(idx);
    }
  }

  return { numericCols, labelCols };
}

export function getWrappedColumnPercentages(table: HTMLTableElement): number[] {
  const headers = [...table.querySelectorAll<HTMLElement>('.mdn-th')];
  const columnCount = headers.length || table.rows?.[0]?.cells?.length || 0;
  if (!columnCount) return [];

  const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
  const dataRows = rows
    .filter((row) => !row.dataset.toggle && row.id !== `${table.id}-toggle-row`);
  const weights = Array.from({ length: columnCount }, (_, columnIndex) => {
    const values = dataRows
      .map((row) => row.cells[columnIndex]?.textContent?.trim() ?? '')
      .filter(Boolean);
    const lengths = values.map((value) => value.length).sort((a, b) => a - b);
    const trimCount = Math.floor(lengths.length * 0.1);
    const trimmedLengths = lengths.slice(trimCount, lengths.length - trimCount) || lengths;
    const averageLength = trimmedLengths.reduce((total, length) => total + length, 0) / (trimmedLengths.length || 1);
    const headerText = headers[columnIndex]?.textContent?.trim() ?? '';
    const headerLength = headerText.length;
    const isIndexColumn = /^(index|#|no\.?|number)$/i.test(headerText);
    const isDateColumn = values.length > 0 && values.every((value) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value));
    const isNumericColumn = values.length > 0 && values.every((value) => /^[-+]?[$€£]?\d[\d,]*(?:\.\d+)?%?$/.test(value));
    const minimumLength = isIndexColumn
      ? 8
      : isDateColumn
        ? 13
        : isNumericColumn
          ? 11
          : MIN_WRAPPED_COLUMN_CHARS;
    return Math.min(
      MAX_WRAPPED_COLUMN_CHARS,
      Math.max(minimumLength, averageLength, headerLength),
    );
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  return weights.map((weight) => (weight / totalWeight) * 100);
}

function syncWrappedColumnWidths(tableId: string, wrapped: boolean) {
  const table = document.getElementById(tableId) as HTMLTableElement | null;
  if (!table) return;

  table.querySelector('colgroup[data-mdn-wrapped-columns]')?.remove();
  if (!wrapped) return;

  const widths = getWrappedColumnPercentages(table);
  if (!widths.length) return;

  const colgroup = document.createElement('colgroup');
  colgroup.dataset.mdnWrappedColumns = 'true';
  widths.forEach((width) => {
    const col = document.createElement('col');
    col.style.setProperty('--mdn-column-width', `${width.toFixed(3)}%`);
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);
}

export function registerTableHandlers(win: any) {
  // UI.toggleCodeCollapse (global function to expand/collapse long code blocks)
  win.UI.toggleCodeCollapse = (btn: HTMLElement) => {
    const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
    if (!wrap) return;
    const isCollapsed = wrap.dataset.collapsed === 'true';
    wrap.dataset.collapsed = isCollapsed ? 'false' : 'true';
    btn.textContent = isCollapsed ? 'Show Less' : 'Show More';
  };

  // Table object (for inline onclick handlers)
  if (!win.Table) win.Table = {};
  win.Table.states = win.Table.states || {};

  const getTableDataRows = (table: HTMLTableElement) => (
    [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]
  ).filter((row) => row.id !== `${table.id}-toggle-row` && !row.dataset.toggle);
  const getMatchedTableRows = (table: HTMLTableElement) => (
    getTableDataRows(table).filter((row) => row.dataset.mdnFilterMatch !== 'false')
  );
  const syncFilterButtons = (table: HTMLTableElement, state: TableState) => {
    table.querySelectorAll<HTMLElement>('.mdn-table-filter-btn').forEach((button) => {
      const th = button.closest('.mdn-th') as HTMLElement | null;
      const colIndex = Number.parseInt(th?.dataset.col ?? '', 10);
      const active = Number.isFinite(colIndex) && normalizeFilterValues(state.filters[colIndex]).length > 0;
      button.classList.toggle('is-active', active);
    });
  };

  win.Table.initState = (tableId: string): TableState => {
    if (!win.Table.states[tableId]) {
      win.Table.states[tableId] = {
        expanded: false,
        searchQuery: '',
        filters: {},
        chartInstance: null,
        currentView: 'table',
        wrapped: false,
        chartable: false,
        labelColIdx: 0,
        dataColIdxs: []
      };
    }
    return win.Table.states[tableId];
  };

  const syncWrapState = (tableId: string, state: TableState) => {
    const wrap = document.getElementById(tableId + '-wrap');
    const button = document.getElementById(tableId + '-wrap-toggle');
    wrap?.classList.toggle('is-wrapped', state.wrapped);
    syncWrappedColumnWidths(tableId, state.wrapped);

    if (button) {
      button.hidden = state.currentView !== 'table';
      button.classList.toggle('is-active', state.wrapped);
      button.setAttribute('aria-pressed', String(state.wrapped));
      button.setAttribute('title', state.wrapped ? 'Unwrap table text' : 'Wrap table text');

      const label = button.querySelector('.mdn-table-wrap-toggle__label');
      if (label) {
        label.textContent = state.wrapped ? 'Unwrap' : 'Wrap';
      } else {
        button.lastChild?.replaceWith(document.createTextNode(state.wrapped ? ' Unwrap' : ' Wrap'));
      }
    }
  };

  win.Table.sort = (tableId: string, colIndex: number) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = getTableDataRows(table);
    const th = table.querySelectorAll('.mdn-th')[colIndex] as HTMLElement | null;
    if (!th) return;
    const asc = !th.classList.contains('sort-asc');
    table.querySelectorAll('.mdn-th').forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(asc ? 'sort-asc' : 'sort-desc');
    rows.sort((a, b) => {
      const at = a.cells[colIndex]?.textContent?.trim() ?? '';
      const bt = b.cells[colIndex]?.textContent?.trim() ?? '';
      return compareRows(at, bt, asc);
    });
    rows.forEach((r) => tbody.appendChild(r));

    win.Table.applyAllFilters(tableId);
  };

  win.Table.applyAllFilters = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);

    const searchQ = (state.searchQuery || '').toLowerCase().trim();
    const activeFilters = getActiveFilterEntries(state.filters);
    const rows = getTableDataRows(table);
    let matchedCount = 0;

    rows.forEach((row) => {
      const matchesSearch = !searchQ || (row.textContent ?? '').toLowerCase().includes(searchQ);
      const matchesColumnFilters = activeFilters.every(([colIdx, values]) => {
        const cellVal = (row.cells[colIdx]?.textContent ?? '').trim();
        return values.includes(cellVal);
      });

      const isMatched = matchesSearch && matchesColumnFilters;
      row.dataset.mdnFilterMatch = isMatched ? 'true' : 'false';
      row.classList.toggle('is-hidden', !isMatched);
      if (!isMatched) {
        row.classList.remove('is-collapsed-row');
        return;
      }

      const shouldCollapse = !state.expanded && matchedCount >= TABLE_COLLAPSE_LIMIT;
      row.classList.toggle('is-collapsed-row', shouldCollapse);
      matchedCount++;
    });

    const countEl = document.getElementById(tableId + '-count');
    if (countEl) {
      const filtered = searchQ || activeFilters.length > 0;
      countEl.textContent = formatRowCount(matchedCount, rows.length, filtered);
    }

    const toggleBtn = document.getElementById(tableId + '-toggle-btn');
    if (toggleBtn) {
      toggleBtn.style.display = matchedCount > TABLE_COLLAPSE_LIMIT ? '' : 'none';
      toggleBtn.textContent = state.expanded ? 'Show Less' : 'Show More';
    }
    syncFilterButtons(table, state);

    if (state.currentView !== 'table') {
      win.Table.renderChart(tableId, state.currentView);
    }
  };

  win.Table.filter = (tableId: string, query: string) => {
    const state = win.Table.initState(tableId);
    state.searchQuery = query;
    win.Table.applyAllFilters(tableId);
  };

  win.Table.showFilterMenu = (tableId: string, colIndex: number, buttonEl: HTMLElement) => {
    const existing = document.querySelector('.mdn-filter-dropdown');
    if (existing) existing.remove();

    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);

    const rows = getTableDataRows(table);
    const values = rows
      .map(row => (row.cells[colIndex]?.textContent ?? '').trim())
      .filter(Boolean);
    const uniqueValues = Array.from(new Set(values)).sort();

    const dropdown = document.createElement('div');
    dropdown.className = 'mdn-filter-dropdown';

    const header = document.createElement('div');
    header.className = 'mdn-filter-dropdown-header';
    header.textContent = 'Filter Values';
    dropdown.appendChild(header);

    const allItem = document.createElement('div');
    allItem.className = `mdn-filter-item${normalizeFilterValues(state.filters[colIndex]).length === 0 ? ' is-active' : ''}`;
    allItem.textContent = '(All)';
    allItem.onclick = () => {
      setColumnFilterValues(state, colIndex, []);
      syncMenu();
      win.Table.applyAllFilters(tableId);
    };
    dropdown.appendChild(allItem);

    const valueItems: Array<{ item: HTMLDivElement; check: HTMLSpanElement; value: string }> = [];
    const syncMenu = () => {
      const activeValues = new Set(normalizeFilterValues(state.filters[colIndex]));
      allItem.classList.toggle('is-active', activeValues.size === 0);
      buttonEl.classList.toggle('is-active', activeValues.size > 0);
      valueItems.forEach(({ item, check, value }) => {
        const active = activeValues.has(value);
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-checked', String(active));
        check.textContent = active ? '✓' : '';
      });
    };

    uniqueValues.forEach(val => {
      const item = document.createElement('div');
      item.className = 'mdn-filter-item';
      item.setAttribute('role', 'menuitemcheckbox');
      const check = document.createElement('span');
      check.className = 'mdn-filter-check';
      check.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'mdn-filter-label';
      label.textContent = val;
      item.appendChild(check);
      item.appendChild(label);
      item.onclick = () => {
        const next = normalizeFilterValues(state.filters[colIndex]);
        const existingIndex = next.indexOf(val);
        if (existingIndex >= 0) {
          next.splice(existingIndex, 1);
        } else {
          next.push(val);
        }
        setColumnFilterValues(state, colIndex, next);
        syncMenu();
        win.Table.applyAllFilters(tableId);
      };
      valueItems.push({ item, check, value: val });
      dropdown.appendChild(item);
    });

    if (uniqueValues.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mdn-filter-empty';
      empty.textContent = 'No values';
      dropdown.appendChild(empty);
    }

    document.body.appendChild(dropdown);
    syncMenu();
    const rect = buttonEl.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    
    const dropdownWidth = dropdown.offsetWidth || 160;
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left;
    
    if (rect.left + dropdownWidth > viewportWidth) {
      leftPos = rect.right - dropdownWidth;
    }
    leftPos = Math.max(12, Math.min(leftPos, viewportWidth - dropdownWidth - 12));
    
    dropdown.style.left = `${leftPos}px`;

    const outsideClickListener = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== buttonEl) {
        dropdown.remove();
        document.removeEventListener('click', outsideClickListener);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickListener);
    }, 0);
  };

  win.Table.toggleCollapse = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    state.expanded = !state.expanded;
    win.Table.applyAllFilters(tableId);
  };

  win.Table.toggleWrap = (tableId: string) => {
    const state = win.Table.initState(tableId);
    state.wrapped = !state.wrapped;
    syncWrapState(tableId, state);
  };

  win.Table.updateCount = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const total = getTableDataRows(table).length;
    const countEl = document.getElementById(tableId + '-count');
    if (countEl) countEl.textContent = `${total} rows`;
  };

  registerTableChartHandlers(win, getTableDataRows, getMatchedTableRows, syncWrapState);
}
