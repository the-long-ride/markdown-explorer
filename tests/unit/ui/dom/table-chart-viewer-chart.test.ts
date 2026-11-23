import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyChartVisibility,
  buildLegendConfig,
  buildPlotConfig,
  captureChartVisibility,
  composeChartCanvases,
  toggleChartLegendVisibility,
} from '../../../../ui/src/dom/tableChartViewerChart';

function fakeChart(labels: string[], datasets: number) {
  const items = new Map<number, boolean>();
  const sets = new Map<number, boolean>();
  return {
    data: { labels, datasets: Array.from({ length: datasets }, () => ({})) },
    getDataVisibility: vi.fn((i: number) => items.get(i) ?? true),
    toggleDataVisibility: vi.fn((i: number) => items.set(i, !(items.get(i) ?? true))),
    isDatasetVisible: vi.fn((i: number) => sets.get(i) ?? true),
    setDatasetVisibility: vi.fn((i: number, v: boolean) => sets.set(i, v)),
    update: vi.fn(),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('tableChartViewerChart', () => {
  it('clones chart data deeply and hides the plot legend', () => {
    const point = { x: 1 };
    const base = { type: 'bar', data: { labels: ['a'], datasets: [{ data: [point, 2, null] }, { data: 'raw' }] }, options: { plugins: { legend: { labels: {} } } } };
    const plot = buildPlotConfig(base);
    expect(plot.data.datasets[0].data[0]).toEqual(point);
    expect(plot.data.datasets[0].data[0]).not.toBe(point);
    expect(plot.data.datasets[1].data).toBe('raw');
    expect(plot.options.plugins.legend).toEqual({ labels: {}, display: false });
    expect(buildPlotConfig(undefined).data).toBeUndefined();
    expect(buildPlotConfig({ data: { labels: 'x', datasets: 'y' } }).data).toEqual({ labels: 'x', datasets: 'y' });
  });

  it('builds a legend-only config that hides scales and clears the plot area', () => {
    const onClick = vi.fn();
    const legend = buildLegendConfig({
      plugins: [{ id: 'other' }],
      data: { datasets: [] },
      options: { scales: { x: { grid: { color: 'red' } }, y: null }, plugins: { tooltip: { mode: 'x' } } },
    }, onClick);
    expect(legend.options.scales.x).toMatchObject({ display: false, grid: { color: 'red', display: false } });
    expect(legend.options.scales.y.ticks).toEqual({ display: false });
    expect(legend.options.plugins.tooltip).toEqual({ mode: 'x', enabled: false });
    const chart = { id: 1 };
    legend.options.plugins.legend.onClick(null, { index: 0 }, { chart });
    expect(onClick).toHaveBeenCalledWith({ index: 0 }, chart);
    const plugin = legend.plugins[1];
    const clearRect = vi.fn();
    plugin.afterDraw({ ctx: { clearRect } });
    plugin.afterDraw({ ctx: { clearRect }, chartArea: { left: 10, top: 10, right: 30, bottom: 40 } });
    expect(clearRect).toHaveBeenCalledWith(8, 8, 24, 34);
    expect(buildLegendConfig(null, onClick).options.scales).toBeUndefined();
  });

  it('applies and captures item and dataset visibility', () => {
    const pie = fakeChart(['a', 'b', 'c'], 1);
    applyChartVisibility(pie, 'pie', new Set(), new Set([1]));
    expect(pie.toggleDataVisibility).toHaveBeenCalledTimes(1);
    const items = new Set<number>();
    captureChartVisibility(pie, 'pie', new Set(), items);
    expect([...items]).toEqual([1]);
    applyChartVisibility(null, 'pie', new Set(), new Set());
    captureChartVisibility(null, 'bar', new Set(), new Set());
    applyChartVisibility({}, 'pie', new Set(), new Set());
    captureChartVisibility({}, 'pie', new Set(), new Set());

    const bar = fakeChart([], 2);
    applyChartVisibility(bar, 'bar', new Set([0]), new Set());
    const sets = new Set<number>();
    captureChartVisibility(bar, 'bar', sets, new Set());
    expect([...sets]).toEqual([0]);
    captureChartVisibility({}, 'bar', new Set(), new Set());
  });

  it('toggles legend items for item and dataset legends', () => {
    const chart = fakeChart(['a', 'b'], 2);
    const sets = new Set<number>();
    const items = new Set<number>();
    toggleChartLegendVisibility({ index: 1 }, 'doughnut', sets, items, [chart, null]);
    expect([...items]).toEqual([1]);
    toggleChartLegendVisibility({ index: 1 }, 'doughnut', sets, items, [chart]);
    expect(items.size).toBe(0);
    toggleChartLegendVisibility({ datasetIndex: 0 }, 'line', sets, items, [chart]);
    expect([...sets]).toEqual([0]);
    toggleChartLegendVisibility({ datasetIndex: 0 }, 'line', sets, items, [{}]);
    expect(sets.size).toBe(0);
    toggleChartLegendVisibility({}, 'line', sets, items, [chart]);
    expect(chart.update).toHaveBeenCalled();
  });

  it('composes plot and legend canvases onto a themed background', () => {
    const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    expect(composeChartCanvases(canvas(0, 10), canvas(10, 10))).toBeNull();
    expect(composeChartCanvases(canvas(10, 0), canvas(10, 10))).toBeNull();
    expect(composeChartCanvases(canvas(10, 10), canvas(0, 10))).toBeNull();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(composeChartCanvases(canvas(10, 10), canvas(20, 5))).toBeNull();
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
    getContext.mockReturnValue(ctx as any);
    const out = composeChartCanvases(canvas(10, 10), canvas(20, 5))!;
    expect([out.width, out.height]).toEqual([20, 15]);
    expect(ctx.fillStyle).toBe('#ffffff');
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    document.documentElement.style.setProperty('--bg', '#000');
    composeChartCanvases(canvas(10, 10), canvas(20, 5));
    expect(ctx.fillStyle).toBe('#000');
    document.documentElement.style.removeProperty('--bg');
  });
});
