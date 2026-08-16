import { escHtml } from '../markdown/utils';
import { buildTableChartConfig, type TableChartViewType } from './tableChartConfig';
import { registerTableChartViewer, type TableChartRenderPayload } from './tableChartViewer';
import type { TableState } from './tableHandlers';
import { detectColumnTypes } from './tableHandlers';
import { getTableUiLabels } from './tableUiLabels';
import { CHART_VIEWS, isViewEligible, viewLabel, visibleScatterColIdxs, visibleSeriesColIdxs } from './tableChartViews';

function renderViewSwitcher(tableId: string, state: TableState): void {
  const switcher = document.getElementById(tableId + '-switcher');
  if (!switcher) return;
  if (!state.chartable) {
    switcher.replaceChildren();
    return;
  }
  const labels = getTableUiLabels(tableId);
  const currentView = isViewEligible(state.currentView, state) ? state.currentView : 'table';
  state.currentView = currentView;
  const optionLabels = CHART_VIEWS.map((view) => escHtml(labels[view.label]));
  const options = CHART_VIEWS.map((view) => {
    const eligible = isViewEligible(view.id, state);
    const selected = currentView === view.id;
    return `<button type="button" role="option" data-value="${view.id}" aria-selected="${selected ? 'true' : 'false'}"${eligible ? '' : ' disabled aria-disabled="true"'} class="mdn-table-view-menu__option${selected ? ' is-selected' : ''}"><span class="mdn-table-view-menu__label">${escHtml(labels[view.label])}</span></button>`;
  }).join('');

  switcher.innerHTML = `
    <div class="mdn-table-view-dropdown" id="${tableId}-view-dropdown">
      <span class="mdn-table-view-sizer" aria-hidden="true">${optionLabels.map((label) => `<span>${label}</span>`).join('')}</span>
      <button type="button" class="mdn-table-view-select tooltip-container" data-tooltip-pos="above" data-tooltip-align="right" aria-haspopup="listbox" aria-expanded="false">
        <span class="mdn-table-view-select__label">${escHtml(viewLabel(labels, currentView))}</span>
        <span class="mdn-table-view-select__chevron" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
        <span class="tooltip-text">${escHtml(labels.tableViewType)}</span>
      </button>
      <div class="mdn-table-view-menu" role="listbox" aria-label="${escHtml(labels.tableViewType)}" hidden>${options}</div>
    </div>
  `;
}

export function registerTableChartHandlers(
  win: any,
  getTableDataRows: (table: HTMLTableElement) => HTMLTableRowElement[],
  getMatchedTableRows: (table: HTMLTableElement) => HTMLTableRowElement[],
  syncWrapState: (tableId: string, state: TableState) => void,
) {
  const createChartPayload = (tableId: string, viewType: string): TableChartRenderPayload | null => {
    if (viewType === 'table') return null;
    const state = win.Table.initState(tableId) as TableState;
    if (!state.chartable || !isViewEligible(viewType, state)) return null;
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    const container = document.getElementById(`${tableId}-chart-container`);
    const canvas = document.getElementById(`${tableId}-chart-canvas`) as HTMLCanvasElement | null;
    if (!table || !canvas) return null;
    const chartRows = getMatchedTableRows(table);
    if (!chartRows.length) return null;
    const visibleColumns = viewType === 'scatter' ? visibleScatterColIdxs(state) : visibleSeriesColIdxs(state);
    return {
      config: buildTableChartConfig({
        tableId,
        viewType: viewType as TableChartViewType,
        table,
        chartRows,
        labelColIdx: state.labelColIdx,
        visibleColumns,
        getChartColors: win.Table.getChartColors,
      }),
      width: Math.max(320, container?.clientWidth || canvas.clientWidth || 800),
      height: Math.max(260, container?.clientHeight || canvas.clientHeight || 340),
      viewType,
    };
  };

  registerTableChartViewer(win, createChartPayload);

  win.Table.detectChartable = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const headers = [...table.querySelectorAll('thead th')];
    const rows = getTableDataRows(table);
    const { numericCols, labelCols } = detectColumnTypes(
      { length: headers.length },
      (rowIdx, colIdx) => rows[rowIdx]?.cells[colIdx]?.textContent?.trim() ?? '',
    );

    state.labelColIdx = labelCols[0] ?? 0;
    state.dataColIdxs = numericCols.filter((index) => index !== state.labelColIdx);
    state.scatterColIdxs = numericCols;
    state.chartable = state.dataColIdxs.length > 0;
    renderViewSwitcher(tableId, state);
  };

  win.Table.refreshChartAvailability = (tableId: string) => {
    const state = win.Table.initState(tableId);
    if (state.currentView !== 'table' && !isViewEligible(state.currentView, state)) {
      win.Table.switchView(tableId, 'table');
      renderViewSwitcher(tableId, state);
      return;
    }
    renderViewSwitcher(tableId, state);
    if (state.currentView !== 'table') win.Table.renderChart(tableId, state.currentView);
  };

  win.Table.switchView = (tableId: string, view: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    if (state.chartable && !isViewEligible(view, state)) return;
    state.currentView = view;

    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (dropdown) {
      const labelEl = dropdown.querySelector('.mdn-table-view-select__label');
      if (labelEl) labelEl.textContent = viewLabel(getTableUiLabels(tableId), view);
      dropdown.querySelectorAll('.mdn-table-view-menu__option').forEach((option) => {
        const selected = option.getAttribute('data-value') === view;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', String(selected));
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
      return;
    }

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
  };

  win.Table.toggleViewDropdown = (tableId: string, event: Event) => {
    event.stopPropagation();
    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (!dropdown) return;
    const button = dropdown.querySelector('.mdn-table-view-select') as HTMLButtonElement | null;
    const menu = dropdown.querySelector('.mdn-table-view-menu') as HTMLDivElement | null;
    if (!button || !menu) return;

    if (dropdown.classList.contains('is-open')) {
      win.Table.closeViewDropdown(tableId);
      return;
    }
    document.querySelectorAll('.mdn-table-view-dropdown.is-open').forEach((other) => {
      win.Table.closeViewDropdown((other as HTMLElement).id.replace('-view-dropdown', ''));
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
    setTimeout(() => document.addEventListener('click', outsideClickListener), 0);
  };

  win.Table.closeViewDropdown = (tableId: string) => {
    const dropdown = document.getElementById(tableId + '-view-dropdown');
    if (!dropdown) return;
    const button = dropdown.querySelector('.mdn-table-view-select') as HTMLButtonElement | null;
    const menu = dropdown.querySelector('.mdn-table-view-menu') as HTMLDivElement | null;
    button?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('hidden', '');
    dropdown.classList.remove('is-open');
  };

  win.Table.getChartColors = (count: number) => {
    const styles = getComputedStyle(document.documentElement);
    const baseColors = Array.from({ length: 8 }, (_, idx) => {
      const token = styles.getPropertyValue(`--chart-${idx + 1}`).trim();
      return token || ['#8b7cf8', '#34d399', '#f87171', '#60a5fa', '#fbbf24', '#ec4899', '#a855f7', '#14b8a6'][idx];
    });
    return Array.from({ length: count }, (_, index) => baseColors[index % baseColors.length]);
  };

  win.Table.renderChart = (tableId: string, viewType: string) => {
    const state = win.Table.initState(tableId) as TableState;
    if (!state.chartable || !isViewEligible(viewType, state)) return;
    const canvas = document.getElementById(tableId + '-chart-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    state.chartInstance?.destroy?.();
    state.chartInstance = null;
    const payload = createChartPayload(tableId, viewType);
    if (!payload) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--txm').trim() || '#777';
        ctx.textAlign = 'center';
        ctx.fillText(getTableUiLabels(tableId).noDataForChart, canvas.width / 2, canvas.height / 2);
      }
      return;
    }
    if (typeof win.Chart === 'undefined') return;
    state.chartInstance = new win.Chart(canvas, payload.config);
    win.Table.bindChartCanvas(tableId, viewType);
  };
}
