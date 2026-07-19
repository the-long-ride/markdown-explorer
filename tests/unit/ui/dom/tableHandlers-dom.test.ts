import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

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

    it('removes calculated column widths when wrap mode is disabled', () => {
      registerTableHandlers(win);
      document.body.innerHTML = `
        <div id="t1-wrap"></div>
        <table id="t1"><thead><tr><th class="mdn-th">Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>`;

      win.Table.toggleWrap('t1');
      win.Table.toggleWrap('t1');

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
});
