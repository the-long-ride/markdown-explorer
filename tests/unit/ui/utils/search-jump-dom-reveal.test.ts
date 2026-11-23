import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealElementAncestors } from '../../../../ui/src/utils/searchJumpDom';

const win = window as any;
afterEach(() => { document.body.innerHTML = ''; delete win.Table; delete win.UI; });

const tableHtml = (rowClass: string) => `<div class="mdn-table-wrap"><input class="mdn-table-input" value="q"><button class="mdn-table-toggle-btn"></button><table id="t1" class="mdn-table"><tbody><tr class="${rowClass}"><td id="cell">x</td></tr><tr class="is-hidden"><td>y</td></tr></tbody></table></div>`;

describe('revealElementAncestors', () => {
  it('uses the Table runtime to switch views and clear filters for hidden rows', () => {
    document.body.innerHTML = tableHtml('is-hidden');
    const state: any = {};
    win.Table = { states: { t1: { currentView: 'chart' } }, switchView: vi.fn(), initState: vi.fn(() => state), applyAllFilters: vi.fn() };
    revealElementAncestors(document.getElementById('cell')!);
    expect(win.Table.switchView).toHaveBeenCalledWith('t1', 'table');
    expect(state).toMatchObject({ searchQuery: '', filters: {}, expanded: true });
    expect((document.querySelector('.mdn-table-input') as HTMLInputElement).value).toBe('');
  });

  it('expands collapsed rows via the runtime or by DOM fallback', () => {
    document.body.innerHTML = tableHtml('is-collapsed-row');
    const state: any = { searchQuery: 'keep' };
    win.Table = { states: { t1: { currentView: 'table' } }, initState: () => state, applyAllFilters: vi.fn() };
    revealElementAncestors(document.getElementById('cell')!);
    expect(state).toEqual({ searchQuery: 'keep', expanded: true });
    delete win.Table;
    revealElementAncestors(document.getElementById('cell')!);
    expect(document.querySelectorAll('tr.is-hidden, tr.is-collapsed-row')).toHaveLength(0);
    expect(document.querySelector('.mdn-table-toggle-btn')!.classList.contains('is-expanded')).toBe(true);
    document.body.innerHTML = '<table class="mdn-table"><tbody><tr><td id="c2">z</td></tr></tbody></table><p id="p">x</p>';
    revealElementAncestors(document.getElementById('c2')!);
    revealElementAncestors(document.getElementById('p')!);
  });

  it('switches preview code blocks back to source and expands collapsed code', () => {
    const block = (inner: string) => `<div class="mdn-codeblock" data-mode="preview" data-collapsed="true"><button class="mdn-codeblock-toggle-btn" data-label-show-less="Less">More</button>${inner}<div class="mdn-code-source" style="display:none"><span id="src">code</span></div><div class="mdn-html-preview-body"></div></div>`;
    document.body.innerHTML = block('<button class="mdn-toggle-preview-btn"></button>');
    win.UI = { toggleHtmlMode: vi.fn(), toggleCodeCollapse: vi.fn() };
    revealElementAncestors(document.getElementById('src')!);
    expect(win.UI.toggleHtmlMode).toHaveBeenCalled();
    expect(win.UI.toggleCodeCollapse).toHaveBeenCalled();
    document.body.innerHTML = block('<button class="mdn-toggle-csv-btn"></button>');
    win.UI = { toggleCsvMode: vi.fn() };
    revealElementAncestors(document.getElementById('src')!);
    expect(win.UI.toggleCsvMode).toHaveBeenCalled();
    expect(document.querySelector('.mdn-codeblock-toggle-btn')!.textContent).toBe('Less');
    document.body.innerHTML = `<details><summary>s</summary><details><summary>t</summary>${block('')}</details></details>`;
    delete win.UI;
    revealElementAncestors(document.getElementById('src')!);
    const codeBlock = document.querySelector<HTMLElement>('.mdn-codeblock')!;
    expect(codeBlock.dataset.mode).toBe('code');
    expect(document.querySelector<HTMLElement>('.mdn-html-preview-body')!.style.display).toBe('none');
    expect([...document.querySelectorAll('details')].every((d) => d.open)).toBe(true);
  });
});
