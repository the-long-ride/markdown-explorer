import { closeChartContextMenu, showChartContextMenu } from './tableChartImageActions';
import { getTableUiLabels } from './tableUiLabels';
import { MODAL_CHART_VIEWS, isViewEligible, usesItemLegend, viewLabel } from './tableChartViews';
import { applyChartVisibility, buildLegendConfig, buildPlotConfig, captureChartVisibility, composeChartCanvases, toggleChartLegendVisibility } from './tableChartViewerChart';
import { renderLegendItems } from './tableChartViewerLegend';

export const MIN_CHART_SCALE = 50;
export const MAX_CHART_SCALE = 1000;
export const CHART_SCALE_STEP = 10;

export interface TableChartRenderPayload {
  config: any;
  width: number;
  height: number;
  viewType: string;
}

type ChartPayloadFactory = (tableId: string, viewType: string) => TableChartRenderPayload | null;
const ZOOM_IN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
const ZOOM_OUT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
const RESET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const FIT_ICON = '<svg viewBox="0 0 122.88 122.76" fill="currentColor" aria-hidden="true"><path d="M114.89,89.82c0-2.21,1.79-4,4-4c2.21,0,4,1.79,4,4v28.75c0,2.21-1.79,4-4,4H89.67c-2.21,0-4-1.79-4-4c0-2.21,1.79-4,4-4 h19.18L74.49,82.09c-1.6-1.51-1.68-4.03-0.17-5.64c1.51-1.6,4.03-1.68,5.64-0.17l34.93,33.02V89.82L114.89,89.82z M89.82,7.99 c-2.21,0-4-1.79-4-4c0-2.21,1.79-4,4-4h28.75c2.21,0,4,1.79,4,4v29.21c0,2.21-1.79,4-4,4c-2.21,0-4-1.79-4-4V14.03L82.09,48.39 c-1.51,1.6-4.03,1.68-5.64,0.17c-1.6-1.51-1.68-4.03-0.17-5.64L109.3,7.99H89.82L89.82,7.99z M7.99,32.76c0,2.21-1.79,4-4,4 c-2.21,0-4-1.79-4-4V4.01c0-2.21,1.79-4,4-4h29.21c2.21,0,4,1.79,4,4c0,2.21-1.79,4-4,4H14.03l34.36,32.48 c1.6,1.51,1.68,4.03,0.17,5.64c-1.51,1.6-4.03,1.68-5.64,0.17L7.99,13.28V32.76L7.99,32.76z M32.94,114.77c2.21,0,4,1.79,4,4 c0,2.21-1.79,4-4,4H4.19c-2.21,0-4-1.79-4-4V89.55c0-2.21,1.79-4,4-4c2.21,0,4,1.79,4,4v19.18l32.48-34.36 c1.51-1.6,4.03-1.68,5.64-0.17c1.6,1.51,1.68,4.03,0.17,5.64l-33.02,34.93H32.94L32.94,114.77z"/></svg>';

function clampScale(value: number): number {
  return Math.min(MAX_CHART_SCALE, Math.max(MIN_CHART_SCALE, value));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function renderModalChartTypeDropdown(labels: ReturnType<typeof getTableUiLabels>, state: any, activeViewType: string): string {
  const views = MODAL_CHART_VIEWS.filter((view) => isViewEligible(view.id, state));
  const optionLabels = views.map((view) => escapeHtml(labels[view.label]));
  const options = views.map((view) => {
    const selected = activeViewType === view.id;
    return `<button type="button" role="option" data-chart-view-option="${view.id}" aria-selected="${selected ? 'true' : 'false'}" class="mdn-table-view-menu__option${selected ? ' is-selected' : ''}"><span class="mdn-table-view-menu__label">${escapeHtml(labels[view.label])}</span></button>`;
  }).join('');
  return `
    <div class="mdn-table-view-dropdown mdn-chart-viewer__type-dropdown">
      <span class="mdn-table-view-sizer" aria-hidden="true">${optionLabels.map((label) => `<span>${label}</span>`).join('')}</span>
      <button type="button" class="mdn-table-view-select tooltip-container" data-chart-action="toggle-type-menu" data-tooltip-pos="above" aria-haspopup="listbox" aria-expanded="false">
        <span class="mdn-table-view-select__label">${escapeHtml(viewLabel(labels, activeViewType))}</span>
        <span class="mdn-table-view-select__chevron" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
        <span class="tooltip-text">${escapeHtml(labels.tableViewType)}</span>
      </button>
      <div class="mdn-table-view-menu mdn-chart-viewer__type-menu" role="listbox" aria-label="${escapeHtml(labels.tableViewType)}" hidden>${options}</div>
    </div>`;
}

function getChartInstance(win: any, canvas: HTMLCanvasElement, tableId: string): any {
  return win.Chart?.getChart?.(canvas) ?? win.Table?.initState?.(tableId)?.chartInstance ?? null;
}

function chartPoint(chart: any, event: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: (event.clientX - rect.left) * ((chart?.width || rect.width) / rect.width),
    y: (event.clientY - rect.top) * ((chart?.height || rect.height) / rect.height),
  };
}

export function isPointInsideChartArea(chart: any, event: MouseEvent, canvas: HTMLCanvasElement): boolean {
  if (!chart?.chartArea) return false;
  const point = chartPoint(chart, event, canvas);
  if (!point) return false;
  const contains = (area: any) => area && point.x >= area.left && point.x <= area.right && point.y >= area.top && point.y <= area.bottom;
  if (contains(chart.chartArea)) return true;
  return Object.values(chart.scales ?? {}).some((scale: any) => contains(scale));
}

export function isPointInsideChartLegend(chart: any, event: MouseEvent, canvas: HTMLCanvasElement): boolean {
  const point = chartPoint(chart, event, canvas);
  const hitBoxes = chart?.legend?.legendHitBoxes;
  if (!point || !Array.isArray(hitBoxes)) return false;
  return hitBoxes.some((box: any) => point.x >= box.left && point.x <= box.left + box.width
    && point.y >= box.top && point.y <= box.top + box.height);
}

export function registerTableChartViewer(win: any, createPayload: ChartPayloadFactory) {
  let plotChart: any = null;
  let legendChart: any = null;
  let backdrop: HTMLDivElement | null = null;
  let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  const closeViewer = () => {
    plotChart?.destroy?.();
    legendChart?.destroy?.();
    plotChart = null;
    legendChart = null;
    backdrop?.remove();
    backdrop = null;
    closeChartContextMenu();
    if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  };

  win.Table.closeChartViewer = closeViewer;

  win.Table.openChartViewer = (tableId: string, viewType: string) => {
    const initialPayload = createPayload(tableId, viewType);
    if (!initialPayload || typeof win.Chart === 'undefined') return;
    closeViewer();
    const labels = getTableUiLabels(tableId);
    const modalState = win.Table.initState(tableId);
    const sourceCanvas = document.getElementById(`${tableId}-chart-canvas`) as HTMLCanvasElement | null;
    const sourceChart = sourceCanvas ? getChartInstance(win, sourceCanvas, tableId) : null;
    let activeViewType = viewType;
    const hiddenDatasets = new Set<number>();
    const hiddenItems = new Set<number>();
    captureChartVisibility(sourceChart, activeViewType, hiddenDatasets, hiddenItems);

    backdrop = document.createElement('div');
    backdrop.className = 'mdn-modal mdn-chart-viewer';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', labels.chartViewTitle);
    backdrop.innerHTML = `
      <button type="button" class="mdn-modal-close tooltip-container" data-chart-action="close" aria-label="${escapeHtml(labels.closeChartView)}" data-tooltip-pos="below" data-tooltip-align="right">
        ${CLOSE_ICON}<span class="tooltip-text">${escapeHtml(labels.closeChartView)}</span>
      </button>
      <div class="mdn-chart-viewer__stage">
        <div class="mdn-chart-viewer__viewport">
          <div class="mdn-chart-viewer__pan-surface">
            <div class="mdn-chart-viewer__plot"><canvas></canvas></div>
          </div>
        </div>
        <div class="mdn-modal-footer mdn-chart-viewer__footer">
          <div class="mdn-chart-viewer__legend"><div class="mdn-chart-viewer__legend-items"></div><div class="mdn-chart-viewer__legend-export" aria-hidden="true"><canvas></canvas></div></div>
          <div class="mdn-modal-toolbar">
            ${renderModalChartTypeDropdown(labels, modalState, activeViewType)}
            <button type="button" class="mdn-modal-tool tooltip-container" data-chart-action="zoom-in" aria-label="${escapeHtml(labels.chartZoom)} +" data-tooltip-pos="above">
              ${ZOOM_IN_ICON}<span class="tooltip-text">${escapeHtml(labels.chartZoom)} +</span>
            </button>
            <span class="mdn-modal-zoom-text">100%</span>
            <button type="button" class="mdn-modal-tool tooltip-container" data-chart-action="zoom-out" aria-label="${escapeHtml(labels.chartZoom)} −" data-tooltip-pos="above">
              ${ZOOM_OUT_ICON}<span class="tooltip-text">${escapeHtml(labels.chartZoom)} −</span>
            </button>
            <button type="button" class="mdn-modal-tool tooltip-container" data-chart-action="100" aria-label="100%" data-tooltip-pos="above">
              ${RESET_ICON}<span class="tooltip-text">100%</span>
            </button>
            <button type="button" class="mdn-modal-tool tooltip-container mdn-chart-viewer__fit" data-chart-action="fit" aria-label="${escapeHtml(labels.chartFit)}" data-tooltip-pos="above">
              ${FIT_ICON}<span class="tooltip-text">${escapeHtml(labels.chartFit)}</span>
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const viewport = backdrop.querySelector('.mdn-chart-viewer__viewport') as HTMLDivElement;
    const panSurface = backdrop.querySelector('.mdn-chart-viewer__pan-surface') as HTMLDivElement;
    const plotShell = backdrop.querySelector('.mdn-chart-viewer__plot') as HTMLDivElement;
    const plotCanvas = backdrop.querySelector('.mdn-chart-viewer__plot canvas') as HTMLCanvasElement;
    const legendItems = backdrop.querySelector('.mdn-chart-viewer__legend-items') as HTMLDivElement;
    const legendExportSurface = backdrop.querySelector('.mdn-chart-viewer__legend-export') as HTMLDivElement;
    const legendCanvas = legendExportSurface.querySelector('canvas') as HTMLCanvasElement;
    const zoomText = backdrop.querySelector('.mdn-modal-zoom-text') as HTMLSpanElement;
    const typeDropdown = backdrop.querySelector('.mdn-chart-viewer__type-dropdown') as HTMLDivElement;
    const typeButton = typeDropdown.querySelector('.mdn-table-view-select') as HTMLButtonElement;
    const typeMenu = typeDropdown.querySelector('.mdn-chart-viewer__type-menu') as HTMLDivElement;
    const typeLabel = typeDropdown.querySelector('.mdn-table-view-select__label') as HTMLSpanElement;
    let currentScale = 100;

    const sourceChartForActiveView = () => activeViewType === viewType ? sourceChart : null;
    const syncVisibility = () => {
      [legendChart, plotChart, sourceChartForActiveView()].filter(Boolean).forEach((chart) => applyChartVisibility(chart, activeViewType, hiddenDatasets, hiddenItems));
    };

    const refreshLegendItems = (config?: any) => {
      const payload = config ? { config } : createPayload(tableId, activeViewType);
      if (!payload) return;
      legendItems.innerHTML = renderLegendItems(payload.config, activeViewType, hiddenDatasets, hiddenItems);
    };

    const renderLegend = () => {
      legendChart?.destroy?.();
      const payload = createPayload(tableId, activeViewType);
      if (!payload) return;
      refreshLegendItems(payload.config);
      legendExportSurface.style.width = `${Math.max(360, Math.min(payload.width, 960))}px`;
      legendExportSurface.style.height = '320px';
      legendChart = new win.Chart(legendCanvas, buildLegendConfig(payload.config, (item, chart) => {
        toggleChartLegendVisibility(item, activeViewType, hiddenDatasets, hiddenItems, [chart, plotChart, sourceChartForActiveView()]);
        refreshLegendItems(payload.config);
      }));
      applyChartVisibility(legendChart, activeViewType, hiddenDatasets, hiddenItems);
      legendChart.update?.();
      const syncLegendExportHeight = (pass = 0) => {
        if (!legendChart || !legendExportSurface.isConnected) return;
        const measuredHeight = Math.ceil(legendChart.legend?.height ?? 30);
        legendExportSurface.style.height = `${Math.max(56, measuredHeight + 24)}px`;
        legendChart.resize?.();
        legendChart.update?.('none');
        if (pass === 0) requestAnimationFrame(() => syncLegendExportHeight(1));
      };
      requestAnimationFrame(() => syncLegendExportHeight());
    };

    const renderAtScale = (requestedScale: number) => {
      currentScale = clampScale(requestedScale);
      const payload = createPayload(tableId, activeViewType);
      if (!payload) return;
      const width = Math.max(240, Math.round(payload.width * currentScale / 100));
      const height = Math.max(220, Math.round(payload.height * currentScale / 100));
      plotChart?.destroy?.();
      plotShell.style.width = `${width}px`;
      plotShell.style.height = `${height}px`;
      const panSurfaceStyle = getComputedStyle(panSurface);
      const panGutter = parseFloat(panSurfaceStyle.paddingLeft || '0');
      const availableWidth = Math.max(0, viewport.clientWidth);
      const availableHeight = Math.max(0, viewport.clientHeight);
      panSurface.classList.toggle('is-centered-x', width + panGutter * 2 <= availableWidth);
      panSurface.classList.toggle('is-centered-y', height + panGutter * 2 <= availableHeight);
      zoomText.textContent = `${currentScale}%`;
      plotChart = new win.Chart(plotCanvas, buildPlotConfig(payload.config));
      applyChartVisibility(plotChart, activeViewType, hiddenDatasets, hiddenItems);
      plotChart.update?.();
    };

    const renderFit = () => {
      const payload = createPayload(tableId, activeViewType);
      if (!payload) return;
      const panSurfaceStyle = getComputedStyle(panSurface);
      const panGutter = parseFloat(panSurfaceStyle.paddingLeft || '0');
      const widthRatio = Math.max(0, viewport.clientWidth - panGutter * 2) / Math.max(1, payload.width);
      const heightRatio = Math.max(0, viewport.clientHeight - panGutter * 2) / Math.max(1, payload.height);
      const raw = Math.min(widthRatio, heightRatio) * 100;
      const stepped = Math.floor(raw / CHART_SCALE_STEP) * CHART_SCALE_STEP;
      renderAtScale(clampScale(stepped || MIN_CHART_SCALE));
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };

    const setTypeMenuOpen = (open: boolean) => {
      typeDropdown.classList.toggle('is-open', open);
      typeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      typeMenu.toggleAttribute('hidden', !open);
    };

    const syncTypeControl = () => {
      typeLabel.textContent = viewLabel(labels, activeViewType);
      typeMenu.querySelectorAll<HTMLElement>('[data-chart-view-option]').forEach((option) => {
        const selected = option.dataset.chartViewOption === activeViewType;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    };

    const switchModalChartType = (nextViewType: string) => {
      if (nextViewType === activeViewType || !isViewEligible(nextViewType, modalState)) {
        setTypeMenuOpen(false);
        return;
      }
      const previousViewType = activeViewType;
      if (usesItemLegend(previousViewType) !== usesItemLegend(nextViewType)) {
        hiddenDatasets.clear();
        hiddenItems.clear();
      }
      activeViewType = nextViewType;
      setTypeMenuOpen(false);
      syncTypeControl();
      renderAtScale(currentScale);
      renderLegend();
    };

    const exportCanvas = () => composeChartCanvases(plotCanvas, legendCanvas);
    const showModalContextMenu = (event: MouseEvent) => showChartContextMenu(exportCanvas, tableId, activeViewType, event);
    legendItems.addEventListener('contextmenu', showModalContextMenu);
    plotCanvas.addEventListener('contextmenu', showModalContextMenu);

    backdrop.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const legendItem = target.closest<HTMLElement>('[data-chart-legend-index]');
      if (legendItem) {
        const index = Number(legendItem.dataset.chartLegendIndex);
        if (Number.isInteger(index)) {
          const item = usesItemLegend(activeViewType) ? { index } : { datasetIndex: index };
          toggleChartLegendVisibility(item, activeViewType, hiddenDatasets, hiddenItems, [legendChart, plotChart, sourceChartForActiveView()]);
          refreshLegendItems();
        }
        return;
      }
      if (target === backdrop) {
        closeViewer();
        return;
      }
      const chartViewOption = target.closest<HTMLElement>('[data-chart-view-option]')?.dataset.chartViewOption;
      if (chartViewOption) {
        switchModalChartType(chartViewOption);
        return;
      }
      const action = target.closest<HTMLElement>('[data-chart-action]')?.dataset.chartAction;
      if (action === 'close') closeViewer();
      else if (action === 'toggle-type-menu') setTypeMenuOpen(!typeDropdown.classList.contains('is-open'));
      else if (action === 'fit') { setTypeMenuOpen(false); renderFit(); }
      else if (action === '100') { setTypeMenuOpen(false); renderAtScale(100); }
      else if (action === 'zoom-in') { setTypeMenuOpen(false); renderAtScale(currentScale + CHART_SCALE_STEP); }
      else if (action === 'zoom-out') { setTypeMenuOpen(false); renderAtScale(currentScale - CHART_SCALE_STEP); }
      else if (!typeDropdown.contains(target)) setTypeMenuOpen(false);
    });

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (event.deltaY === 0) return;
      const previousScale = currentScale;
      const nextScale = clampScale(currentScale + (event.deltaY < 0 ? CHART_SCALE_STEP : -CHART_SCALE_STEP));
      if (nextScale === previousScale) return;
      const viewportRect = viewport.getBoundingClientRect();
      const plotRect = plotShell.getBoundingClientRect();
      const pointerX = event.clientX - viewportRect.left;
      const pointerY = event.clientY - viewportRect.top;
      const plotPointX = Math.min(1, Math.max(0, (event.clientX - plotRect.left) / Math.max(1, plotRect.width)));
      const plotPointY = Math.min(1, Math.max(0, (event.clientY - plotRect.top) / Math.max(1, plotRect.height)));
      renderAtScale(nextScale);
      const nextContentX = plotShell.offsetLeft + plotPointX * plotShell.offsetWidth;
      const nextContentY = plotShell.offsetTop + plotPointY * plotShell.offsetHeight;
      viewport.scrollLeft = Math.max(0, nextContentX - pointerX);
      viewport.scrollTop = Math.max(0, nextContentY - pointerY);
    }, { passive: false });

    let pan: { x: number; y: number; left: number; top: number; pointerId: number } | null = null;
    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target instanceof HTMLButtonElement) return;
      pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, pointerId: event.pointerId };
      viewport.setPointerCapture?.(event.pointerId);
      viewport.classList.add('is-panning');
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!pan || event.pointerId !== pan.pointerId) return;
      viewport.scrollLeft = pan.left - (event.clientX - pan.x);
      viewport.scrollTop = pan.top - (event.clientY - pan.y);
    });
    const stopPan = (event: PointerEvent) => {
      if (!pan || event.pointerId !== pan.pointerId) return;
      viewport.releasePointerCapture?.(event.pointerId);
      pan = null;
      viewport.classList.remove('is-panning');
    };
    viewport.addEventListener('pointerup', stopPan);
    viewport.addEventListener('pointercancel', stopPan);

    escapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (typeDropdown.classList.contains('is-open')) setTypeMenuOpen(false);
        else closeViewer();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    requestAnimationFrame(() => {
      renderLegend();
      syncVisibility();
      renderFit();
    });
  };

  win.Table.bindChartCanvas = (tableId: string, viewType: string) => {
    const canvas = document.getElementById(`${tableId}-chart-canvas`) as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.dataset.mdnChartTableId = tableId;
    canvas.dataset.mdnChartViewType = viewType;
    if (canvas.dataset.mdnChartViewerBound === 'true') return;
    canvas.dataset.mdnChartViewerBound = 'true';
    canvas.addEventListener('pointermove', (event) => {
      const activeTable = canvas.dataset.mdnChartTableId;
      if (!activeTable) return;
      const chart = getChartInstance(win, canvas, activeTable);
      canvas.style.cursor = isPointInsideChartLegend(chart, event, canvas)
        ? 'pointer'
        : isPointInsideChartArea(chart, event, canvas) ? 'zoom-in' : 'default';
    });
    canvas.addEventListener('pointerleave', () => {
      canvas.style.cursor = 'default';
    });
    canvas.addEventListener('click', (event) => {
      const activeView = canvas.dataset.mdnChartViewType;
      const activeTable = canvas.dataset.mdnChartTableId;
      if (!activeTable || !activeView) return;
      const chart = getChartInstance(win, canvas, activeTable);
      if (isPointInsideChartArea(chart, event, canvas)) win.Table.openChartViewer(activeTable, activeView);
    });
    canvas.addEventListener('contextmenu', (event) => {
      const activeView = canvas.dataset.mdnChartViewType;
      const activeTable = canvas.dataset.mdnChartTableId;
      if (activeTable && activeView) showChartContextMenu(canvas, activeTable, activeView, event);
    });
  };
}
