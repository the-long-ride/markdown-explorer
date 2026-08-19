import { describe, expect, it, vi } from 'vitest';
import { exportPdfViaHost, PDF_FOOTER_TEXT } from '../../../../ui/src/export/pdfExport';

describe('exportPdfViaHost', () => {
  it('requests direct PDF generation and resolves saved paths without opening print UI', async () => {
    let listener: ((message: any) => void) | undefined;
    const postMessage = vi.fn((message: any) => {
      queueMicrotask(() => listener?.({
        command: 'exportPdfResult',
        requestId: message.requestId,
        ok: true,
        paths: ['C:/Exports/readme.pdf'],
      }));
    });
    const bridge = {
      postMessage,
      onMessage: (handler: (message: any) => void) => {
        listener = handler;
        return () => { listener = undefined; };
      },
      getState: () => undefined,
      setState: () => {},
      copyToClipboard: () => {},
    } as any;

    const result = await exportPdfViaHost(bridge, {
      documents: [{ fileName: 'readme.pdf', html: '<!doctype html><h1>Readme</h1>' }],
      footerEnabled: true,
    });

    expect(result).toEqual({ ok: true, paths: ['C:/Exports/readme.pdf'] });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      command: 'exportPdf',
      footerEnabled: true,
      footerText: PDF_FOOTER_TEXT,
      documents: [{ fileName: 'readme.pdf', html: '<!doctype html><h1>Readme</h1>' }],
    }));
  });

  it('surfaces a cancelled destination picker without treating it as an error', async () => {
    let listener: ((message: any) => void) | undefined;
    const bridge = {
      postMessage: (message: any) => queueMicrotask(() => listener?.({
        command: 'exportPdfResult', requestId: message.requestId, ok: false, cancelled: true,
      })),
      onMessage: (handler: (message: any) => void) => {
        listener = handler;
        return () => { listener = undefined; };
      },
      getState: () => undefined,
      setState: () => {},
      copyToClipboard: () => {},
    } as any;

    await expect(exportPdfViaHost(bridge, {
      documents: [{ fileName: 'readme.pdf', html: '<h1>Readme</h1>' }],
      footerEnabled: false,
    })).resolves.toEqual({ ok: false, cancelled: true, paths: [] });
  });
});
