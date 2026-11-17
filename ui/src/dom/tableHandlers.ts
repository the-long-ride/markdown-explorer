import {
  clearStoredColumnWidths,
  getStoredTableLayout,
  getTableKey,
  getWrappedColumnPercentages,
  getWrappedColumnWeights,
  setStoredTableLayout,
  syncWrappedTableColumns,
} from './tableResizeStore';
import { TABLE_COLLAPSE_LIMIT } from '../constants/limits';
import { registerTableChartHandlers } from './tableChartHandlers';
import { registerTableColumnHandlers } from './tableColumnHandlers';
import { setColumnAlignment, showAlignMenu } from './tableAlignHandlers';
import { DEFAULT_TABLE_UI_LABELS, formatUiLabel, getTableUiLabels, type TableUiLabels } from './tableUiLabels';
import { syncStickyTableHeaders } from '../components/Content/contentUtils';

export { getWrappedColumnPercentages, setColumnAlignment, showAlignMenu };

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
  scatterColIdxs: number[];
  hiddenColumnIdxs: number[];
};


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
  if (values.length > 0) state.filters[colIndex] = values;
  else delete state.filters[colIndex];
}

export function compareRows(at: string, bt: string, asc: boolean): number {
  const an = parseFloat(at.replace(/[\$,%]/g, ''));
  const bn = parseFloat(bt.replace(/[\$,%]/g, ''));
  if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
  return asc ? at.localeCompare(bt) : bt.localeCompare(at);
}

export function formatRowCount(
  matchedCount: number,
  totalRows: number,
  isFiltered: boolean,
  labels: TableUiLabels = DEFAULT_TABLE_UI_LABELS,
): string {
  return isFiltered || matchedCount < totalRows
    ? formatUiLabel(labels.filteredRowsCount, { matched: matchedCount, total: totalRows })
    : formatUiLabel(labels.rowsCount, { count: totalRows });
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

const syncWrappedColumnWidths = (tableId: string, wrapped: boolean) => syncWrappedTableColumns(tableId, wrapped, getWrappedColumnWeights);

export function registerTableHandlers(win: any) {
  // UI.toggleCodeCollapse (global function to expand/collapse long code blocks)
  win.UI.toggleCodeCollapse = (btn: HTMLElement) => {
    const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
    if (!wrap) return;
    const isCollapsed = wrap.dataset.collapsed === 'true';
    wrap.dataset.collapsed = isCollapsed ? 'false' : 'true';
    btn.textContent = isCollapsed
      ? btn.dataset.labelShowLess ?? DEFAULT_TABLE_UI_LABELS.showLess
      : btn.dataset.labelShowMore ?? DEFAULT_TABLE_UI_LABELS.showMore;
    const scrollContainer = btn.closest<HTMLElement>(
      '[data-mdn-js-sticky-headers="true"], .content__scroll, .split-document-pane__scroll',
    );
    if (scrollContainer) {
      syncStickyTableHeaders(scrollContainer);
    }
  };

  // Table object (for inline onclick handlers)
  if (!win.Table) win.Table = {};
  win.Table.states = win.Table.states || {};

  const getTableDataRows = (table: HTMLTableElement) => (
    [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]
  ).filter((row) => row.id !== `${table.id}-toggle-row` && !row.dataset.toggle);
  const getMatchedTableRows = (table: HTMLTableElement) => (
    getTableDataRows(table).filter((row) => (
      row.dataset.mdnFilterMatch !== 'false'
      && !row.classList.contains('is-hidden')
    ))
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
        dataColIdxs: [],
        scatterColIdxs: [],
        hiddenColumnIdxs: []
      };
    }
    return win.Table.states[tableId];
  };

  const syncWrapState = (tableId: string, state: TableState) => {
    const wrap = document.getElementById(tableId + '-wrap');
    const button = document.getElementById(tableId + '-wrap-toggle');
    const resetButton = document.getElementById(tableId + '-reset-widths') as HTMLButtonElement | null;
    wrap?.classList.toggle('is-wrapped', state.wrapped);
    syncWrappedColumnWidths(tableId, state.wrapped);

    if (resetButton) {
      const hasCustomWidths = Boolean(wrap?.classList.contains('has-custom-column-widths'));
      resetButton.hidden = state.currentView !== 'table' || !hasCustomWidths;
    }

    if (button) {
      const labels = getTableUiLabels(tableId);
      button.hidden = state.currentView !== 'table';
      button.classList.toggle('is-active', state.wrapped);
      button.setAttribute('aria-pressed', String(state.wrapped));
      const wrapTooltip = state.wrapped ? labels.unwrapTableText : labels.wrapTableText;
      button.setAttribute('aria-label', wrapTooltip);
      const tooltip = button.querySelector('.tooltip-text');
      if (tooltip) tooltip.textContent = wrapTooltip;

      const label = button.querySelector('.mdn-table-wrap-toggle__label');
      if (label) {
        label.textContent = state.wrapped ? labels.unwrap : labels.wrap;
      } else {
        button.lastChild?.replaceWith(document.createTextNode(` ${state.wrapped ? labels.unwrap : labels.wrap}`));
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
      countEl.textContent = formatRowCount(matchedCount, rows.length, filtered, getTableUiLabels(tableId));
    }

    const toggleBtn = document.getElementById(tableId + '-toggle-btn');
    if (toggleBtn) {
      toggleBtn.style.display = matchedCount > TABLE_COLLAPSE_LIMIT ? '' : 'none';
      const labels = getTableUiLabels(tableId);
      toggleBtn.textContent = state.expanded ? labels.showLess : labels.showMore;
      toggleBtn.classList.toggle('is-expanded', Boolean(state.expanded));
    }
    syncFilterButtons(table, state);

    const scrollContainer = table.closest<HTMLElement>(
      '[data-mdn-js-sticky-headers="true"], .content__scroll, .split-document-pane__scroll',
    );
    if (scrollContainer) {
      syncStickyTableHeaders(scrollContainer);
    }

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
    document.querySelectorAll('.mdn-filter-dropdown, .mdn-align-dropdown').forEach((el) => el.remove());

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
    const labels = getTableUiLabels(tableId);
    header.textContent = labels.filterValues;
    dropdown.appendChild(header);

    const allItem = document.createElement('div');
    allItem.className = `mdn-filter-item${normalizeFilterValues(state.filters[colIndex]).length === 0 ? ' is-active' : ''}`;
    allItem.textContent = labels.all;
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
      empty.textContent = labels.noValues;
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
    const wasExpanded = state.expanded;
    state.expanded = !state.expanded;
    win.Table.applyAllFilters(tableId);
    if (wasExpanded) {
      document.getElementById(tableId + '-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  win.Table.toggleWrap = (tableId: string) => {
    const state = win.Table.initState(tableId);
    state.wrapped = !state.wrapped;
    syncWrapState(tableId, state);
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (table) setStoredTableLayout(getTableKey(table), { wrapped: state.wrapped });
  };
  win.Table.resetColumnWidths = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    clearStoredColumnWidths(getTableKey(table));
    const state = win.Table.initState(tableId);
    syncWrapState(tableId, state);
    const scrollContainer = table.closest<HTMLElement>(
      '[data-mdn-js-sticky-headers="true"], .content__scroll, .split-document-pane__scroll',
    );
    if (scrollContainer) {
      syncStickyTableHeaders(scrollContainer);
    }
  };
  win.Table.syncWrapState = syncWrapState;
  win.Table.restoreTableLayout = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const stored = getStoredTableLayout(getTableKey(table));
    if (typeof stored?.wrapped === 'boolean') {
      state.wrapped = stored.wrapped;
    }
    syncWrapState(tableId, state);
  };

  win.Table.updateCount = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const total = getTableDataRows(table).length;
    const countEl = document.getElementById(tableId + '-count');
    if (countEl) countEl.textContent = formatUiLabel(getTableUiLabels(tableId).rowsCount, { count: total });
  };

  win.Table.showAlignMenu = showAlignMenu;
  win.Table.setColumnAlignment = setColumnAlignment;

  registerTableColumnHandlers(win, syncWrappedColumnWidths);
  registerTableChartHandlers(win, getTableDataRows, getMatchedTableRows, syncWrapState);
}
