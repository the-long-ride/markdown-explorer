import { describe, it, expect, beforeEach } from 'vitest';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

describe('registerTableHandlers', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {} };
    document.body.innerHTML = '';
  });

  it('registers UI.toggleCodeCollapse', () => {
    registerTableHandlers(win);
    expect(typeof win.UI.toggleCodeCollapse).toBe('function');
  });

  it('initializes win.Table', () => {
    registerTableHandlers(win);
    expect(win.Table).toBeDefined();
    expect(win.Table.states).toBeDefined();
  });

  describe('win.Table.initState', () => {
    it('creates default state for a new table', () => {
      registerTableHandlers(win);
      const state = win.Table.initState('test-table');
      expect(state).toEqual({
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
        hiddenColumnIdxs: [],
      });
    });

    it('returns existing state for repeated calls', () => {
      registerTableHandlers(win);
      const state1 = win.Table.initState('test-table');
      state1.searchQuery = 'test';
      const state2 = win.Table.initState('test-table');
      expect(state2.searchQuery).toBe('test');
    });
  });

  describe('win.Table.sort', () => {
    it('sorts table rows', () => {
      document.body.innerHTML = `
        <table id="sort-table">
          <thead><tr><th class="mdn-th">Col</th></tr></thead>
          <tbody>
            <tr><td>3</td></tr>
            <tr><td>1</td></tr>
            <tr><td>2</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.sort('sort-table', 0);
      const cells = document.querySelectorAll('#sort-table tbody td');
      // Without sort-asc class, first sort is ascending
      expect(cells[0].textContent).toBe('1');
      expect(cells[1].textContent).toBe('2');
      expect(cells[2].textContent).toBe('3');
    });
  });

  describe('win.Table.applyAllFilters', () => {
    it('filters rows by search query', () => {
      document.body.innerHTML = `
        <table id="filter-test">
          <tbody>
            <tr><td>apple pie</td></tr>
            <tr><td>banana bread</td></tr>
            <tr><td>apple tart</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.filter('filter-test', 'app');
      const rows = document.querySelectorAll('#filter-test tbody tr');
      expect(rows[0].classList.contains('is-hidden')).toBe(false);
      expect(rows[1].classList.contains('is-hidden')).toBe(true);
      expect(rows[2].classList.contains('is-hidden')).toBe(false);
    });

    it('shows all rows when search is empty', () => {
      document.body.innerHTML = `
        <table id="filter-empty">
          <tbody>
            <tr><td>apple</td></tr>
            <tr><td>banana</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.filter('filter-empty', '');
      const rows = document.querySelectorAll('#filter-empty tbody tr');
      expect(rows[0].classList.contains('is-hidden')).toBe(false);
      expect(rows[1].classList.contains('is-hidden')).toBe(false);
    });

    it('updates count element and toggle buttons', () => {
      document.body.innerHTML = `
        <table id="count-test">
          <tbody>
            <tr><td>apple</td></tr>
            <tr><td>banana</td></tr>
          </tbody>
        </table>
        <span id="count-test-count">0 rows</span>
        <button id="count-test-toggle-btn"></button>
      `;
      registerTableHandlers(win);
      win.Table.applyAllFilters('count-test');
      expect(document.getElementById('count-test-count')?.textContent).toBe('2 rows');
      expect((document.getElementById('count-test-toggle-btn') as HTMLElement).style.display).toBe('none');
    });

    it('handles collapsed rows when over TABLE_COLLAPSE_LIMIT', () => {
      const rowsHtml = Array.from({ length: 18 }, (_, i) => `<tr><td>row${i}</td></tr>`).join('');
      document.body.innerHTML = `
        <table id="collapse-test">
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.applyAllFilters('collapse-test');
      const rows = document.querySelectorAll('#collapse-test tbody tr');
      expect(rows[0].classList.contains('is-collapsed-row')).toBe(false);
      expect(rows[16].classList.contains('is-collapsed-row')).toBe(true);
    });
  });

  describe('win.Table.toggleCollapse', () => {
    it('toggles expanded state', () => {
      document.body.innerHTML = `<table id="collapse-table"></table>`;
      registerTableHandlers(win);
      win.Table.initState('collapse-table');
      expect(win.Table.initState('collapse-table').expanded).toBe(false);
      win.Table.toggleCollapse('collapse-table');
      expect(win.Table.initState('collapse-table').expanded).toBe(true);
      win.Table.toggleCollapse('collapse-table');
      expect(win.Table.initState('collapse-table').expanded).toBe(false);
    });
  });

  describe('win.Table.toggleWrap', () => {
    it('toggles wrapped state', () => {
      document.body.innerHTML = `
        <div id="wrap-table-wrap"></div>
      `;
      registerTableHandlers(win);
      win.Table.initState('wrap-table');
      expect(win.Table.initState('wrap-table').wrapped).toBe(false);
      win.Table.toggleWrap('wrap-table');
      expect(win.Table.initState('wrap-table').wrapped).toBe(true);
    });
  });

  describe('win.Table.updateCount', () => {
    it('updates row count', () => {
      document.body.innerHTML = `
        <table id="count-table">
          <tbody>
            <tr><td>a</td></tr>
            <tr><td>b</td></tr>
          </tbody>
        </table>
        <span id="count-table-count"></span>
      `;
      registerTableHandlers(win);
      win.Table.updateCount('count-table');
      expect(document.getElementById('count-table-count')?.textContent).toBe('2 rows');
    });
  });

  describe('win.Table.switchView', () => {
    it('switches to table view', () => {
      document.body.innerHTML = `
        <table id="view-table"></table>
        <div id="view-table-scroll"></div>
        <div id="view-table-chart-container"></div>
        <div id="view-table-toggle-btn"></div>
      `;
      registerTableHandlers(win);
      win.Table.initState('view-table');
      win.Table.switchView('view-table', 'table');
      expect(win.Table.initState('view-table').currentView).toBe('table');
    });
  });

  describe('win.Table.closeViewDropdown', () => {
    it('closes view dropdown', () => {
      document.body.innerHTML = `
        <div id="test-view-dropdown">
          <button class="mdn-table-view-select" aria-expanded="true"></button>
          <div class="mdn-table-view-menu" hidden></div>
        </div>
      `;
      registerTableHandlers(win);
      const dropdown = document.getElementById('test-view-dropdown') as HTMLElement;
      dropdown.classList.add('is-open');
      win.Table.closeViewDropdown('test');
      expect(dropdown.classList.contains('is-open')).toBe(false);
    });
  });

  describe('win.Table.getChartColors', () => {
    it('returns colors array', () => {
      registerTableHandlers(win);
      const colors = win.Table.getChartColors(3);
      expect(colors).toHaveLength(3);
      expect(typeof colors[0]).toBe('string');
    });
  });
});
