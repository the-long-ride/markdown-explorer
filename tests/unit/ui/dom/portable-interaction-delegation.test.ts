import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPortableInteractionController } from '../../../../ui/src/dom/portableInteractionController';

const win: any = { Table: {}, UI: {} };

beforeAll(() => {
  installPortableInteractionController(document, win);
  installPortableInteractionController(document, win);
});

beforeEach(() => {
  win.Table = {
    filter: vi.fn(), showAlignMenu: vi.fn(), showFilterMenu: vi.fn(), toggleCollapse: vi.fn(), resetColumnWidths: vi.fn(),
    toggleWrap: vi.fn(), toggleColumnMenu: vi.fn(), toggleViewDropdown: vi.fn(), switchView: vi.fn(), closeViewDropdown: vi.fn(), sort: vi.fn(),
  };
  win.UI = { copySection: vi.fn(), copyCode: vi.fn(), toggleHtmlMode: vi.fn(), toggleCsvMode: vi.fn(), toggleCodeCollapse: vi.fn(), toggleSection: vi.fn() };
  document.body.innerHTML = `
    <div class="mdn-table-wrap" id="t1-wrap">
      <input class="mdn-table-input" value="q">
      <button class="mdn-table-toggle-btn" id="t1-toggle-btn"></button>
      <button class="mdn-table-reset-widths" id="t1-reset-widths"></button>
      <button class="mdn-table-wrap-toggle" id="t1-wrap-toggle"></button>
      <button class="mdn-table-columns-toggle" id="t1-columns-toggle"></button>
      <div class="mdn-table-view-dropdown" id="t1-view-dropdown">
        <button class="mdn-table-view-select"></button>
        <button class="mdn-table-view-menu__option" data-value="chart"></button>
        <button class="mdn-table-view-menu__option" data-value="x" disabled></button>
        <button class="mdn-table-view-menu__option" data-value="y" aria-disabled="true"></button>
        <button class="mdn-table-view-menu__option"></button>
      </div>
      <table class="mdn-table" id="t1"><thead><tr>
        <th class="mdn-th" data-col="2"><span class="mdn-th-actions"><span role="button" class="mdn-table-align-btn">a</span><span class="mdn-table-filter-btn">f</span><span class="mdn-sort-icon">s</span></span></th>
        <th class="mdn-th" id="nocol"><span class="mdn-table-align-btn">a</span><span class="mdn-table-filter-btn">f</span><span class="mdn-sort-icon">s</span></th>
      </tr></thead></table>
    </div>
    <table class="mdn-table" id="t2"><tr><th class="mdn-th" data-col="0"><span class="mdn-sort-icon">s</span></th></tr></table>
    <div class="mdn-table-wrap" id="anon"><input class="mdn-table-input"><button class="mdn-table-toggle-btn" id="x"></button><button class="mdn-table-reset-widths"></button><button class="mdn-table-wrap-toggle"></button><button class="mdn-table-columns-toggle"></button><div class="mdn-table-view-dropdown"><button class="mdn-table-view-select"></button><button class="mdn-table-view-menu__option" data-value="z"></button></div></div>
    <span class="mdn-sort-icon" id="loose-sort"></span>
    <section class="mdn-section"><div class="mdn-section-header"><span class="title">T</span><a href="#">link</a>
      <button class="mdn-section-copy-btn"></button></div>
      <div class="mdn-codeblock"><button class="mdn-copy-btn"></button><button class="mdn-codeblock-toggle-btn"></button></div>
      <div><button class="mdn-toggle-preview-btn"></button><button class="mdn-toggle-csv-btn"></button></div>
    </section>`;
});

const click = (selector: string, root: ParentNode = document) => (root.querySelector(selector) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

describe('portable interaction delegation', () => {
  it('filters tables from inputs inside identified wraps only', () => {
    const input = document.querySelector<HTMLInputElement>('#t1-wrap .mdn-table-input')!;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#anon .mdn-table-input')!.dispatchEvent(new Event('input', { bubbles: true }));
    document.body.dispatchEvent(new Event('input', { bubbles: true }));
    expect(win.Table.filter).toHaveBeenCalledTimes(1);
    expect(win.Table.filter).toHaveBeenCalledWith('t1', 'q');
  });

  it('routes content controls to UI handlers', () => {
    ['.mdn-section-copy-btn', '.mdn-copy-btn', '.mdn-toggle-preview-btn', '.mdn-toggle-csv-btn', '.mdn-codeblock-toggle-btn'].forEach((selector) => click(selector));
    expect(win.UI.copySection).toHaveBeenCalled();
    expect(win.UI.copyCode).toHaveBeenCalled();
    expect(win.UI.toggleHtmlMode).toHaveBeenCalled();
    expect(win.UI.toggleCsvMode).toHaveBeenCalled();
    expect(win.UI.toggleCodeCollapse).toHaveBeenCalled();
    expect(win.UI.toggleSection).not.toHaveBeenCalled();
  });

  it('toggles sections from header text but not from interactive children', () => {
    click('.mdn-section-header a');
    expect(win.UI.toggleSection).not.toHaveBeenCalled();
    click('.mdn-section-header .title');
    click('.mdn-section-header');
    expect(win.UI.toggleSection).toHaveBeenCalledTimes(2);
    document.querySelector('.title')!.firstChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(win.UI.toggleSection).toHaveBeenCalledTimes(3);
  });

  it('routes header actions with table and column ids', () => {
    click('[data-col="2"] .mdn-table-align-btn');
    click('[data-col="2"] .mdn-table-filter-btn');
    click('[data-col="2"] .mdn-sort-icon');
    click('#t2 .mdn-sort-icon');
    expect(win.Table.showAlignMenu).toHaveBeenCalledWith('t1', 2, expect.any(HTMLElement));
    expect(win.Table.showFilterMenu).toHaveBeenCalledWith('t1', 2, expect.any(HTMLElement));
    expect(win.Table.sort).toHaveBeenCalledWith('t1', 2);
    expect(win.Table.sort).toHaveBeenCalledWith('t2', 0);
    ['#nocol .mdn-table-align-btn', '#nocol .mdn-table-filter-btn', '#nocol .mdn-sort-icon', '#loose-sort', '#nocol'].forEach((selector) => click(selector));
    expect(win.Table.showAlignMenu).toHaveBeenCalledTimes(1);
    expect(win.Table.showFilterMenu).toHaveBeenCalledTimes(1);
    expect(win.Table.sort).toHaveBeenCalledTimes(2);
  });

  it('routes table toolbar controls and view options', () => {
    ['.mdn-table-toggle-btn', '.mdn-table-reset-widths', '.mdn-table-wrap-toggle', '.mdn-table-columns-toggle', '.mdn-table-view-select', '.mdn-table-view-menu__option'].forEach((selector) => {
      click(selector, document.getElementById('t1-wrap')!);
      click(selector, document.getElementById('anon')!);
    });
    document.querySelectorAll<HTMLElement>('#t1-view-dropdown .mdn-table-view-menu__option').forEach((option) => option.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(win.Table.toggleCollapse).toHaveBeenCalledWith('t1');
    expect(win.Table.resetColumnWidths).toHaveBeenCalledWith('t1');
    expect(win.Table.toggleWrap).toHaveBeenCalledTimes(1);
    expect(win.Table.toggleColumnMenu).toHaveBeenCalledTimes(1);
    expect(win.Table.toggleViewDropdown).toHaveBeenCalledTimes(1);
    expect(win.Table.switchView).toHaveBeenCalledTimes(2);
    expect(win.Table.switchView).toHaveBeenCalledWith('t1', 'chart');
    expect(win.Table.closeViewDropdown).toHaveBeenCalledWith('t1');
  });

  it('activates header action buttons from the keyboard', () => {
    const action = document.querySelector<HTMLElement>('.mdn-th-actions [role="button"]')!;
    const fire = (key: string, prevent = false) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      if (prevent) event.preventDefault();
      action.dispatchEvent(event);
    };
    fire('a');
    fire('Enter', true);
    expect(win.Table.showAlignMenu).not.toHaveBeenCalled();
    fire('Enter');
    fire(' ');
    expect(win.Table.showAlignMenu).toHaveBeenCalledTimes(2);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new MouseEvent('click'));
  });
});
