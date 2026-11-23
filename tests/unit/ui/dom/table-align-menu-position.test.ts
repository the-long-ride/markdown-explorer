import { afterEach, describe, expect, it, vi } from 'vitest';
import { getColumnAlignment, inferTableColumnAlignmentFromDom, setColumnAlignment, showAlignMenu } from '../../../../ui/src/dom/tableAlignHandlers';

function rect(left: number, top: number, width = 20, height = 20): DOMRect {
  return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function mount(wrapperClass = '') {
  document.body.innerHTML = `<div class="${wrapperClass}"><table id="t1"><thead><tr><th><button class="btn">A</button></th></tr></thead><tbody><tr><td>1</td></tr><tr></tr></tbody></table></div>`;
  return document.querySelector<HTMLButtonElement>('.btn')!;
}

const menu = () => document.querySelector('.mdn-align-item')?.parentElement?.closest('body > *') ?? null;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  delete document.documentElement.dataset.tableAlign;
});

describe('align menu positioning and dismissal', () => {
  it('clamps the dropdown to the viewport and closes on Escape', () => {
    vi.useFakeTimers();
    const button = mount();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(window.innerWidth - 10, 10));
    showAlignMenu('t1', 0, button);
    const dropdown = menu() as HTMLElement;
    expect(dropdown).toBeTruthy();
    expect(parseFloat(dropdown.style.left)).toBeLessThanOrEqual(window.innerWidth - 140 - 12);
    vi.runAllTimers();
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(menu()).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu()).toBeNull();
  });

  it('closes when the button scrolls out of its container or disconnects', () => {
    vi.useFakeTimers();
    const button = mount('mdn-table-scroll');
    const container = document.querySelector<HTMLElement>('.mdn-table-scroll')!;
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 500, 500));
    const buttonRect = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(10, 10));
    showAlignMenu('t1', 0, button);
    vi.runAllTimers();
    expect(menu()).toBeTruthy();
    buttonRect.mockReturnValue(rect(10, 900));
    window.dispatchEvent(new Event('scroll'));
    expect(menu()).toBeNull();

    showAlignMenu('t1', 0, button);
    vi.runAllTimers();
    button.remove();
    window.dispatchEvent(new Event('resize'));
    expect(menu()).toBeNull();
  });

  it('closes on outside clicks but not on clicks inside the dropdown', () => {
    vi.useFakeTimers();
    const button = mount();
    showAlignMenu('t1', 0, button);
    vi.runAllTimers();
    const dropdown = menu() as HTMLElement;
    dropdown.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu()).toBeTruthy();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu()).toBeNull();
  });

  it('applies alignment from a menu item and tolerates missing tables and cells', () => {
    const button = mount();
    showAlignMenu('missing', 0, button);
    setColumnAlignment('missing', 0, 'left');
    showAlignMenu('t1', 0, button);
    const right = document.querySelector<HTMLButtonElement>('.mdn-align-item[data-align="right"]')!;
    right.click();
    expect(menu()).toBeNull();
    expect(getColumnAlignment(document.querySelector('th'))).toBe('right');
    setColumnAlignment('t1', 3, 'center');
  });

  it('infers alignment from sparse rows and honours the document default', () => {
    const button = mount();
    const table = button.closest('table')!;
    expect(inferTableColumnAlignmentFromDom(table, 0)).toBeTruthy();
    expect(inferTableColumnAlignmentFromDom(table, 5)).toBeTruthy();
    document.documentElement.dataset.tableAlign = 'intelligent';
    expect(getColumnAlignment(null)).toBe('intelligent');
    document.documentElement.dataset.tableAlign = 'other';
    expect(getColumnAlignment(null)).toBeTruthy();
  });
});
