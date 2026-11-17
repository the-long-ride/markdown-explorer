import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachTableColumnResizers,
  clearTableLayoutStore,
  getStoredTableLayout,
  getTableKey,
  setStoredTableLayout,
  syncWrappedTableColumns,
} from '../../../../ui/src/dom/tableResizeStore';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';

describe('tableResizeStore & column resizing', () => {
  beforeEach(() => {
    clearTableLayoutStore();
    document.body.className = '';
  });

  it('computes stable table keys based on file path, table index, and header signature', () => {
    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/guide.md">
        <table id="tbl-1" class="mdn-table">
          <thead>
            <tr>
              <th class="mdn-th"><span class="mdn-th-text">Col A</span></th>
              <th class="mdn-th"><span class="mdn-th-text">Col B</span></th>
            </tr>
          </thead>
        </table>
      </div>
    `;
    const table = document.getElementById('tbl-1') as HTMLTableElement;
    const key = getTableKey(table);
    expect(key).toBe('/workspace/docs/guide.md::table-0::Col A|Col B');
  });

  it('persists column layout in memory across simulated tab close and file switch', () => {
    const key = '/workspace/docs/guide.md::table-0::Col A|Col B';
    setStoredTableLayout(key, { wrapped: true, columnWidths: [180, 240] });

    // Simulate switching to other file
    const otherKey = '/workspace/docs/other.md::table-0::Col X';
    expect(getStoredTableLayout(otherKey)).toBeUndefined();

    // Switch back to original file
    const stored = getStoredTableLayout(key);
    expect(stored).toEqual({ wrapped: true, columnWidths: [180, 240] });
  });

  it('applies custom column widths when table is wrapped and stored layout exists', () => {
    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/file.md">
        <div id="tbl-1-wrap" class="mdn-table-wrap is-wrapped">
          <table id="tbl-1" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th"><span class="mdn-th-text">A</span></th>
                <th class="mdn-th"><span class="mdn-th-text">B</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>2</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    const table = document.getElementById('tbl-1') as HTMLTableElement;
    const key = getTableKey(table);
    setStoredTableLayout(key, { wrapped: true, columnWidths: [150, 300] });

    syncWrappedTableColumns('tbl-1', true, () => [10, 20]);

    const colgroup = table.querySelector('colgroup[data-mdn-wrapped-columns]');
    expect(colgroup).not.toBeNull();
    const cols = Array.from(colgroup!.querySelectorAll('col'));
    expect(cols).toHaveLength(2);
    expect(cols[0].style.getPropertyValue('--mdn-column-width')).toBe('150px');
    expect(cols[1].style.getPropertyValue('--mdn-column-width')).toBe('300px');
    expect(table.style.getPropertyValue('--mdn-wrapped-table-min-width')).toBe('450px');
  });

  it('allows user to drag resizer handle and updates stored widths', () => {
    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/file.md">
        <div id="tbl-1-wrap" class="mdn-table-wrap is-wrapped">
          <table id="tbl-1" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th" style="width: 100px;"><span class="mdn-th-text">Col 1</span></th>
                <th class="mdn-th" style="width: 100px;"><span class="mdn-th-text">Col 2</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td>A</td><td>B</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    const table = document.getElementById('tbl-1') as HTMLTableElement;
    const ths = Array.from(table.querySelectorAll<HTMLElement>('thead th.mdn-th'));
    vi.spyOn(ths[0], 'getBoundingClientRect').mockReturnValue({ width: 100 } as any);
    vi.spyOn(ths[1], 'getBoundingClientRect').mockReturnValue({ width: 100 } as any);

    attachTableColumnResizers(table);

    const resizers = table.querySelectorAll('.mdn-table-col-resizer');
    expect(resizers).toHaveLength(2);

    const firstResizer = resizers[0] as HTMLElement;

    // Pointer down at x=100
    firstResizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(true);

    // Pointer move to x=150 (expanded by 50px)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }));

    // Pointer up at x=150
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 150 }));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(false);

    const key = getTableKey(table);
    const stored = getStoredTableLayout(key);
    expect(stored?.columnWidths).toBeDefined();
    expect(stored!.columnWidths![0]).toBe(150);
  });

  it('restores wrapped state via win.Table.restoreTableLayout', () => {
    const mockWin: any = { UI: {} };
    registerTableHandlers(mockWin);

    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/file.md">
        <div id="tbl-restore-wrap" class="mdn-table-wrap">
          <button id="tbl-restore-wrap-toggle" class="mdn-table-wrap-toggle"><span class="mdn-table-wrap-toggle__label">Wrap</span></button>
          <table id="tbl-restore" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th"><span class="mdn-th-text">Header</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Content</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const table = document.getElementById('tbl-restore') as HTMLTableElement;
    const key = getTableKey(table);
    setStoredTableLayout(key, { wrapped: true, columnWidths: [200] });

    mockWin.Table.restoreTableLayout('tbl-restore');

    const state = mockWin.Table.initState('tbl-restore');
    expect(state.wrapped).toBe(true);
    const wrap = document.getElementById('tbl-restore-wrap');
    expect(wrap?.classList.contains('is-wrapped')).toBe(true);
  });

  it('allows resizing columns in unwrap mode and reveals + executes reset column widths', () => {
    const mockWin: any = { UI: {} };
    registerTableHandlers(mockWin);

    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/unwrap.md">
        <div id="tbl-u-wrap" class="mdn-table-wrap">
          <button id="tbl-u-reset-widths" class="mdn-table-reset-widths" hidden>Reset</button>
          <button id="tbl-u-wrap-toggle" class="mdn-table-wrap-toggle"><span class="mdn-table-wrap-toggle__label">Wrap</span></button>
          <table id="tbl-u" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th"><span class="mdn-th-text">Col 1</span></th>
                <th class="mdn-th"><span class="mdn-th-text">Col 2</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Alpha</td><td>Beta</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const wrap = document.getElementById('tbl-u-wrap') as HTMLElement;
    const resetBtn = document.getElementById('tbl-u-reset-widths') as HTMLButtonElement;
    const table = document.getElementById('tbl-u') as HTMLTableElement;
    const ths = Array.from(table.querySelectorAll<HTMLElement>('thead th.mdn-th'));
    vi.spyOn(ths[0], 'getBoundingClientRect').mockReturnValue({ width: 120 } as any);
    vi.spyOn(ths[1], 'getBoundingClientRect').mockReturnValue({ width: 140 } as any);

    mockWin.Table.restoreTableLayout('tbl-u');
    expect(resetBtn.hidden).toBe(true);
    const resizers = table.querySelectorAll('.mdn-table-col-resizer');
    expect(resizers).toHaveLength(2);

    (resizers[0] as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { clientX: 120, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 180 }));
    expect(wrap.classList.contains('has-custom-column-widths')).toBe(true);
    expect(resetBtn.hidden).toBe(false);

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 180 }));
    const key = getTableKey(table);
    expect(getStoredTableLayout(key)).toEqual({ columnWidths: [180, 140], wrapped: false });
    expect(wrap.classList.contains('is-wrapped')).toBe(false);

    mockWin.Table.resetColumnWidths('tbl-u');
    expect(resetBtn.hidden).toBe(true);
    expect(wrap.classList.contains('has-custom-column-widths')).toBe(false);
    expect(table.querySelector('colgroup[data-mdn-wrapped-columns]')).toBeNull();
    expect(getStoredTableLayout(key)?.columnWidths).toBeUndefined();
  });

  it('cleans up resizing state on pointercancel and window blur without saving cancelled drags', () => {
    const mockWin: any = { UI: {} };
    registerTableHandlers(mockWin);

    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/cancel.md">
        <div id="tbl-c-wrap" class="mdn-table-wrap">
          <button id="tbl-c-reset-widths" class="mdn-table-reset-widths" hidden>Reset</button>
          <table id="tbl-c" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th"><span class="mdn-th-text">Col 1</span></th>
                <th class="mdn-th"><span class="mdn-th-text">Col 2</span></th>
              </tr>
            </thead>
            <tbody><tr><td>A</td><td>B</td></tr></tbody>
          </table>
        </div>
      </div>
    `;

    const table = document.getElementById('tbl-c') as HTMLTableElement;
    const ths = Array.from(table.querySelectorAll<HTMLElement>('thead th.mdn-th'));
    vi.spyOn(ths[0], 'getBoundingClientRect').mockReturnValue({ width: 120 } as any);
    vi.spyOn(ths[1], 'getBoundingClientRect').mockReturnValue({ width: 140 } as any);

    mockWin.Table.restoreTableLayout('tbl-c');
    const resizer = table.querySelector('.mdn-table-col-resizer') as HTMLElement;
    const key = getTableKey(table);

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 120, bubbles: true }));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(true);
    expect(resizer.classList.contains('is-resizing')).toBe(true);

    window.dispatchEvent(new PointerEvent('pointercancel'));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(false);
    expect(resizer.classList.contains('is-resizing')).toBe(false);
    expect(getStoredTableLayout(key)?.columnWidths).toBeUndefined();

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 120, bubbles: true }));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(true);
    expect(resizer.classList.contains('is-resizing')).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(document.body.classList.contains('is-table-col-resizing')).toBe(false);
    expect(resizer.classList.contains('is-resizing')).toBe(false);
    expect(getStoredTableLayout(key)?.columnWidths).toBeUndefined();
  });

  it('supports keyboard ArrowLeft/ArrowRight column resizing and Enter/Space header actions', () => {
    const mockWin: any = { UI: {} };
    registerTableHandlers(mockWin);

    document.body.innerHTML = `
      <div data-file-path="/workspace/docs/kbd.md">
        <div id="tbl-k-wrap" class="mdn-table-wrap">
          <button id="tbl-k-reset-widths" class="mdn-table-reset-widths" hidden>Reset</button>
          <table id="tbl-k" class="mdn-table">
            <thead>
              <tr>
                <th class="mdn-th">
                  <div class="mdn-th-content">
                    <span class="mdn-th-text">Col 1</span>
                    <span class="mdn-th-actions">
                      <span class="mdn-sort-icon" role="button" tabindex="0"></span>
                    </span>
                  </div>
                </th>
                <th class="mdn-th"><span class="mdn-th-text">Col 2</span></th>
              </tr>
            </thead>
            <tbody><tr><td>A</td><td>B</td></tr></tbody>
          </table>
        </div>
      </div>
    `;

    const resetBtn = document.getElementById('tbl-k-reset-widths') as HTMLButtonElement;
    const table = document.getElementById('tbl-k') as HTMLTableElement;
    const ths = Array.from(table.querySelectorAll<HTMLElement>('thead th.mdn-th'));
    vi.spyOn(ths[0], 'getBoundingClientRect').mockReturnValue({ width: 120 } as any);
    vi.spyOn(ths[1], 'getBoundingClientRect').mockReturnValue({ width: 140 } as any);

    mockWin.Table.restoreTableLayout('tbl-k');
    const resizer = table.querySelector('.mdn-table-col-resizer') as HTMLElement;
    const key = getTableKey(table);

    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(resetBtn.hidden).toBe(false);
    expect(getStoredTableLayout(key)?.columnWidths).toEqual([136, 140]);

    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    expect(getStoredTableLayout(key)?.columnWidths).toEqual([176, 140]);

    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(getStoredTableLayout(key)?.columnWidths).toEqual([160, 140]);

    const sortBtn = table.querySelector('.mdn-sort-icon') as HTMLElement;
    const clickSpy = vi.fn();
    sortBtn.addEventListener('click', clickSpy);

    sortBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    sortBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});
