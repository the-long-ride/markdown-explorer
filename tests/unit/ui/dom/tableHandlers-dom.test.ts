import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWrappedColumnPercentages, registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';
import { syncStickyTableHeaders } from '../../../../ui/src/components/Content/contentUtils';

describe('dom/tableHandlers registerTableHandlers', () => {
  let win: any;

  beforeEach(() => {
    win = { UI: {}, Table: {} } as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('installs Table.sort', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.sort).toBe('function');
  });

  it('installs Table.applyAllFilters', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.applyAllFilters).toBe('function');
  });

  it('installs Table.filter', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.filter).toBe('function');
  });

  it('installs Table.showFilterMenu', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.showFilterMenu).toBe('function');
  });

  it('installs Table.showAlignMenu', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.showAlignMenu).toBe('function');
  });

  it('installs Table.setColumnAlignment', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.setColumnAlignment).toBe('function');
  });

  it('installs Table.toggleCollapse', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.toggleCollapse).toBe('function');
  });

  it('installs Table.toggleWrap', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.toggleWrap).toBe('function');
  });

  it('installs Table.updateCount', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.updateCount).toBe('function');
  });

  it('installs Table.detectChartable', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.detectChartable).toBe('function');
  });

  it('installs Table.switchView', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.switchView).toBe('function');
  });

  it('installs Table.renderChart', () => {
    registerTableHandlers(win);
    expect(typeof win.Table.renderChart).toBe('function');
  });

  it('installs UI.toggleCodeCollapse', () => {
    registerTableHandlers(win);
    expect(typeof win.UI.toggleCodeCollapse).toBe('function');
  });

  it('creates Table object if missing', () => {
    win = { UI: {} } as any;
    registerTableHandlers(win);
    expect(win.Table).toBeDefined();
    expect(typeof win.Table.sort).toBe('function');
  });

  describe('Table.initState', () => {
    it('creates default state for new table', () => {
      registerTableHandlers(win);
      const state = win.Table.initState('t1');
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

    it('returns existing state on second call', () => {
      registerTableHandlers(win);
      const first = win.Table.initState('t1');
      first.searchQuery = 'test';
      const second = win.Table.initState('t1');
      expect(second.searchQuery).toBe('test');
    });

    it('keeps separate states per table id', () => {
      registerTableHandlers(win);
      const s1 = win.Table.initState('t1');
      const s2 = win.Table.initState('t2');
      s1.expanded = true;
      expect(s2.expanded).toBe(false);
    });
  });

  describe('Table.toggleCollapse', () => {
    it('toggles expanded from false to true', () => {
      registerTableHandlers(win);
      const table = document.createElement('table');
      table.id = 't1';
      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      tbody.appendChild(tr);
      table.appendChild(tbody);
      document.body.appendChild(table);

      win.Table.toggleCollapse('t1');
      expect(win.Table.states['t1'].expanded).toBe(true);
    });

    it('toggles expanded from true to false', () => {
      registerTableHandlers(win);
      const table = document.createElement('table');
      table.id = 't1';
      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      tbody.appendChild(tr);
      table.appendChild(tbody);
      document.body.appendChild(table);

      win.Table.toggleCollapse('t1');
      win.Table.toggleCollapse('t1');
      expect(win.Table.states['t1'].expanded).toBe(false);
    });

    it('does nothing when table element is missing', () => {
      registerTableHandlers(win);
      expect(() => win.Table.toggleCollapse('nonexistent')).not.toThrow();
    });
  });

  describe('Table.toggleWrap', () => {
    it('adds is-wrapped class to wrapper element', () => {
      registerTableHandlers(win);
      const wrap = document.createElement('div');
      wrap.id = 't1-wrap';
      document.body.appendChild(wrap);

      win.Table.toggleWrap('t1');
      expect(wrap.classList.contains('is-wrapped')).toBe(true);
    });

    it('removes is-wrapped class on second toggle', () => {
      registerTableHandlers(win);
      const wrap = document.createElement('div');
      wrap.id = 't1-wrap';
      document.body.appendChild(wrap);

      win.Table.toggleWrap('t1');
      win.Table.toggleWrap('t1');
      expect(wrap.classList.contains('is-wrapped')).toBe(false);
    });

    it('updates wrap button state', () => {
      registerTableHandlers(win);
      const btn = document.createElement('button');
      btn.id = 't1-wrap-toggle';
      btn.innerHTML = '<span class="mdn-table-wrap-toggle__label">Wrap</span>';
      document.body.appendChild(btn);

      win.Table.toggleWrap('t1');
      expect(btn.classList.contains('is-active')).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    it('sizes wrapped columns from their average cell content length', () => {
      registerTableHandlers(win);
      document.body.innerHTML = `
        <div id="t1-wrap"></div>
        <table id="t1">
          <thead><tr><th class="mdn-th">Index</th><th class="mdn-th">Date</th><th class="mdn-th">Metric Value</th><th class="mdn-th">Event Signature</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>2024-01-01</td><td>6714.25</td><td>EVT-0C4F64D880D — nominal latency</td></tr>
            <tr><td>2</td><td>2024-01-02</td><td>5275.37</td><td>EVT-BB6C899604F5 — nominal jitter</td></tr>
          </tbody>
        </table>`;

      win.Table.toggleWrap('t1');

      const columns = document.querySelectorAll('#t1 colgroup[data-mdn-wrapped-columns] col');
      const widths = [...columns].map((column) => Number.parseFloat(column.style.getPropertyValue('--mdn-column-width')));
      expect(widths).toHaveLength(4);
      expect(widths[0]).toBeLessThan(widths[1]);
      expect(widths[2]).toBeLessThan(widths[1]);
      expect(widths[1]).toBeLessThan(widths[3]);
      expect(widths[0]).toBeLessThan(25);
    });

    it('reads header text from .mdn-th-text and gives hidden columns 0% width in wrapped mode', () => {
      registerTableHandlers(win);
      document.body.innerHTML = `
        <div id="t1-wrap"></div>
        <table id="t1">
          <thead>
            <tr>
              <th class="mdn-th"><div class="mdn-th-content"><span class="mdn-th-text">#</span><span class="mdn-th-actions"><span class="mdn-sort-icon">↕</span><span class="mdn-table-filter-btn">FilterIconText</span></span></div></th>
              <th class="mdn-th is-hidden-column"><div class="mdn-th-content"><span class="mdn-th-text">Hidden Long Column Header</span></div></th>
              <th class="mdn-th"><div class="mdn-th-content"><span class="mdn-th-text">Description</span></div></th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td class="is-hidden-column">Very long hidden cell content that should not steal width</td><td>Detailed workflow description for task execution</td></tr>
          </tbody>
        </table>`;

      const table = document.getElementById('t1') as HTMLTableElement;
      const percentages = getWrappedColumnPercentages(table);
      expect(percentages).toHaveLength(3);
      expect(percentages[1]).toBe(0);
      expect(percentages[0]).toBeLessThan(20);
      expect(percentages[0] + percentages[2]).toBeCloseTo(100, 3);
    });

    it('sets and updates --mdn-wrapped-table-min-width when wrapped and removes it when unwrapped', () => {
      registerTableHandlers(win);
      document.body.innerHTML = `
        <div id="t1-wrap"></div>
        <table id="t1">
          <thead><tr><th class="mdn-th">#</th><th class="mdn-th">Flag</th><th class="mdn-th">Task Description</th><th class="mdn-th">Expected Output</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Có</td><td>Implement wrapped table column sizing</td><td>Readable multi-column layout without single-letter vertical strips</td></tr>
          </tbody>
        </table>`;

      const table = document.getElementById('t1') as HTMLTableElement;
      win.Table.toggleWrap('t1');
      const initialMinWidth = Number.parseInt(table.style.getPropertyValue('--mdn-wrapped-table-min-width'), 10);
      expect(initialMinWidth).toBeGreaterThan(200);

      win.Table.setColumnVisibility('t1', 3, false);
      const reducedMinWidth = Number.parseInt(table.style.getPropertyValue('--mdn-wrapped-table-min-width'), 10);
      expect(reducedMinWidth).toBeLessThan(initialMinWidth);

      win.Table.toggleWrap('t1');
      expect(table.style.getPropertyValue('--mdn-wrapped-table-min-width')).toBe('');
      expect(document.querySelector('#t1 colgroup[data-mdn-wrapped-columns]')).not.toBeInTheDocument();
    });
  });

  describe('Table.updateCount', () => {
    it('updates count element with total rows', () => {
      registerTableHandlers(win);
      const table = document.createElement('table');
      table.id = 't1';
      const tbody = document.createElement('tbody');
      for (let i = 0; i < 5; i++) {
        tbody.appendChild(document.createElement('tr'));
      }
      table.appendChild(tbody);
      document.body.appendChild(table);

      const countEl = document.createElement('span');
      countEl.id = 't1-count';
      document.body.appendChild(countEl);

      win.Table.updateCount('t1');
      expect(countEl.textContent).toBe('5 rows');
    });

    it('excludes toggle row from count', () => {
      registerTableHandlers(win);
      const table = document.createElement('table');
      table.id = 't2';
      const tbody = document.createElement('tbody');
      tbody.appendChild(document.createElement('tr'));
      const toggleRow = document.createElement('tr');
      toggleRow.id = 't2-toggle-row';
      tbody.appendChild(toggleRow);
      table.appendChild(tbody);
      document.body.appendChild(table);

      const countEl = document.createElement('span');
      countEl.id = 't2-count';
      document.body.appendChild(countEl);

      win.Table.updateCount('t2');
      expect(countEl.textContent).toBe('1 rows');
    });

    it('does nothing when table element is missing', () => {
      registerTableHandlers(win);
      expect(() => win.Table.updateCount('missing')).not.toThrow();
    });
  });

  describe('UI.toggleCodeCollapse', () => {
    it('toggles collapsed from true to false', () => {
      registerTableHandlers(win);
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.collapsed = 'true';
      const btn = document.createElement('button');
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      win.UI.toggleCodeCollapse(btn);
      expect(wrap.dataset.collapsed).toBe('false');
      expect(btn.textContent).toBe('Show Less');
    });

    it('toggles collapsed from false to true', () => {
      registerTableHandlers(win);
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.collapsed = 'false';
      const btn = document.createElement('button');
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      win.UI.toggleCodeCollapse(btn);
      expect(wrap.dataset.collapsed).toBe('true');
      expect(btn.textContent).toBe('Show More');
    });

    it('does nothing when button is not inside codeblock', () => {
      registerTableHandlers(win);
      const btn = document.createElement('button');
      document.body.appendChild(btn);

      expect(() => win.UI.toggleCodeCollapse(btn)).not.toThrow();
      expect(btn.textContent).toBe('');
    });
  });

  describe('sticky table headers and Show Less toggle', () => {
    it('marks scroll container for JS sticky headers and positions thead flush with scroll container top', () => {
      document.body.innerHTML = `
        <div class="content__scroll" id="scroll">
          <div class="mdn-table-wrap" id="t1-wrap">
            <div class="mdn-table-scroll">
              <table class="mdn-table" id="t1">
                <thead><tr><th class="mdn-th">Index</th></tr></thead>
                <tbody><tr><td>1</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>`;
      const scroll = document.getElementById('scroll') as HTMLElement;
      const table = document.getElementById('t1') as HTMLTableElement;
      const thead = table.querySelector('thead') as HTMLElement;

      Object.defineProperty(scroll, 'clientTop', { value: 2, configurable: true });
      scroll.getBoundingClientRect = () => ({ top: 80, height: 400 } as DOMRect);
      thead.getBoundingClientRect = () => ({ top: 0, height: 32 } as DOMRect);

      let tableTop = -40;
      table.getBoundingClientRect = () => ({ top: tableTop, height: 300 } as DOMRect);

      syncStickyTableHeaders(scroll);
      expect(scroll.dataset.mdnJsStickyHeaders).toBe('true');
      expect(thead.style.transform).toBe('translateY(122px)');
      expect(thead.style.position).toBe('relative');
      expect(thead.style.zIndex).toBe('10');

      tableTop = -350;
      syncStickyTableHeaders(scroll);
      expect(thead.style.transform).toBe('translateY(268px)');

      tableTop = 100;
      syncStickyTableHeaders(scroll);
      expect(thead.style.transform).toBe('');
      expect(thead.style.position).toBe('');
      expect(thead.style.zIndex).toBe('');
    });

    it('toggles is-expanded on Show Less button and resyncs sticky headers when collapsing', () => {
      registerTableHandlers(win);
      const rows = Array.from({ length: 18 }, (_, i) => `<tr><td>${i + 1}</td></tr>`).join('');
      document.body.innerHTML = `
        <div class="content__scroll" id="scroll">
          <div class="mdn-table-wrap" id="t1-wrap">
            <div class="mdn-table-scroll">
              <table class="mdn-table" id="t1">
                <thead><tr><th class="mdn-th">Index</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <button class="mdn-table-toggle-btn" id="t1-toggle-btn">Show More</button>
          </div>
        </div>`;
      const scroll = document.getElementById('scroll') as HTMLElement;
      const table = document.getElementById('t1') as HTMLTableElement;
      const thead = table.querySelector('thead') as HTMLElement;
      const toggleBtn = document.getElementById('t1-toggle-btn') as HTMLButtonElement;
      const wrap = document.getElementById('t1-wrap') as HTMLElement;
      wrap.scrollIntoView = () => {};

      scroll.getBoundingClientRect = () => ({ top: 60, height: 400 } as DOMRect);
      thead.getBoundingClientRect = () => ({ top: 0, height: 30 } as DOMRect);
      table.getBoundingClientRect = () => ({ top: -100, height: 600 } as DOMRect);

      win.Table.toggleCollapse('t1');
      expect(toggleBtn.classList.contains('is-expanded')).toBe(true);
      expect(toggleBtn.textContent).toBe('Show Less');
      expect(scroll.dataset.mdnJsStickyHeaders).toBe('true');
      expect(thead.style.transform).toBe('translateY(160px)');

      table.getBoundingClientRect = () => ({ top: 80, height: 300 } as DOMRect);
      win.Table.toggleCollapse('t1');
      expect(toggleBtn.classList.contains('is-expanded')).toBe(false);
      expect(toggleBtn.textContent).toBe('Show More');
      expect(thead.style.transform).toBe('');
    });
  });
});
