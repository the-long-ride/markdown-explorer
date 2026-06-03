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

  type TableFilterValue = string | string[] | null | undefined;
  type TableFilterMap = Record<string, TableFilterValue>;
  type TableState = {
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

  const getTableDataRows = (table: HTMLTableElement) => (
    [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]
  ).filter((row) => row.id !== `${table.id}-toggle-row` && !row.dataset.toggle);

  const normalizeFilterValues = (value: TableFilterValue): string[] => {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value) return [value];
    return [];
  };

  const getActiveFilterEntries = (filters: TableFilterMap) => Object.entries(filters || {})
    .map(([colIdx, value]) => [Number.parseInt(colIdx, 10), normalizeFilterValues(value)] as const)
    .filter(([colIdx, values]) => Number.isFinite(colIdx) && values.length > 0);

  const setColumnFilterValues = (state: TableState, colIndex: number, values: string[]) => {
    if (values.length > 0) {
      state.filters[colIndex] = values;
    } else {
      delete state.filters[colIndex];
    }
  };

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
      const an = parseFloat(at.replace(/[\$,%]/g, ''));
      const bn = parseFloat(bt.replace(/[\$,%]/g, ''));
      if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
      return asc ? at.localeCompare(bt) : bt.localeCompare(at);
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
      countEl.textContent = filtered || matchedCount < rows.length
        ? `${matchedCount} / ${rows.length} rows`
        : `${rows.length} rows`;
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

  win.Table.detectChartable = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const headers = [...table.querySelectorAll('thead th')];
    const rows = getTableDataRows(table);

    // Find numeric columns and text label columns
    const numericCols: number[] = [];
    const labelCols: number[] = [];

    headers.forEach((_, idx) => {
      let isNumeric = true;
      let hasVal = false;
      rows.slice(0, 10).forEach(row => {
        const text = row.cells[idx]?.textContent?.trim() ?? '';
        if (!text) return;
        const clean = text.replace(/[\$,%]/g, '');
        if (isNaN(Number(clean))) {
          isNumeric = false;
        } else {
          hasVal = true;
        }
      });
      if (isNumeric && hasVal) {
        numericCols.push(idx);
      } else {
        labelCols.push(idx);
      }
    });

    if (numericCols.length > 0) {
      const labelColIdx = labelCols.length > 0 ? labelCols[0] : 0;
      const dataColIdxs = numericCols.filter(idx => idx !== labelColIdx);

      if (dataColIdxs.length > 0) {
        state.chartable = true;
        state.labelColIdx = labelColIdx;
        state.dataColIdxs = dataColIdxs;

        const switcher = document.getElementById(tableId + '-switcher');
        if (switcher) {
          // Always re-populate switcher (clear first to handle re-renders)
          switcher.innerHTML = `
            <button id="${tableId}-view-table" class="is-active" onclick="Table.switchView('${tableId}', 'table')" title="View Table">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Table
            </button>
            <button id="${tableId}-view-bar" onclick="Table.switchView('${tableId}', 'bar')" title="Bar Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Bar
            </button>
            <button id="${tableId}-view-line" onclick="Table.switchView('${tableId}', 'line')" title="Line Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3v18h18"/><path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3"/></svg> Line
            </button>
            <button id="${tableId}-view-pie" onclick="Table.switchView('${tableId}', 'pie')" title="Pie Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> Pie
            </button>
          `;
        }
      }
    }
  };

  win.Table.switchView = (tableId: string, view: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    state.currentView = view;

    const switcher = document.getElementById(tableId + '-switcher');
    if (switcher) {
      switcher.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('is-active', btn.id === `${tableId}-view-${view}`);
      });
    }
    syncWrapState(tableId, state);

    const scrollEl = document.getElementById(tableId + '-scroll');
    const chartContainer = document.getElementById(tableId + '-chart-container');
    const toggleBtn = document.getElementById(tableId + '-toggle-btn');
    const toggleRow = document.getElementById(tableId + '-toggle-row');

    if (view === 'table') {
      if (scrollEl) scrollEl.style.display = '';
      if (chartContainer) chartContainer.style.display = 'none';
      if (toggleRow) toggleRow.classList.add('is-hidden');
      win.Table.applyAllFilters(tableId);
    } else {
      if (scrollEl) scrollEl.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (toggleRow) toggleRow.classList.add('is-hidden');
      if (chartContainer) chartContainer.style.display = 'block';
      win.Table.renderChart(tableId, view);
    }
  };

  win.Table.getChartColors = (count: number) => {
    const styles = getComputedStyle(document.documentElement);
    const baseColors = Array.from({ length: 8 }, (_, idx) => {
      const token = styles.getPropertyValue(`--chart-${idx + 1}`).trim();
      return token || ['#8b7cf8', '#34d399', '#f87171', '#60a5fa', '#fbbf24', '#ec4899', '#a855f7', '#14b8a6'][idx];
    });
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(baseColors[i % baseColors.length]);
    }
    return result;
  };

  win.Table.renderChart = (tableId: string, viewType: string) => {
    const state = win.Table.initState(tableId);
    if (!state.chartable) return;

    const canvas = document.getElementById(tableId + '-chart-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }

    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;

    const rows = ([...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]).filter(
      row => !row.classList.contains('is-hidden') && row.id !== tableId + '-toggle-row'
    );

    if (rows.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'var(--txm)';
        ctx.textAlign = 'center';
        ctx.fillText('No data to display in chart', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    const MAX_CHART_ROWS = 50;
    const chartRows = rows.slice(0, MAX_CHART_ROWS);

    const labels = chartRows.map(row => {
      const text = row.cells[state.labelColIdx]?.textContent?.trim() ?? '';
      return text.length > 25 ? text.slice(0, 22) + '...' : text;
    });

    const styles = getComputedStyle(document.documentElement);
    const colors = win.Table.getChartColors(state.dataColIdxs.length);

    const datasets = state.dataColIdxs.map((colIdx: number, dsIdx: number) => {
      const headerText = table.querySelectorAll('thead th')[colIdx]?.querySelector('.mdn-th-text')?.textContent?.trim() ?? `Series ${dsIdx + 1}`;
      const data = chartRows.map(row => {
        const text = row.cells[colIdx]?.textContent?.trim() ?? '0';
        const clean = text.replace(/[\$,%]/g, '').trim();
        return parseFloat(clean) || 0;
      });

      const color = colors[dsIdx];

      if (viewType === 'pie') {
        const pieColors = win.Table.getChartColors(data.length);
        return {
          label: headerText,
          data: data,
          backgroundColor: pieColors.map((c: string) => c + 'cc'),
          borderColor: pieColors,
          borderWidth: 1
        };
      }

      return {
        label: headerText,
        data: data,
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2,
        tension: 0.1
      };
    });

    const finalDatasets = viewType === 'pie' ? [datasets[0]] : datasets;

    if (typeof win.Chart !== 'undefined') {
      state.chartInstance = new win.Chart(canvas, {
        type: viewType === 'pie' ? 'doughnut' : viewType,
        data: {
          labels: labels,
          datasets: finalDatasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: styles.getPropertyValue('--tx2').trim() || '#9191a4',
                font: { family: 'var(--font-ui)' }
              }
            }
          },
          scales: viewType === 'pie' ? undefined : {
            x: {
              grid: { color: styles.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.07)' },
              ticks: { color: styles.getPropertyValue('--tx2').trim() || '#9191a4', font: { family: 'var(--font-ui)' } }
            },
            y: {
              grid: { color: styles.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.07)' },
              ticks: { color: styles.getPropertyValue('--tx2').trim() || '#9191a4', font: { family: 'var(--font-ui)' } }
            }
          }
        }
      });
    }
  };
}
