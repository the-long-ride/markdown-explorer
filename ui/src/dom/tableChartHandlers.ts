import type { TableState } from './tableHandlers';
import { detectColumnTypes, truncateLabel } from './tableHandlers';
import { getTableUiLabels, formatUiLabel } from './tableUiLabels';
import { escHtml } from '../markdown/utils';

export function registerTableChartHandlers(
  win: any,
  getTableDataRows: (table: HTMLTableElement) => HTMLTableRowElement[],
  getMatchedTableRows: (table: HTMLTableElement) => HTMLTableRowElement[],
  syncWrapState: (tableId: string, state: TableState) => void,
) {
  win.Table.detectChartable = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const headers = [...table.querySelectorAll('thead th')];
    const rows = getTableDataRows(table);

    const { numericCols, labelCols } = detectColumnTypes(
      { length: headers.length },
      (rowIdx, colIdx) => rows[rowIdx]?.cells[colIdx]?.textContent?.trim() ?? ''
    );

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
          const currentView = state.currentView || 'table';
          const labels = getTableUiLabels(tableId);
          const formattedLabels: Record<string, string> = {
            table: labels.table,
            bar: labels.barChart,
            line: labels.lineChart,
            pie: labels.pieChart,
          };
          const activeLabel = formattedLabels[currentView] || labels.table;

          switcher.innerHTML = `
            <div class="mdn-table-view-dropdown" id="${tableId}-view-dropdown">
              <button type="button" class="mdn-table-view-select" aria-haspopup="listbox" aria-expanded="false">
                <span class="mdn-table-view-select__label">${escHtml(activeLabel)}</span>
                <span class="mdn-table-view-select__chevron" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div class="mdn-table-view-menu" role="listbox" aria-label="${escHtml(labels.tableViewType)}" hidden>
                <button type="button" role="option" data-value="table" aria-selected="${currentView === 'table' ? 'true' : 'false'}" class="mdn-table-view-menu__option${currentView === 'table' ? ' is-selected' : ''}">
                  <span class="mdn-table-view-menu__label">${escHtml(labels.table)}</span>
                </button>
                <button type="button" role="option" data-value="bar" aria-selected="${currentView === 'bar' ? 'true' : 'false'}" class="mdn-table-view-menu__option${currentView === 'bar' ? ' is-selected' : ''}">
                  <span class="mdn-table-view-menu__label">${escHtml(labels.barChart)}</span>
                </button>
                <button type="button" role="option" data-value="line" aria-selected="${currentView === 'line' ? 'true' : 'false'}" class="mdn-table-view-menu__option${currentView === 'line' ? ' is-selected' : ''}">
                  <span class="mdn-table-view-menu__label">${escHtml(labels.lineChart)}</span>
                </button>
                <button type="button" role="option" data-value="pie" aria-selected="${currentView === 'pie' ? 'true' : 'false'}" class="mdn-table-view-menu__option${currentView === 'pie' ? ' is-selected' : ''}">
                  <span class="mdn-table-view-menu__label">${escHtml(labels.pieChart)}</span>
                </button>
              </div>
            </div>
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

    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (dropdown) {
      const labelEl = dropdown.querySelector('.mdn-table-view-select__label');
      if (labelEl) {
        const labels = getTableUiLabels(tableId);
        const formattedLabels: Record<string, string> = {
          table: labels.table,
          bar: labels.barChart,
          line: labels.lineChart,
          pie: labels.pieChart,
        };
        labelEl.textContent = formattedLabels[view] || view;
      }
      const options = dropdown.querySelectorAll('.mdn-table-view-menu__option');
      options.forEach(opt => {
        const optVal = opt.getAttribute('data-value');
        if (optVal === view) {
          opt.classList.add('is-selected');
          opt.setAttribute('aria-selected', 'true');
        } else {
          opt.classList.remove('is-selected');
          opt.setAttribute('aria-selected', 'false');
        }
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

      const renderSelectedChart = () => {
        const latestState = win.Table.initState(tableId);
        if (latestState.currentView === view) win.Table.renderChart(tableId, view);
      };
      const ensureChartLibrary = win.Table.ensureChartLibrary;
      if (typeof win.Chart === 'undefined' && typeof ensureChartLibrary === 'function') {
        chartContainer?.classList.add('is-loading');
        void Promise.resolve()
          .then(() => ensureChartLibrary())
          .then(renderSelectedChart)
          .catch((error) => console.error('Chart.js load error:', error))
          .finally(() => chartContainer?.classList.remove('is-loading'));
      } else {
        renderSelectedChart();
      }
    }
  };

  win.Table.toggleViewDropdown = (tableId: string, event: Event) => {
    event.stopPropagation();
    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (!dropdown) return;
    const button = dropdown.querySelector('.mdn-table-view-select') as HTMLButtonElement | null;
    const menu = dropdown.querySelector('.mdn-table-view-menu') as HTMLDivElement | null;
    if (!button || !menu) return;

    const isOpen = dropdown.classList.contains('is-open');
    if (isOpen) {
      win.Table.closeViewDropdown(tableId);
    } else {
      // Close all other view dropdowns first
      document.querySelectorAll('.mdn-table-view-dropdown.is-open').forEach((other) => {
        const otherId = other.id.replace('-view-dropdown', '');
        win.Table.closeViewDropdown(otherId);
      });

      dropdown.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      menu.removeAttribute('hidden');

      const outsideClickListener = (e: MouseEvent) => {
        if (!dropdown.contains(e.target as Node)) {
          win.Table.closeViewDropdown(tableId);
          document.removeEventListener('click', outsideClickListener);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', outsideClickListener);
      }, 0);
    }
  };

  win.Table.closeViewDropdown = (tableId: string) => {
    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (!dropdown) return;
    const button = dropdown.querySelector('.mdn-table-view-select') as HTMLButtonElement | null;
    const menu = dropdown.querySelector('.mdn-table-view-menu') as HTMLDivElement | null;
    if (button) button.setAttribute('aria-expanded', 'false');
    if (menu) menu.setAttribute('hidden', '');
    dropdown.classList.remove('is-open');
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

    const rows = getMatchedTableRows(table);

    if (rows.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'var(--txm)';
        ctx.textAlign = 'center';
        ctx.fillText(getTableUiLabels(tableId).noDataForChart, canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    const chartRows = rows;

    const labels = chartRows.map(row => {
      const text = row.cells[state.labelColIdx]?.textContent?.trim() ?? '';
      return truncateLabel(text);
    });

    const styles = getComputedStyle(document.documentElement);
    const colors = win.Table.getChartColors(state.dataColIdxs.length);

    const datasets = state.dataColIdxs.map((colIdx: number, dsIdx: number) => {
      const headerText = table.querySelectorAll('thead th')[colIdx]?.querySelector('.mdn-th-text')?.textContent?.trim() ?? formatUiLabel(getTableUiLabels(tableId).series, { index: dsIdx + 1 });
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
          animation: false,
          normalized: true,
          elements: viewType === 'line' && chartRows.length > 200
            ? { point: { radius: 0, hoverRadius: 3 } }
            : undefined,
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
