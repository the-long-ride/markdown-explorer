import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachTableColumnResizers, clearTableLayoutStore, getStoredTableLayout, getTableKey, setStoredTableLayout } from '../../../../ui/src/dom/tableResizeStore';

afterEach(() => { clearTableLayoutStore(); document.body.innerHTML = ''; });

function mount(wrapClass = '') {
  document.body.innerHTML = `<div class="mdn-table-wrap ${wrapClass}"><table id="t1" class="mdn-table"><thead><tr>
    <th class="mdn-th"><span class="mdn-th-actions"><span role="button" id="act">a</span></span>A</th><th class="mdn-th">B</th></tr></thead>
    <tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>`;
  const table = document.getElementById('t1') as HTMLTableElement;
  attachTableColumnResizers(table);
  attachTableColumnResizers(table);
  return { table, resizer: table.querySelector('.mdn-table-col-resizer') as HTMLElement };
}

const pointer = (target: EventTarget, type: string, clientX: number) => target.dispatchEvent(new PointerEvent(type, { clientX, bubbles: true }));

describe('table column resizer clicks and keys', () => {
  it('drops the custom colgroup after a click without movement on unwrapped tables', () => {
    const { table, resizer } = mount();
    pointer(resizer, 'pointerdown', 50);
    pointer(window, 'pointermove', 50);
    pointer(window, 'pointerup', 50);
    expect(table.querySelector('colgroup')).toBeNull();
    expect(getStoredTableLayout(getTableKey(table))).toBeUndefined();
  });

  it('keeps the colgroup for wrapped tables and stores widths for an unmoved click with stored widths', () => {
    const { table, resizer } = mount('is-wrapped');
    pointer(resizer, 'pointerdown', 50);
    pointer(window, 'pointerup', 50);
    expect(getStoredTableLayout(getTableKey(table))).toBeUndefined();
    setStoredTableLayout(getTableKey(table), { columnWidths: [100, 100] });
    pointer(resizer, 'pointerdown', 50);
    pointer(window, 'pointerup', 50);
    expect(getStoredTableLayout(getTableKey(table))?.wrapped).toBe(true);
  });

  it('activates header action buttons with Enter and ignores other keys', () => {
    const { table, resizer } = mount('has-custom-column-widths');
    const click = vi.fn();
    document.getElementById('act')!.addEventListener('click', click);
    document.getElementById('act')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.getElementById('act')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    table.querySelector('th')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    const prevented = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    prevented.preventDefault();
    document.getElementById('act')!.dispatchEvent(prevented);
    expect(click).toHaveBeenCalledTimes(1);
    setStoredTableLayout(getTableKey(table), { columnWidths: [120, 90] });
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(getStoredTableLayout(getTableKey(table))?.columnWidths?.[1]).toBe(90);
  });
});
