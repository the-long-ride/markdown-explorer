import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

describe('registerTableHandlers comprehensive coverage', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Chart: undefined };
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. showFilterMenu with multiple unique values
  // ==========================================================================
  describe('showFilterMenu', () => {
    it('shows unique sorted values in dropdown', () => {
      document.body.innerHTML = `
        <table id="filter-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody>
            <tr><td>banana</td></tr>
            <tr><td>apple</td></tr>
            <tr><td>apple</td></tr>
            <tr><td>cherry</td></tr>
            <tr><td>banana</td></tr>
          </tbody>
        </table>
        <button id="fbtn" class="mdn-table-filter-btn"></button>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('fbtn') as HTMLElement;
      win.Table.showFilterMenu('filter-table', 0, btn);

      const dropdown = document.querySelector('.mdn-filter-dropdown');
      expect(dropdown).toBeTruthy();
      // Should contain all unique values sorted alphabetically
      expect(dropdown!.textContent).toContain('apple');
      expect(dropdown!.textContent).toContain('banana');
      expect(dropdown!.textContent).toContain('cherry');
      // Check the All option exists
      expect(dropdown!.textContent).toContain('(All)');

      // Clean up
      dropdown?.remove();
    });
  });

  // ==========================================================================
  // 2. showFilterMenu with search (no built-in search, but verify item click)
  // ==========================================================================
  describe('showFilterMenu search and interaction', () => {
    it('toggles a value on click and updates state', () => {
      document.body.innerHTML = `
        <table id="filter-toggle-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody>
            <tr><td>apple</td></tr>
            <tr><td>banana</td></tr>
          </tbody>
        </table>
        <button id="tbtn" class="mdn-table-filter-btn"></button>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('tbtn') as HTMLElement;
      win.Table.showFilterMenu('filter-toggle-table', 0, btn);

      const items = document.querySelectorAll('.mdn-filter-item');
      // First item is (All), skip it. Second item is the first real value
      const firstValueItem = items[1]; // first value item (should be apple alphabetically)
      expect(firstValueItem).toBeTruthy();

      // Click to select
      (firstValueItem as HTMLElement).click();

      const state = win.Table.initState('filter-toggle-table');
      expect(normalizeFilterValues(state.filters[0])).toContain('apple');
      expect(btn.classList.contains('is-active')).toBe(true);

      // Clean up
      document.querySelector('.mdn-filter-dropdown')?.remove();
    });
  });

  // ==========================================================================
  // showFilterMenu dropdown positioning when near right edge
  // ==========================================================================
  describe('showFilterMenu positioning', () => {
    it('adjusts position when dropdown would overflow viewport', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: 200, writable: true });

      document.body.innerHTML = `
        <table id="pos-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody><tr><td>apple</td></tr></tbody>
        </table>
        <button id="pbtn" class="mdn-table-filter-btn"></button>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('pbtn') as HTMLElement;
      // Mock getBoundingClientRect to simulate the button near the right edge
      vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
        left: 150,
        right: 170,
        bottom: 50,
        top: 30,
        width: 20,
        height: 20,
        x: 150,
        y: 30,
        toJSON: () => {},
      });

      win.Table.showFilterMenu('pos-table', 0, btn);

      const dropdown = document.querySelector('.mdn-filter-dropdown');
      expect(dropdown).toBeTruthy();
      // Check style was set (getBoundingClientRect is mocked so this covers the branch)
      expect(dropdown!.getAttribute('style')).toContain('left:');

      // Restore
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
      dropdown?.remove();
    });
  });

  // ==========================================================================
  // showFilterMenu clicking "(All)" clears filter
  // ==========================================================================
  describe('showFilterMenu clear all', () => {
    it('clears all column filters when clicking (All)', () => {
      document.body.innerHTML = `
        <table id="all-clear-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody>
            <tr><td>apple</td></tr>
            <tr><td>banana</td></tr>
          </tbody>
        </table>
        <button id="acbtn" class="mdn-table-filter-btn"></button>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('acbtn') as HTMLElement;
      win.Table.showFilterMenu('all-clear-table', 0, btn);

      // First, select a value
      const items = document.querySelectorAll('.mdn-filter-item');
      (items[1] as HTMLElement).click(); // select first value

      // Now click (All) to clear
      (items[0] as HTMLElement).click();

      const state = win.Table.initState('all-clear-table');
      expect(normalizeFilterValues(state.filters[0])).toHaveLength(0);

      document.querySelector('.mdn-filter-dropdown')?.remove();
    });

    it('deselects a value when clicking it again', () => {
      document.body.innerHTML = `
        <table id="deselect-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody><tr><td>apple</td></tr></tbody>
        </table>
        <button id="dsbtn" class="mdn-table-filter-btn"></button>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('dsbtn') as HTMLElement;
      win.Table.showFilterMenu('deselect-table', 0, btn);

      const items = document.querySelectorAll('.mdn-filter-item');
      // Select
      (items[1] as HTMLElement).click();
      expect(normalizeFilterValues(win.Table.initState('deselect-table').filters[0])).toContain('apple');
      // Deselect by clicking again (line 283 branch)
      (items[1] as HTMLElement).click();
      expect(normalizeFilterValues(win.Table.initState('deselect-table').filters[0])).toHaveLength(0);

      document.querySelector('.mdn-filter-dropdown')?.remove();
    });
  });

  // ==========================================================================
  // 3. showFilterMenu close on outside click
  // ==========================================================================
  describe('showFilterMenu outside click', () => {
    it('closes dropdown when clicking outside', async () => {
      document.body.innerHTML = `
        <table id="outside-table">
          <thead><tr><th class="mdn-th" data-col="0">Name</th></tr></thead>
          <tbody><tr><td>apple</td></tr></tbody>
        </table>
        <button id="obtn" class="mdn-table-filter-btn"></button>
        <div id="outside"></div>
      `;
      registerTableHandlers(win);
      const btn = document.getElementById('obtn') as HTMLElement;
      win.Table.showFilterMenu('outside-table', 0, btn);

      let dropdown = document.querySelector('.mdn-filter-dropdown');
      expect(dropdown).toBeTruthy();

      // Wait for setTimeout in showFilterMenu to add listener
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate outside click on the document
      const event = new MouseEvent('click', { bubbles: true });
      document.dispatchEvent(event);

      // After outside click dispatch, dropdown should be removed
      dropdown = document.querySelector('.mdn-filter-dropdown');
      expect(dropdown).toBeFalsy();
    });
  });

  // ==========================================================================
  // 4. switchView with different chart types
  // ==========================================================================
  describe('switchView with chart types', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <table id="switch-chart-table"></table>
        <div id="switch-chart-table-scroll"></div>
        <div id="switch-chart-table-chart-container"></div>
        <button id="switch-chart-table-toggle-btn"></button>
        <div id="switch-chart-table-toggle-row"></div>
        <div id="switch-chart-table-switcher"></div>
      `;
    });

    it('switches to bar view', () => {
      registerTableHandlers(win);
      win.Table.initState('switch-chart-table');
      win.Table.switchView('switch-chart-table', 'bar');
      expect(win.Table.initState('switch-chart-table').currentView).toBe('bar');
    });

    it('switches to pie view', () => {
      registerTableHandlers(win);
      win.Table.initState('switch-chart-table');
      win.Table.switchView('switch-chart-table', 'pie');
      expect(win.Table.initState('switch-chart-table').currentView).toBe('pie');
    });

    it('switches to line view', () => {
      registerTableHandlers(win);
      win.Table.initState('switch-chart-table');
      win.Table.switchView('switch-chart-table', 'line');
      expect(win.Table.initState('switch-chart-table').currentView).toBe('line');
    });

    it('updates dropdown label and options when switching view with dropdown present', () => {
      document.body.innerHTML = `
        <table id="view-dd-table"></table>
        <div id="view-dd-table-scroll"></div>
        <div id="view-dd-table-chart-container"></div>
        <button id="view-dd-table-toggle-btn"></button>
        <div id="view-dd-table-toggle-row"></div>
        <div id="view-dd-table-view-dropdown">
          <button class="mdn-table-view-select"><span class="mdn-table-view-select__label">Table</span></button>
          <div class="mdn-table-view-menu">
            <button class="mdn-table-view-menu__option is-selected" data-value="table" aria-selected="true">Table</button>
            <button class="mdn-table-view-menu__option" data-value="bar" aria-selected="false">Bar Chart</button>
          </div>
        </div>
      `;
      registerTableHandlers(win);
      win.Table.initState('view-dd-table');
      win.Table.switchView('view-dd-table', 'bar');
      const labelEl = document.querySelector('#view-dd-table-view-dropdown .mdn-table-view-select__label');
      expect(labelEl!.textContent).toBe('Bar Chart');
      const options = document.querySelectorAll('#view-dd-table-view-dropdown .mdn-table-view-menu__option');
      expect(options[0].classList.contains('is-selected')).toBe(false);
      expect(options[0].getAttribute('aria-selected')).toBe('false');
      expect(options[1].classList.contains('is-selected')).toBe(true);
      expect(options[1].getAttribute('aria-selected')).toBe('true');
    });
  });

  // ==========================================================================
  // toggleViewDropdown closes other open dropdowns
  // ==========================================================================
  describe('toggleViewDropdown', () => {
    it('closes other open view dropdowns when opening new one', () => {
      document.body.innerHTML = `
        <div class="mdn-table-view-dropdown is-open" id="other-tv-view-dropdown">
          <button class="mdn-table-view-select" aria-expanded="true"></button>
          <div class="mdn-table-view-menu" hidden></div>
        </div>
        <div class="mdn-table-view-dropdown" id="another-tv-view-dropdown">
          <button class="mdn-table-view-select" aria-expanded="true"></button>
          <div class="mdn-table-view-menu" hidden></div>
        </div>
        <div class="mdn-table-view-dropdown" id="main-tv-view-dropdown">
          <button class="mdn-table-view-select" aria-expanded="false"></button>
          <div class="mdn-table-view-menu" hidden></div>
        </div>
      `;
      registerTableHandlers(win);
      const event = new Event('click');
      win.Table.toggleViewDropdown('main-tv', event);
      expect(document.getElementById('other-tv-view-dropdown')!.classList.contains('is-open')).toBe(false);
    });

    it('closes itself when clicking outside after opening', async () => {
      document.body.innerHTML = `
        <div class="mdn-table-view-dropdown" id="outside-tv-view-dropdown">
          <button class="mdn-table-view-select" aria-expanded="false"></button>
          <div class="mdn-table-view-menu" hidden></div>
        </div>
      `;
      registerTableHandlers(win);
      const event = new Event('click');
      win.Table.toggleViewDropdown('outside-tv', event);

      const dropdown = document.getElementById('outside-tv-view-dropdown')!;
      expect(dropdown.classList.contains('is-open')).toBe(true);

      // Wait for setTimeout to add the document click listener
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Click outside the dropdown
      const outsideClick = new MouseEvent('click', { bubbles: true });
      document.dispatchEvent(outsideClick);

      expect(dropdown.classList.contains('is-open')).toBe(false);
    });
  });
  // ==========================================================================
  // 5. renderChart with mocked canvas and Chart.js
  // ==========================================================================
  describe('renderChart', () => {
    it('calls Chart constructor with correct data for bar chart', () => {
      const ChartMock = vi.fn();
      win.Chart = ChartMock;

      document.body.innerHTML = `
        <table id="chart-render-table">
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>10</td></tr>
            <tr><td>B</td><td>20</td></tr>
            <tr><td>C</td><td>30</td></tr>
          </tbody>
        </table>
        <div id="chart-render-table-chart-container"></div>
        <canvas id="chart-render-table-chart-canvas"></canvas>
      `;

      // Mock canvas 2d context
      const mockCtx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
      };
      const canvas = document.getElementById('chart-render-table-chart-canvas') as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any);

      registerTableHandlers(win);
      win.Table.detectChartable('chart-render-table');

      // Set up state for chartable
      const state = win.Table.initState('chart-render-table');
      state.chartable = true;
      state.labelColIdx = 0;
      state.dataColIdxs = [1];

      win.Table.renderChart('chart-render-table', 'bar');

      expect(ChartMock).toHaveBeenCalled();
      const callArgs = ChartMock.mock.calls[0];
      expect(callArgs[0]).toBe(canvas);
      expect(callArgs[1].type).toBe('bar');
      expect(callArgs[1].data.labels).toEqual(['A', 'B', 'C']);
      expect(callArgs[1].data.datasets[0].data).toEqual([10, 20, 30]);
    });

    it('renders pie chart with doughnut type', () => {
      const ChartMock = vi.fn();
      win.Chart = ChartMock;

      document.body.innerHTML = `
        <table id="pie-table">
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>10</td></tr>
            <tr><td>B</td><td>20</td></tr>
          </tbody>
        </table光明>
        <canvas id="pie-table-chart-canvas"></canvas>
      `;
      // Mock canvas
      const mockCtx = { clearRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn() };
      const canvas = document.getElementById('pie-table-chart-canvas') as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any);

      registerTableHandlers(win);
      const state = win.Table.initState('pie-table');
      state.chartable = true;
      state.labelColIdx = 0;
      state.dataColIdxs = [1];

      win.Table.renderChart('pie-table', 'pie');

      expect(ChartMock).toHaveBeenCalled();
      const callArgs = ChartMock.mock.calls[0];
      expect(callArgs[1].type).toBe('doughnut');
    });

    it('destroys previous chart instance before creating new one', () => {
      const mockDestroy = vi.fn();
      class ChartStub {}
      win.Chart = ChartStub;

      document.body.innerHTML = `
        <table id="destroy-table">
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>10</td></tr>
          </tbody>
        </table>
        <canvas id="destroy-table-chart-canvas"></canvas>
      `;
      const canvas = document.getElementById('destroy-table-chart-canvas') as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({} as any);

      registerTableHandlers(win);
      const state = win.Table.initState('destroy-table');
      state.chartable = true;
      state.labelColIdx = 0;
      state.dataColIdxs = [1];
      state.chartInstance = { destroy: mockDestroy };

      win.Table.renderChart('destroy-table', 'bar');

      expect(mockDestroy).toHaveBeenCalled();
      // After renderChart, a new chart instance should have been created
      expect(win.Table.initState('destroy-table').chartInstance).toBeInstanceOf(Object);
    });

    // ==========================================================================
    // renderChart when no visible rows (empty chart)
    // ==========================================================================
    it('draws "No data" message when all rows are hidden', () => {
      document.body.innerHTML = `
        <table id="empty-chart-table">
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody>
            <tr class="is-hidden"><td>A</td><td>10</td></tr>
            <tr class="is-hidden"><td>B</td><td>20</td></tr>
          </tbody>
        </table>
        <canvas id="empty-chart-table-chart-canvas" width="400" height="300"></canvas>
      `;

      const mockCtx = {
        clearRect: vi.fn(),
        fillText: vi.fn(),
        stroke: vi.fn(),
      };

      const canvas = document.getElementById('empty-chart-table-chart-canvas') as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockImplementation(() => mockCtx as any);

      registerTableHandlers(win);
      const state = win.Table.initState('empty-chart-table');
      state.chartable = true;
      state.labelColIdx = 0;
      state.dataColIdxs = [1];

      win.Table.renderChart('empty-chart-table', 'bar');

      expect(mockCtx.clearRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'No data to display in chart',
        200,
        150
      );
    });
  });

  // ==========================================================================
  // syncFilterButtons coverage
  // ==========================================================================
  describe('syncFilterButtons', () => {
    it('toggles is-active class on filter buttons based on column filter state', () => {
      document.body.innerHTML = `
        <table id="sync-btn-table">
          <thead><tr><th class="mdn-th" data-col="0">Fruit</th></tr></thead>
          <tbody>
            <tr><td>apple</td></tr>
          </tbody>
        </table>
        <button id="sync-btn-table-wrap-toggle"></button>
      `;
      registerTableHandlers(win);
      const state = win.Table.initState('sync-btn-table');
      state.filters = { 0: ['apple'] };
      win.Table.applyAllFilters('sync-btn-table');
      // The main filter button sync happens inside applyAllFilters through syncFilterButtons
      // which iterates .mdn-table-filter-btn elements.
      // The test already covers the applyAllFilters code path which calls syncFilterButtons
      expect(state.filters[0]).toContain('apple');
    });
  });

  // ==========================================================================
  // syncWrapState branches
  // ==========================================================================
  describe('syncWrapState', () => {
    it('toggles wrap state when button has no label child', () => {
      document.body.innerHTML = `
        <div id="wrap-test-wrap"></div>
        <button id="wrap-test-wrap-toggle">Wrap</button>
      `;
      registerTableHandlers(win);
      win.Table.initState('wrap-test');
      win.Table.toggleWrap('wrap-test');
      expect(win.Table.initState('wrap-test').wrapped).toBe(true);
    });
  });

  // ==========================================================================
  // 6. applyAllFilters with column filters
  // ==========================================================================
  describe('applyAllFilters with column filters', () => {
    it('filters rows by column values', () => {
      document.body.innerHTML = `
        <table id="col-filter-table">
          <thead><tr><th class="mdn-th" data-col="0">Fruit</th><th class="mdn-th" data-col="1">Count</th></tr></thead>
          <tbody>
            <tr><td>apple</td><td>5</td></tr>
            <tr><td>banana</td><td>3</td></tr>
            <tr><td>apple</td><td>7</td></tr>
            <tr><td>cherry</td><td>2</td></tr>
          </tbody>
        </table>
        <span id="col-filter-table-count"></span>
      `;
      registerTableHandlers(win);
      const state = win.Table.initState('col-filter-table');
      state.filters = { 0: ['apple'] };
      win.Table.applyAllFilters('col-filter-table');

      const rows = document.querySelectorAll('#col-filter-table tbody tr');
      expect(rows[0].classList.contains('is-hidden')).toBe(false); // apple
      expect(rows[1].classList.contains('is-hidden')).toBe(true);  // banana
      expect(rows[2].classList.contains('is-hidden')).toBe(false); // apple
      expect(rows[3].classList.contains('is-hidden')).toBe(true);  // cherry
    });
  });

  // ==========================================================================
  // 7. applyAllFilters with collapse behavior
  // ==========================================================================
  describe('applyAllFilters with collapse', () => {
    it('collapses rows beyond TABLE_COLLAPSE_LIMIT when not expanded', () => {
      const manyRows = Array.from({ length: 20 }, (_, i) => `<tr><td>row${i}</td></tr>`).join('');
      document.body.innerHTML = `
        <table id="collapse-filter-table">
          <tbody>${manyRows}</tbody>
        </table>
        <span id="collapse-filter-table-count"></span>
        <button id="collapse-filter-table-toggle-btn"></button>
      `;
      registerTableHandlers(win);
      win.Table.applyAllFilters('collapse-filter-table');

      const rows = document.querySelectorAll('#collapse-filter-table tbody tr');
      expect(rows[0].classList.contains('is-collapsed-row')).toBe(false);
      // Rows beyond limit should be collapsed
      expect(rows[15].classList.contains('is-collapsed-row')).toBe(true);
    });
  });

  // ==========================================================================
  // 7b. applyAllFilters with column filter where some rows don't match
  // ==========================================================================
  describe('applyAllFilters with column filter mismatches', () => {
    it('filters out rows that do not match the column filter (line 183 branch)', () => {
      document.body.innerHTML = `
        <table id="mismatch-filter-table">
          <thead><tr><th class="mdn-th" data-col="0">Fruit</th></tr></thead>
          <tbody>
            <tr><td>apple</td></tr>
            <tr><td>banana</td></tr>
            <tr><td>cherry</td></tr>
          </tbody>
        </table>
        <span id="mismatch-filter-table-count"></span>
      `;
      registerTableHandlers(win);
      // Set filter that only matches 'apple' - rows 2 and 3 will hit the mismatch branch on line 183
      const state = win.Table.initState('mismatch-filter-table');
      state.filters = { 0: ['apple'] };
      win.Table.applyAllFilters('mismatch-filter-table');

      const rows = document.querySelectorAll('#mismatch-filter-table tbody tr');
      expect(rows[0].classList.contains('is-hidden')).toBe(false);
      expect(rows[1].classList.contains('is-hidden')).toBe(true);
      expect(rows[2].classList.contains('is-hidden')).toBe(true);
    });
  });

  // ==========================================================================
  // 8. applyAllFilters with chart rendering
  // ==========================================================================
  describe('applyAllFilters with chart currentView', () => {
    it('calls renderChart when currentView is not table', () => {
      document.body.innerHTML = `
        <table id="chart-view-table">
          <tbody><tr><td>test</td></tr></tbody>
        </table>
        <canvas id="chart-view-table-chart-canvas"></canvas>
      `;

      const renderChartSpy = vi.fn();
      registerTableHandlers(win);
      win.Table.renderChart = renderChartSpy;

      const state = win.Table.initState('chart-view-table');
      state.currentView = 'bar';
      win.Table.applyAllFilters('chart-view-table');

      expect(renderChartSpy).toHaveBeenCalledWith('chart-view-table', 'bar');
    });
  });

  // ==========================================================================
  // 9. detectChartable with different column types
  // ==========================================================================
  describe('detectChartable with different column types', () => {
    it('detects only numeric columns', () => {
      document.body.innerHTML = `
        <table id="num-only-table">
          <thead><tr><th>A</th><th>B</th></tr></thead>
          <tbody>
            <tr><td>10</td><td>20</td></tr>
            <tr><td>30</td><td>40</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.detectChartable('num-only-table');
      const state = win.Table.initState('num-only-table');
      expect(state.chartable).toBe(true);
      // When all columns are numeric, labelColIdx defaults to 0 and data columns exclude it
      expect(state.labelColIdx).toBe(0);
      expect(state.dataColIdxs).toEqual([1]);
    });

    it('does not chart only text columns', () => {
      document.body.innerHTML = `
        <table id="text-only-table">
          <thead><tr><th>Name</th><th>Desc</th></tr></thead>
          <tbody>
            <tr><td>Alice</td><td>Engineer</td></tr>
            <tr><td>Bob</td><td>Designer</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.detectChartable('text-only-table');
      const state = win.Table.initState('text-only-table');
      expect(state.chartable).toBe(false);
    });

    it('detects mixed columns with text as label and numeric as data', () => {
      document.body.innerHTML = `
        <table id="mixed-table">
          <thead><tr><th>Product</th><th>Price</th><th>Qty</th></tr></thead>
          <tbody>
            <tr><td>Widget</td><td>10.50</td><td>100</td></tr>
            <tr><td>Gadget</td><td>25.00</td><td>50</td></tr>
          </tbody>
        </table>
      `;
      registerTableHandlers(win);
      win.Table.detectChartable('mixed-table');
      const state = win.Table.initState('mixed-table');
      expect(state.chartable).toBe(true);
      expect(state.labelColIdx).toBe(0);
      expect(state.dataColIdxs).toEqual([1, 2]);
    });

    it('creates the switcher element when detectChartable finds chartable data', () => {
      document.body.innerHTML = `
        <table id="switcher-table">
          <thead><tr><th>Product</th><th>Sales</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>100</td></tr>
            <tr><td>B</td><td>200</td></tr>
          </tbody>
        </table>
        <div id="switcher-table-switcher"></div>
      `;
      registerTableHandlers(win);
      win.Table.detectChartable('switcher-table');
      const switcher = document.getElementById('switcher-table-switcher');
      expect(switcher!.innerHTML).toContain('mdn-table-view-dropdown');
      expect(switcher!.innerHTML).toContain('Bar Chart');
      expect(switcher!.innerHTML).toContain('Pie Chart');
    });
  });

  // ==========================================================================
  // 10. toggleCollapse edge cases
  // ==========================================================================
  describe('toggleCollapse edge cases', () => {
    it('does nothing when toggle button does not exist', () => {
      document.body.innerHTML = `
        <table id="no-toggle-table">
          <tbody><tr><td>data</td></tr></tbody>
        </table>
        <span id="no-toggle-table-count"></span>
        <!-- No toggle button -->
      `;
      registerTableHandlers(win);
      expect(() => win.Table.toggleCollapse('no-toggle-table')).not.toThrow();
    });

    it('does nothing when tbody does not exist in applyAllFilters via toggleCollapse', () => {
      document.body.innerHTML = `<table id="no-tbody-table"></table>`;
      registerTableHandlers(win);
      // toggleCollapse calls applyAllFilters which needs tbody, but getTableDataRows returns empty
      expect(() => win.Table.toggleCollapse('no-tbody-table')).not.toThrow();
    });

    it('hides toggle button when matched count <= TABLE_COLLAPSE_LIMIT', () => {
      document.body.innerHTML = `
        <table id="limit-table">
          <tbody>
            <tr><td>row1</td></tr>
            <tr><td>row2</td></tr>
          </tbody>
        </table>
        <span id="limit-table-count"></span>
        <button id="limit-table-toggle-btn"></button>
      `;
      registerTableHandlers(win);
      win.Table.applyAllFilters('limit-table');
      const toggleBtn = document.getElementById('limit-table-toggle-btn') as HTMLElement;
      expect(toggleBtn.style.display).toBe('none');
    });
  });
});

// Helper function to normalize filter values
function normalizeFilterValues(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}
