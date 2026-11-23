import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CHART_SCALE, registerTableChartViewer } from '../../../../ui/src/dom/tableChartViewer';

let frames: FrameRequestCallback[] = [];
function flushFrames() {
  for (let i = 0; i < 5 && frames.length; i += 1) {
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(0));
  }
}

function makeChartClass() {
  const created: any[] = [];
  function Chart(this: any, canvas: HTMLCanvasElement, config: any) {
    const hiddenItems = new Map<number, boolean>();
    const instance = {
      canvas,
      config,
      data: config.data,
      legend: { height: 12 },
      destroy: vi.fn(),
      update: vi.fn(),
      resize: vi.fn(),
      getDataVisibility: (i: number) => hiddenItems.get(i) ?? true,
      toggleDataVisibility: (i: number) => hiddenItems.set(i, !(hiddenItems.get(i) ?? true)),
      isDatasetVisible: () => true,
      setDatasetVisibility: vi.fn(),
    };
    created.push(instance);
    return instance;
  }
  return { Chart: Chart as any, created };
}

function pointer(type: string, init: { button?: number; pointerId?: number; clientX?: number; clientY?: number }) {
  const event = new MouseEvent(type, { bubbles: true, button: init.button ?? 0, clientX: init.clientX, clientY: init.clientY });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  return event;
}

const pieConfig = { type: 'pie', data: { labels: ['a', 'b'], datasets: [{ data: [1, 2], backgroundColor: ['red', 'blue'] }] } };
const barConfig = { type: 'bar', data: { labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, 2] }] } };

function setup(options: { sourceCanvas?: boolean; getChart?: boolean } = {}) {
  const { Chart, created } = makeChartClass();
  const sourceChart = { data: pieConfig.data, getDataVisibility: (i: number) => i !== 0, toggleDataVisibility: vi.fn(), update: vi.fn(), chartArea: { left: 0, right: 100, top: 0, bottom: 100 }, width: 100, height: 100 };
  if (options.getChart !== false) Chart.getChart = vi.fn(() => sourceChart);
  const state = { columns: ['L', 'V'], dataColIdxs: [1], scatterColIdxs: [1], hiddenColumnIdxs: [], series: [{ name: 'V', values: [1, 2] }], chartInstance: sourceChart };
  const win: any = { Chart, Table: { initState: vi.fn(() => state) } };
  let payloadAvailable = true;
  const createPayload = vi.fn((_id: string, view: string) => payloadAvailable
    ? { config: view === 'pie' || view === 'doughnut' ? pieConfig : barConfig, width: 400, height: 300, viewType: view }
    : null);
  if (options.sourceCanvas !== false) {
    const canvas = document.createElement('canvas');
    canvas.id = 'tbl-chart-canvas';
    canvas.getBoundingClientRect = () => ({ width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(canvas);
  }
  registerTableChartViewer(win, createPayload);
  return { win, created, createPayload, sourceChart, setPayload: (value: boolean) => { payloadAvailable = value; } };
}

const viewer = () => document.querySelector<HTMLElement>('.mdn-chart-viewer');

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('table chart viewer interactions', () => {
  it('does not open without a payload or Chart.js', () => {
    const { win, setPayload } = setup();
    setPayload(false);
    win.Table.openChartViewer('tbl', 'pie');
    expect(viewer()).toBeNull();
    setPayload(true);
    const chart = win.Chart;
    win.Chart = undefined;
    win.Table.openChartViewer('tbl', 'pie');
    expect(viewer()).toBeNull();
    win.Chart = chart;
  });

  it('toggles item legends from the HTML legend and the Chart.js legend', () => {
    const { win, created } = setup();
    win.Table.openChartViewer('tbl', 'pie');
    flushFrames();
    const items = () => [...viewer()!.querySelectorAll<HTMLElement>('[data-chart-legend-index]')];
    expect(items()[0].classList.contains('is-hidden')).toBe(true);
    items()[1].click();
    expect(items()[1].classList.contains('is-hidden')).toBe(true);
    const legendChart = created.find((chart) => chart.config.options.plugins.legend.display === true);
    legendChart.config.options.plugins.legend.onClick(null, { index: 1 }, { chart: legendChart });
    expect(items()[1].classList.contains('is-hidden')).toBe(false);
    items()[0].dataset.chartLegendIndex = 'x';
    items()[0].click();
    expect(legendChart.resize).toHaveBeenCalled();
  });

  it('switches chart types from the type menu and closes it on outside clicks', () => {
    const { win } = setup();
    win.Table.openChartViewer('tbl', 'pie');
    flushFrames();
    const root = viewer()!;
    const dropdown = root.querySelector('.mdn-chart-viewer__type-dropdown')!;
    root.querySelector<HTMLElement>('[data-chart-action="toggle-type-menu"]')!.click();
    expect(dropdown.classList.contains('is-open')).toBe(true);
    root.querySelector<HTMLElement>('[data-chart-view-option="pie"]')?.click();
    expect(dropdown.classList.contains('is-open')).toBe(false);
    const options = [...root.querySelectorAll<HTMLElement>('[data-chart-view-option]')];
    const other = options.find((option) => option.dataset.chartViewOption !== 'pie');
    if (other) {
      other.click();
      expect(other.getAttribute('aria-selected')).toBe('true');
    }
    root.querySelector<HTMLElement>('[data-chart-action="toggle-type-menu"]')!.click();
    root.querySelector<HTMLElement>('.mdn-modal-zoom-text')!.click();
    expect(dropdown.classList.contains('is-open')).toBe(false);
    root.click();
    expect(viewer()).toBeNull();
  });

  it('zooms with the wheel around the pointer and stops at the maximum scale', () => {
    const { win } = setup();
    win.Table.openChartViewer('tbl', 'bar');
    const root = viewer()!;
    const viewport = root.querySelector<HTMLElement>('.mdn-chart-viewer__viewport')!;
    const zoom = root.querySelector('.mdn-modal-zoom-text')!;
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, cancelable: true }));
    expect(zoom.textContent).toBe('100%');
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, clientX: 50, clientY: 50, cancelable: true }));
    expect(zoom.textContent).toBe('110%');
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, cancelable: true }));
    expect(zoom.textContent).toBe('100%');
    for (let i = 0; i < 100; i += 1) viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, cancelable: true }));
    expect(zoom.textContent).toBe(`${MAX_CHART_SCALE}%`);
  });

  it('pans the viewport with the primary pointer only', () => {
    const { win } = setup();
    win.Table.openChartViewer('tbl', 'bar');
    const viewport = viewer()!.querySelector<HTMLElement>('.mdn-chart-viewer__viewport')!;
    viewport.dispatchEvent(pointer('pointerdown', { button: 2 }));
    expect(viewport.classList.contains('is-panning')).toBe(false);
    viewport.dispatchEvent(pointer('pointermove', { clientX: 5 }));
    viewport.dispatchEvent(pointer('pointerup', {}));
    viewport.dispatchEvent(pointer('pointerdown', { pointerId: 7, clientX: 100, clientY: 100 }));
    expect(viewport.classList.contains('is-panning')).toBe(true);
    viewport.dispatchEvent(pointer('pointermove', { pointerId: 8, clientX: 0, clientY: 0 }));
    viewport.dispatchEvent(pointer('pointermove', { pointerId: 7, clientX: 90, clientY: 80 }));
    viewport.dispatchEvent(pointer('pointerup', { pointerId: 8 }));
    expect(viewport.classList.contains('is-panning')).toBe(true);
    viewport.dispatchEvent(pointer('pointercancel', { pointerId: 7 }));
    expect(viewport.classList.contains('is-panning')).toBe(false);
  });

  it('keeps the viewer stable when payloads disappear after opening', () => {
    const { win, setPayload } = setup({ sourceCanvas: false });
    win.Table.openChartViewer('tbl', 'bar');
    setPayload(false);
    flushFrames();
    const root = viewer()!;
    root.querySelector<HTMLElement>('[data-chart-action="zoom-in"]')!.click();
    root.querySelector<HTMLElement>('[data-chart-action="fit"]')!.click();
    expect(root.querySelector('.mdn-modal-zoom-text')!.textContent).toBe('100%');
    win.Table.closeChartViewer();
    flushFrames();
  });

  it('binds source canvases once and uses the table state chart as a fallback', () => {
    const { win } = setup({ getChart: false });
    win.Table.bindChartCanvas('missing', 'bar');
    win.Table.bindChartCanvas('tbl', 'pie');
    win.Table.bindChartCanvas('tbl', 'bar');
    const canvas = document.getElementById('tbl-chart-canvas') as HTMLCanvasElement;
    expect(canvas.dataset.mdnChartViewType).toBe('bar');
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 500, clientY: 500 }));
    expect(canvas.style.cursor).toBe('default');
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 500, clientY: 500 }));
    expect(viewer()).toBeNull();
    delete canvas.dataset.mdnChartTableId;
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 50, clientY: 50 }));
    expect(viewer()).toBeNull();
  });
});
