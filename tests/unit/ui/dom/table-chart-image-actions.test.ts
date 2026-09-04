import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeChartContextMenu,
  showChartContextMenu,
} from '../../../../ui/src/dom/tableChartImageActions.ts';

describe('tableChartImageActions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    closeChartContextMenu();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders and positions context menu with Copy and Save actions', () => {
    const canvas = document.createElement('canvas');
    const event = new MouseEvent('contextmenu', {
      clientX: 100,
      clientY: 150,
      bubbles: true,
      cancelable: true,
    });

    showChartContextMenu(canvas, 'tbl_demo', 'bar', event);

    const menu = document.querySelector('.mdn-chart-context-menu');
    expect(menu).not.toBeNull();
    expect(menu?.querySelectorAll('.mdn-chart-context-menu__item')).toHaveLength(2);

    // Positions within window
    expect((menu as HTMLElement).style.left).toMatch(/\d+px/);
    expect((menu as HTMLElement).style.top).toMatch(/\d+px/);

    closeChartContextMenu();
    expect(document.querySelector('.mdn-chart-context-menu')).toBeNull();
  });

  it('executes saveChartPng action with browser download fallback', async () => {
    const canvas = document.createElement('canvas');
    const dummyBlob = new Blob(['png'], { type: 'image/png' });
    canvas.toBlob = (cb) => cb(dummyBlob);

    const clickMock = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') el.click = clickMock;
      return el;
    });

    const event = new MouseEvent('contextmenu', { clientX: 50, clientY: 50 });
    showChartContextMenu(() => canvas, 'table_1', 'line', event);

    const menu = document.querySelector('.mdn-chart-context-menu')!;
    const items = menu.querySelectorAll<HTMLButtonElement>('.mdn-chart-context-menu__item');

    // Second button is Save action
    const saveButton = items[1];
    saveButton.click();

    await vi.runAllTimersAsync();
    expect(clickMock).toHaveBeenCalled();
  });

  it('delegates to window.Table.saveChartPngToHost when available', async () => {
    const canvas = document.createElement('canvas');
    const hostSaver = vi.fn(() => true);
    (window as any).Table = { saveChartPngToHost: hostSaver };

    try {
      const event = new MouseEvent('contextmenu', { clientX: 50, clientY: 50 });
      showChartContextMenu(canvas, 'table_2', 'pie', event);

      const menu = document.querySelector('.mdn-chart-context-menu')!;
      const items = menu.querySelectorAll<HTMLButtonElement>('.mdn-chart-context-menu__item');
      items[1].click();

      await vi.runAllTimersAsync();
      expect(hostSaver).toHaveBeenCalledWith(canvas, 'table_2-pie.png');
    } finally {
      delete (window as any).Table;
    }
  });

  it('closes menu when clicking outside', () => {
    const canvas = document.createElement('canvas');
    const event = new MouseEvent('contextmenu', { clientX: 50, clientY: 50 });
    showChartContextMenu(canvas, 'table_1', 'bar', event);

    expect(document.querySelector('.mdn-chart-context-menu')).not.toBeNull();

    // Advance timer so outside click listener is registered
    vi.advanceTimersByTime(10);

    // Outside pointerdown event
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.mdn-chart-context-menu')).toBeNull();
  });
});
