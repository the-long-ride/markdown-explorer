import { afterEach, describe, expect, it, vi } from 'vitest';
import { printExportBatch, printExportHtml } from '../../../../ui/src/export/printExport';

describe('print export pipeline', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads standalone html into an iframe, prints it, and cleans up afterprint', async () => {
    const originalCreate = document.createElement.bind(document);
    let createdIframe: HTMLIFrameElement | null = null;
    const focus = vi.fn();
    const print = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreate(tagName);
      if (tagName === 'iframe') {
        createdIframe = element as HTMLIFrameElement;
        Object.defineProperty(createdIframe, 'contentWindow', {
          configurable: true,
          value: { focus, print, addEventListener: vi.fn(), removeEventListener: vi.fn() },
        });
      }
      return element;
    }) as typeof document.createElement);

    const promise = printExportHtml('<!doctype html><title>One</title><p>Hello</p>', 'One');
    expect(createdIframe).toBeTruthy();
    createdIframe!.dispatchEvent(new Event('load'));

    const win = createdIframe!.contentWindow as any;
    const afterPrint = win.addEventListener.mock.calls.find((call: any[]) => call[0] === 'afterprint')?.[1];
    expect(afterPrint).toBeTypeOf('function');
    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
    afterPrint();

    await expect(promise).resolves.toBe('printed');
    expect(createdIframe!.isConnected).toBe(false);
  });

  it('prints separate documents sequentially', async () => {
    const printOne = vi.fn()
      .mockResolvedValueOnce('printed')
      .mockResolvedValueOnce('printed');

    const count = await printExportBatch([
      { html: '<p>A</p>', title: 'A' },
      { html: '<p>B</p>', title: 'B' },
    ], printOne);

    expect(count).toBe(2);
    expect(printOne).toHaveBeenNthCalledWith(1, '<p>A</p>', 'A');
    expect(printOne).toHaveBeenNthCalledWith(2, '<p>B</p>', 'B');
  });
});
