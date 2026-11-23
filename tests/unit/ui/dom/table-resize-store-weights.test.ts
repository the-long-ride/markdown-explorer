import { afterEach, describe, expect, it } from 'vitest';
import {
  clearStoredColumnWidths, clearTableLayoutStore, getStoredTableLayout, getTableKey, getWrappedColumnPercentages,
  getWrappedColumnWeights, setStoredTableLayout,
} from '../../../../ui/src/dom/tableResizeStore';

afterEach(() => { clearTableLayoutStore(); document.body.innerHTML = ''; });

describe('table resize store', () => {
  it('clears stored widths and removes empty layouts', () => {
    clearStoredColumnWidths('missing');
    setStoredTableLayout('k', { columnWidths: [10] } as any);
    clearStoredColumnWidths('k');
    expect(getStoredTableLayout('k')).toBeUndefined();
    setStoredTableLayout('k2', { columnWidths: [10], wrapped: true } as any);
    clearStoredColumnWidths('k2');
    expect(getStoredTableLayout('k2')).toBeDefined();
  });

  it('builds keys from headers and weights columns by content length', () => {
    document.body.innerHTML = '<table id="t"><thead><tr><th><span class="mdn-th-text">Name</span></th><th></th><th>Long   header</th></tr></thead><tbody>'
      + '<tr><td>a</td><td></td><td>some much longer text value</td></tr><tr><td>bbbb</td><td></td><td>x</td></tr><tr><td>cc</td><td></td><td>yy</td></tr></tbody></table>';
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableKey(table)).toContain('Long header');
    const weights = getWrappedColumnWeights(table);
    expect(weights).toHaveLength(3);
    const pct = getWrappedColumnPercentages(table);
    expect(pct.reduce((a, b) => a + b, 0)).toBeGreaterThan(99);
    document.body.innerHTML = '<table><thead><tr></tr></thead></table>';
    expect(getWrappedColumnPercentages(document.querySelector('table') as HTMLTableElement)).toEqual([]);
  });
});
