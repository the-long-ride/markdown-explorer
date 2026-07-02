import { describe, it, expect, beforeEach } from 'vitest';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

describe('registerTableHandlers branch coverage', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {} };
    document.body.innerHTML = '';
  });

  it('detectChartable detects numeric columns', () => {
    document.body.innerHTML = `
      <table id="chart-test">
        <thead><tr><th>Name</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>A</td><td>10</td></tr>
          <tr><td>B</td><td>20</td></tr>
        </tbody>
      </table>
    `;
    registerTableHandlers(win);
    win.Table.detectChartable('chart-test');
    expect(win.Table.initState('chart-test').chartable).toBe(true);
    expect(win.Table.initState('chart-test').labelColIdx).toBe(0);
    expect(win.Table.initState('chart-test').dataColIdxs).toEqual([1]);
  });

  it('detectChartable with no numeric columns', () => {
    document.body.innerHTML = `
      <table id="no-chart">
        <thead><tr><th>A</th><th>B</th></tr></thead>
        <tbody>
          <tr><td>x</td><td>y</td></tr>
        </tbody>
      </table>
    `;
    registerTableHandlers(win);
    win.Table.detectChartable('no-chart');
    expect(win.Table.initState('no-chart').chartable).toBe(false);
  });

  it('detectChartable with numeric label column', () => {
    document.body.innerHTML = `
      <table id="chart-label">
        <thead><tr><th>Year</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>2020</td><td>100</td></tr>
          <tr><td>2021</td><td>200</td></tr>
        </tbody>
      </table>
    `;
    registerTableHandlers(win);
    win.Table.detectChartable('chart-label');
    expect(win.Table.initState('chart-label').chartable).toBe(true);
  });

  it('switchView to bar chart', () => {
    document.body.innerHTML = `
      <table id="switch-test"></table>
      <div id="switch-test-scroll"></div>
      <div id="switch-test-chart-container"></div>
      <button id="switch-test-toggle-btn"></button>
      <div id="switch-test-toggle-row"></div>
    `;
    registerTableHandlers(win);
    win.Table.initState('switch-test');
    win.Table.switchView('switch-test', 'bar');
    expect(win.Table.initState('switch-test').currentView).toBe('bar');
  });

  it('toggleViewDropdown with is-open', () => {
    document.body.innerHTML = `
      <div class="mdn-table-view-dropdown is-open" id="tv-test-view-dropdown">
        <button class="mdn-table-view-select" aria-expanded="true"></button>
        <div class="mdn-table-view-menu" hidden></div>
      </div>
    `;
    registerTableHandlers(win);
    const event = new Event('click');
    win.Table.toggleViewDropdown('tv-test', event);
    const dropdown = document.getElementById('tv-test-view-dropdown');
    expect(dropdown!.classList.contains('is-open')).toBe(false);
  });

  it('toggleViewDropdown without is-open', () => {
    document.body.innerHTML = `
      <div class="mdn-table-view-dropdown" id="tv-open-view-dropdown">
        <button class="mdn-table-view-select" aria-expanded="false"></button>
        <div class="mdn-table-view-menu" hidden></div>
      </div>
    `;
    registerTableHandlers(win);
    const event = new Event('click');
    win.Table.toggleViewDropdown('tv-open', event);
    const dropdown = document.getElementById('tv-open-view-dropdown');
    expect(dropdown!.classList.contains('is-open')).toBe(true);
  });

  it('showFilterMenu with unique values', () => {
    document.body.innerHTML = `
      <div id="filter-menu-test-view-dropdown"></div>
      <table id="filter-menu-test">
        <thead><tr><th class="mdn-th" data-col="0">Col</th></tr></thead>
        <tbody>
          <tr><td>apple</td></tr>
          <tr><td>banana</td></tr>
          <tr><td>apple</td></tr>
        </tbody>
      </table>
      <button id="filter-btn" class="mdn-table-filter-btn"></button>
    `;
    const button = document.getElementById('filter-btn') as HTMLElement;
    registerTableHandlers(win);
    win.Table.showFilterMenu('filter-menu-test', 0, button);
    const dropdown = document.querySelector('.mdn-filter-dropdown');
    expect(dropdown).toBeTruthy();
    expect(dropdown!.textContent).toContain('Filter Values');
    expect(dropdown!.textContent).toContain('apple');
    expect(dropdown!.textContent).toContain('banana');
  });

  it('showFilterMenu with no values', () => {
    document.body.innerHTML = `
      <div id="empty-filter-test-view-dropdown"></div>
      <table id="empty-filter-test">
        <thead><tr><th class="mdn-th" data-col="0">Col</th></tr></thead>
        <tbody></tbody>
      </table>
      <button id="empty-btn" class="mdn-table-filter-btn"></button>
    `;
    const button = document.getElementById('empty-btn') as HTMLElement;
    registerTableHandlers(win);
    win.Table.showFilterMenu('empty-filter-test', 0, button);
    const dropdown = document.querySelector('.mdn-filter-dropdown');
    expect(dropdown).toBeTruthy();
    expect(dropdown!.textContent).toContain('No values');
  });

  it('sort with missing table does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.sort('nonexistent', 0)).not.toThrow();
  });

  it('sort without tbody does nothing', () => {
    document.body.innerHTML = `<table id="no-tbody"></table>`;
    registerTableHandlers(win);
    expect(() => win.Table.sort('no-tbody', 0)).not.toThrow();
  });

  it('applyAllFilters with no table does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.applyAllFilters('nonexistent')).not.toThrow();
  });

  it('toggleCollapse with no table does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.toggleCollapse('nonexistent')).not.toThrow();
  });

  it('detectChartable with no table does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.detectChartable('nonexistent')).not.toThrow();
  });

  it('updateCount with no table does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.updateCount('nonexistent')).not.toThrow();
  });

  it('closeViewDropdown with no dropdown does nothing', () => {
    registerTableHandlers(win);
    expect(() => win.Table.closeViewDropdown('nonexistent')).not.toThrow();
  });

  it('toggleHtmlMode not wrapped', () => {
    document.body.innerHTML = `
      <div id="wrap-test" data-wrapped="false"></div>
      < Closure: Nothing else needed
    `;
    registerTableHandlers(win);
    win.Table.initState('wrap-test');
    win.Table.toggleWrap('wrap-test');
    expect(win.Table.initState('wrap-test').wrapped).toBe(true);
  });
});
