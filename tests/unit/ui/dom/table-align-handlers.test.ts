import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { renderInteractiveTable } from '../../../../ui/src/markdown/tableRenderer';
import {
  getColumnAlignment,
  inferTableColumnAlignmentFromDom,
  setColumnAlignment,
  showAlignMenu,
} from '../../../../ui/src/dom/tableAlignHandlers';
import { inferIntelligentColumnAlignment } from '../../../../ui/src/dom/intelligentTableAlign';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';
import { useAppStateEffects } from '../../../../ui/src/contexts/useAppStateEffects';

describe('Table Column Alignment Handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.tableAlign;
    document.documentElement.style.removeProperty('--mdn-table-default-align');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.tableAlign;
    document.documentElement.style.removeProperty('--mdn-table-default-align');
  });

  describe('renderInteractiveTable alignment buttons & attributes', () => {
    it('renders alignment button for every column header in rendered table', () => {
      const html = renderInteractiveTable({
        headers: ['Product', 'Price', 'Stock'],
        rows: [
          ['Apples', '$1.00', '50'],
          ['Bananas', '$0.50', '100'],
        ],
        align: ['left', 'right', 'center'],
      });

      expect(html).toContain('class="mdn-table-align-btn"');
      expect(html).toContain('data-col-align="left"');
      expect(html).toContain('data-col-align="right"');
      expect(html).toContain('data-col-align="center"');
      expect(html).toContain('style="text-align:right"');
      expect(html).toContain('style="text-align:center"');
    });

    it('renders alignment button even when no initial alignment is specified', () => {
      const html = renderInteractiveTable({
        headers: ['A', 'B'],
        rows: [['1', '2']],
      });

      const alignBtnMatches = html.match(/class="mdn-table-align-btn"/g);
      expect(alignBtnMatches?.length).toBe(2);
    });
  });

  describe('getColumnAlignment', () => {
    it('reads from data-col-align attribute first', () => {
      const th = document.createElement('th');
      th.setAttribute('data-col-align', 'right');
      th.style.textAlign = 'left';
      expect(getColumnAlignment(th)).toBe('right');
    });

    it('reads from style.textAlign if data-col-align is missing', () => {
      const th = document.createElement('th');
      th.style.textAlign = 'center';
      expect(getColumnAlignment(th)).toBe('center');
    });

    it('reads from document.documentElement.dataset.tableAlign if cell has no alignment', () => {
      document.documentElement.dataset.tableAlign = 'right';
      const th = document.createElement('th');
      expect(getColumnAlignment(th)).toBe('right');
    });

    it('defaults to "left" if no alignment is specified anywhere', () => {
      const th = document.createElement('th');
      expect(getColumnAlignment(th)).toBe('left');
    });
  });

  describe('setColumnAlignment', () => {
    it('updates header th and all body row cells at the column index', () => {
      document.body.innerHTML = `
        <table id="tbl-test">
          <thead>
            <tr>
              <th data-col="0"><span class="mdn-th-actions"><span class="mdn-table-align-btn"></span></span></th>
              <th data-col="1"><span class="mdn-th-actions"><span class="mdn-table-align-btn"></span></span></th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Cell 0-0</td><td>Cell 0-1</td></tr>
            <tr><td>Cell 1-0</td><td>Cell 1-1</td></tr>
          </tbody>
        </table>
      `;

      setColumnAlignment('tbl-test', 1, 'center');

      const th1 = document.querySelector<HTMLElement>('th[data-col="1"]')!;
      expect(th1.getAttribute('data-col-align')).toBe('center');
      expect(th1.style.textAlign).toBe('center');

      const btn1 = th1.querySelector<HTMLElement>('.mdn-table-align-btn')!;
      expect(btn1.classList.contains('is-active')).toBe(true);
      expect(btn1.getAttribute('data-current-align')).toBe('center');

      const rows = document.querySelectorAll<HTMLTableRowElement>('tbody tr');
      rows.forEach((row) => {
        const cell = row.children[1] as HTMLElement;
        expect(cell.getAttribute('data-col-align')).toBe('center');
        expect(cell.style.textAlign).toBe('center');
      });

      // Column 0 should remain untouched
      const th0 = document.querySelector<HTMLElement>('th[data-col="0"]')!;
      expect(th0.getAttribute('data-col-align')).toBeNull();
    });
  });

  describe('showAlignMenu interaction', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="mdn-table-wrap" id="tbl-demo-wrap">
          <table id="tbl-demo">
            <thead>
              <tr>
                <th data-col="0">
                  <div class="mdn-th-content">
                    <span class="mdn-th-text">Title</span>
                    <span class="mdn-th-actions">
                      <span class="mdn-table-align-btn" id="align-btn-0"></span>
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Item 1</td></tr>
              <tr><td>Item 2</td></tr>
            </tbody>
          </table>
        </div>
      `;
    });

    it('opens dropdown with 4 options: Left, Middle, Right, Intelligent', () => {
      const btn = document.getElementById('align-btn-0')!;
      showAlignMenu('tbl-demo', 0, btn);

      const dropdown = document.querySelector('.mdn-align-dropdown');
      expect(dropdown).not.toBeNull();

      const items = dropdown!.querySelectorAll<HTMLButtonElement>('.mdn-align-item');
      expect(items.length).toBe(4);

      expect(items[0].dataset.align).toBe('left');
      expect(items[0].textContent).toContain('Left');
      expect(items[0].classList.contains('is-active')).toBe(true);

      expect(items[1].dataset.align).toBe('center');
      expect(items[1].textContent).toContain('Middle');

      expect(items[2].dataset.align).toBe('right');
      expect(items[2].textContent).toContain('Right');

      expect(items[3].dataset.align).toBe('intelligent');
      expect(items[3].textContent).toContain('Intelligent');
    });

    it('clicking an option aligns the column and closes dropdown', () => {
      const btn = document.getElementById('align-btn-0')!;
      showAlignMenu('tbl-demo', 0, btn);

      const rightOption = document.querySelector<HTMLButtonElement>('.mdn-align-item[data-align="right"]')!;
      rightOption.click();

      expect(document.querySelector('.mdn-align-dropdown')).toBeNull();
      const th = document.querySelector<HTMLElement>('th[data-col="0"]')!;
      expect(th.getAttribute('data-col-align')).toBe('right');
      expect(th.style.textAlign).toBe('right');
      expect(btn.classList.contains('is-active')).toBe(true);
    });

    it('toggles dropdown closed when clicking the same trigger button again', () => {
      const btn = document.getElementById('align-btn-0')!;
      showAlignMenu('tbl-demo', 0, btn);
      expect(document.querySelector('.mdn-align-dropdown')).not.toBeNull();

      showAlignMenu('tbl-demo', 0, btn);
      expect(document.querySelector('.mdn-align-dropdown')).toBeNull();
    });

    it('closes dropdown on Escape key', async () => {
      const btn = document.getElementById('align-btn-0')!;
      showAlignMenu('tbl-demo', 0, btn);
      expect(document.querySelector('.mdn-align-dropdown')).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 10));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(document.querySelector('.mdn-align-dropdown')).toBeNull();
    });

    it('closes dropdown when clicking outside', async () => {
      const btn = document.getElementById('align-btn-0')!;
      showAlignMenu('tbl-demo', 0, btn);
      expect(document.querySelector('.mdn-align-dropdown')).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 10));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.querySelector('.mdn-align-dropdown')).toBeNull();
    });
  });

  describe('Integration with win.Table', () => {
    it('registerTableHandlers registers showAlignMenu and setColumnAlignment', () => {
      const win: any = { UI: {} };
      registerTableHandlers(win);
      expect(typeof win.Table.showAlignMenu).toBe('function');
      expect(typeof win.Table.setColumnAlignment).toBe('function');
    });
  });

  describe('useAppStateEffects root synchronization', () => {
    it('synchronizes tableColumnAlignment setting to documentElement dataset and CSS variable', () => {
      const bridge = {
        getState: vi.fn(() => ({})),
        setState: vi.fn(),
        onMessage: vi.fn(() => () => {}),
        postMessage: vi.fn(),
      };
      const dispatch = vi.fn();
      const state = {
        theme: 'light',
        themeStyle: 'default',
        appRuntime: 'desktop',
        settings: { tableColumnAlignment: 'center', keybindings: {} },
        contentTabs: [],
        desktopFonts: [],
      } as any;
      const ref = { current: null };

      renderHook(() =>
        useAppStateEffects({
          bridge,
          dispatch,
          state,
          isDesktop: true,
          shouldLogPerf: false,
          pendingHtmlPreviewNavigationRef: ref,
        }),
      );

      expect(document.documentElement.dataset.tableAlign).toBe('center');
      expect(document.documentElement.style.getPropertyValue('--mdn-table-default-align')).toBe('center');
    });

    it('synchronizes intelligent tableColumnAlignment to dataset while keeping CSS default align as left', () => {
      const bridge = {
        getState: vi.fn(() => ({})),
        setState: vi.fn(),
        onMessage: vi.fn(() => () => {}),
        postMessage: vi.fn(),
      };
      const dispatch = vi.fn();
      const state = {
        theme: 'light',
        themeStyle: 'default',
        appRuntime: 'desktop',
        settings: { tableColumnAlignment: 'intelligent', keybindings: {} },
        contentTabs: [],
        desktopFonts: [],
      } as any;
      const ref = { current: null };

      renderHook(() =>
        useAppStateEffects({
          bridge,
          dispatch,
          state,
          isDesktop: true,
          shouldLogPerf: false,
          pendingHtmlPreviewNavigationRef: ref,
        }),
      );

      expect(document.documentElement.dataset.tableAlign).toBe('intelligent');
      expect(document.documentElement.style.getPropertyValue('--mdn-table-default-align')).toBe('left');
    });
  });

  describe('Intelligent Table Alignment', () => {
    it('aligns sequential numeric index columns to center and general numbers to right', () => {
      expect(inferIntelligentColumnAlignment(['1', '2', '3', '4'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['10', '20', '30'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['$1,250.00', '$840.50', '$2,100.00'])).toBe('right');
      expect(inferIntelligentColumnAlignment(['85%', '92.5%', '78%'])).toBe('right');
      expect(inferIntelligentColumnAlignment(['100', '42', '305'])).toBe('right');
    });

    it('aligns date/time, checkbox, and boolean columns to center', () => {
      expect(inferIntelligentColumnAlignment(['January 1', 'Jan 2, 2026', '2024-01-05'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['01/05/2024', '31-12-2025', '14:30'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['[ ]', '[x]', '☐', '☑'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['<input type="checkbox">', '<input type="checkbox" checked>'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['true', 'FALSE', 'Yes', 'no'])).toBe('center');
    });

    it('aligns repeatable short category text to center and general text to left', () => {
      expect(inferIntelligentColumnAlignment(['Alpha', 'Beta', 'Alpha', 'Beta'])).toBe('center');
      expect(inferIntelligentColumnAlignment(['Quarterly review', 'Initial draft', 'Follow-up needed'])).toBe('left');
    });

    it('emits data-intelligent-align on unaligned columns in renderInteractiveTable and preserves explicit align', () => {
      const html = renderInteractiveTable({
        headers: ['Index', 'Amount', 'Notes'],
        rows: [
          ['1', '$10.00', 'First item'],
          ['2', '$25.50', 'Second item'],
        ],
        align: [null, null, 'right'],
      });

      expect(html).toContain('data-col="0" data-intelligent-align="center"');
      expect(html).toContain('data-col="1" data-intelligent-align="right"');
      expect(html).toContain('data-col-align="right" style="text-align:right"');
    });

    it('resolves intelligent alignment from DOM when setColumnAlignment is called with intelligent', () => {
      document.body.innerHTML = `
        <table id="tbl-intel">
          <thead>
            <tr>
              <th data-col="0"><span class="mdn-table-align-btn"></span></th>
              <th data-col="1"><span class="mdn-table-align-btn"></span></th>
            </tr>
          </thead>
          <tbody>
            <tr><td><input type="checkbox" checked /></td><td>$45.00</td></tr>
            <tr><td><input type="checkbox" /></td><td>$12.50</td></tr>
          </tbody>
        </table>
      `;
      const table = document.getElementById('tbl-intel') as HTMLTableElement;
      expect(inferTableColumnAlignmentFromDom(table, 0)).toBe('center');
      expect(inferTableColumnAlignmentFromDom(table, 1)).toBe('right');

      setColumnAlignment('tbl-intel', 1, 'intelligent');
      const th1 = table.querySelector<HTMLElement>('th[data-col="1"]')!;
      expect(th1.getAttribute('data-col-align')).toBe('intelligent');
      expect(th1.style.textAlign).toBe('right');
    });

    it('infers sequential Index column as center in 1000-row table with toggle row', () => {
      const rows = Array.from({ length: 25 }, (_, i) => [
        String(i + 1),
        `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        (1000 + i * 12.34).toFixed(2),
        `EVT-${i}`,
        i % 2 === 0 ? 'Alpha' : 'Beta',
      ]);

      const html = renderInteractiveTable({
        headers: ['Index', 'Date', 'Metric Value', 'Event Signature', 'Category'],
        rows,
        align: [null, null, 'right', null, null],
      });

      // Index column (col 0) should be intelligently inferred as center
      expect(html).toContain('data-col="0"');
      expect(html).toContain('data-intelligent-align="center"');

      // Date column (col 1) should be center
      expect(html).toContain('data-col="1"');
      // Metric Value (col 2) has explicit right alignment
      expect(html).toContain('data-col="2"');
      expect(html).toContain('data-col-align="right"');
      // Category (col 4) should be center
      expect(html).toContain('data-col="4"');

      // Also verify DOM inference ignores toggle row
      document.body.innerHTML = `
        <table id="tbl-telemetry">
          <thead>
            <tr><th data-col="0">Index</th><th data-col="1">Metric</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>100.5</td></tr>
            <tr><td>2</td><td>250.2</td></tr>
            <tr><td>3</td><td>80.9</td></tr>
            <tr id="tbl-telemetry-toggle-row" data-toggle="true"><td colspan="2"><button>Show More (985 rows)</button></td></tr>
          </tbody>
        </table>
      `;
      const table = document.getElementById('tbl-telemetry') as HTMLTableElement;
      expect(inferTableColumnAlignmentFromDom(table, 0)).toBe('center');
      expect(inferTableColumnAlignmentFromDom(table, 1)).toBe('right');
    });
  });
});
