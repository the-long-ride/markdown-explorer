import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTableChartHandlers } from '../../../../ui/src/dom/tableChartHandlers';

function setup(numeric = true) {
  document.body.innerHTML = `
    <div id="t-switcher"></div>
    <div id="t-scroll"></div><div id="t-chart-container"><canvas id="t-chart-canvas"></canvas></div>
    <button id="t-toggle-btn"></button><div id="t-toggle-row"></div>
    <table id="t"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>
      <tr><td>a</td><td>${numeric ? '1' : 'x'}</td></tr><tr><td>b</td><td>${numeric ? '2' : 'y'}</td></tr>
    </tbody></table>`;
  const states: Record<string, any> = {};
  const win: any = { Table: {
    initState: (id: string) => (states[id] ??= { hiddenColumnIdxs: [], scatterColIdxs: [], dataColIdxs: [], chartable: false, currentView: 'table' }),
    applyAllFilters: vi.fn(),
  } };
  const rows = (table: HTMLTableElement) => Array.from(table.tBodies[0].rows);
  const sync = vi.fn();
  registerTableChartHandlers(win, rows, rows, sync);
  return { win, states, sync };
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('table chart handlers views', () => {
  it('detects chartable tables and renders or clears the view switcher', () => {
    const plain = setup(false);
    plain.win.Table.detectChartable('missing');
    plain.win.Table.detectChartable('t');
    expect(plain.states.t.chartable).toBe(false);
    expect(document.getElementById('t-switcher')!.children.length).toBe(0);
    const { win, states } = setup();
    states.t = { hiddenColumnIdxs: [], scatterColIdxs: [], dataColIdxs: [], chartable: false, currentView: 'scatter' };
    win.Table.detectChartable('t');
    expect(states.t.chartable).toBe(true);
    expect(states.t.currentView).toBe('table');
    expect(document.getElementById('t-view-dropdown')).not.toBeNull();
  });

  it('refreshes availability by falling back to table or re-rendering the chart', () => {
    const { win, states } = setup();
    win.Table.detectChartable('t');
    win.Table.renderChart = vi.fn();
    states.t.currentView = 'scatter';
    win.Table.refreshChartAvailability('t');
    expect(states.t.currentView).toBe('table');
    states.t.currentView = 'bar';
    win.Table.refreshChartAvailability('t');
    expect(win.Table.renderChart).toHaveBeenCalledWith('t', 'bar');
  });

  it('switches views, lazily loading the chart library and reporting load failures', async () => {
    const { win, states, sync } = setup();
    win.Table.detectChartable('t');
    win.Table.switchView('missing', 'bar');
    win.Table.switchView('t', 'scatter');
    expect(states.t.currentView).toBe('table');
    win.Table.renderChart = vi.fn();
    win.Table.ensureChartLibrary = vi.fn(async () => undefined);
    win.Table.switchView('t', 'bar');
    expect(document.getElementById('t-chart-container')!.classList.contains('is-loading')).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(win.Table.renderChart).toHaveBeenCalledWith('t', 'bar');
    win.Table.ensureChartLibrary = vi.fn(async () => { throw new Error('offline'); });
    win.Table.switchView('t', 'line');
    await new Promise((r) => setTimeout(r, 0));
    expect(console.error).toHaveBeenCalled();
    win.Table.switchView('t', 'table');
    expect(win.Table.applyAllFilters).toHaveBeenCalledWith('t');
    expect(sync).toHaveBeenCalled();
    document.getElementById('t-view-dropdown')!.remove();
    ['t-scroll', 't-chart-container', 't-toggle-btn', 't-toggle-row'].forEach((id) => document.getElementById(id)!.remove());
    win.Chart = function Chart() {};
    win.Table.switchView('t', 'bar');
    win.Table.switchView('t', 'table');
  });

  it('opens and closes the view dropdown including outside clicks', () => {
    vi.useFakeTimers();
    const { win } = setup();
    win.Table.detectChartable('t');
    const ev = () => ({ stopPropagation: vi.fn() }) as any;
    win.Table.toggleViewDropdown('missing', ev());
    win.Table.closeViewDropdown('missing');
    const dropdown = document.getElementById('t-view-dropdown')!;
    win.Table.toggleViewDropdown('t', ev());
    expect(dropdown.classList.contains('is-open')).toBe(true);
    vi.runAllTimers();
    dropdown.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dropdown.classList.contains('is-open')).toBe(true);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dropdown.classList.contains('is-open')).toBe(false);
    win.Table.toggleViewDropdown('t', ev());
    win.Table.toggleViewDropdown('t', ev());
    expect(dropdown.classList.contains('is-open')).toBe(false);
    dropdown.querySelector('.mdn-table-view-menu')!.remove();
    win.Table.toggleViewDropdown('t', ev());
  });

  it('renders charts only when chartable, with a canvas, rows and Chart.js', () => {
    const { win, states } = setup();
    win.Table.renderChart('t', 'bar');
    win.Table.detectChartable('t');
    win.Table.bindChartCanvas = vi.fn();
    win.Table.renderChart('t', 'bar');
    const Chart = vi.fn(function Chart(this: any) { this.destroy = vi.fn(); });
    win.Chart = Chart;
    win.Table.renderChart('t', 'bar');
    expect(Chart).toHaveBeenCalled();
    expect(win.Table.bindChartCanvas).toHaveBeenCalledWith('t', 'bar');
    win.Table.renderChart('t', 'bar');
    expect(states.t.chartInstance).toBeTruthy();
    expect(win.Table.getChartColors(10)).toHaveLength(10);
    document.getElementById('t-chart-canvas')!.remove();
    win.Table.renderChart('t', 'bar');
  });
});
