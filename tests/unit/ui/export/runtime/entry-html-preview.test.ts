import { afterEach, describe, expect, it, vi } from 'vitest';

type PreviewUi = { openHtmlPreview: (b: HTMLElement) => void; openHtmlPreviewModal: (b: HTMLElement) => void };

async function load(): Promise<PreviewUi> {
  vi.resetModules();
  delete (window as any).__mdnExportHtmlPreviewInstalled;
  delete (window as any).UI;
  await import('../../../../../ui/src/export/runtime/entry-html-preview');
  return (window as any).UI as PreviewUi;
}

function wrap(srcdoc = '<p>hi</p>') {
  document.body.innerHTML = `<div class="mdn-html-preview-wrap"><iframe id="f1" class="mdn-html-preview-iframe"></iframe><button>open</button></div><button id="lonely">x</button>`;
  const iframe = document.querySelector('iframe')!;
  iframe.srcdoc = srcdoc;
  return { iframe, button: document.querySelector('.mdn-html-preview-wrap button') as HTMLElement };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('export runtime html preview entry', () => {
  it('installs once and reuses an existing UI object', async () => {
    const ui = await load();
    expect(typeof ui.openHtmlPreview).toBe('function');
    await import('../../../../../ui/src/export/runtime/entry-html-preview');
    vi.resetModules();
    const existing = { keep: true };
    (window as any).UI = existing;
    delete (window as any).__mdnExportHtmlPreviewInstalled;
    await import('../../../../../ui/src/export/runtime/entry-html-preview');
    expect((window as any).UI).toBe(existing);
    expect(typeof (existing as any).openHtmlPreviewModal).toBe('function');
    vi.resetModules();
    await import('../../../../../ui/src/export/runtime/entry-html-preview');
  });

  it('resizes iframes only for valid resize messages', async () => {
    await load();
    const { iframe } = wrap();
    const post = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data }));
    post(null);
    post({ type: 'other', id: 'f1', height: 10 });
    post({ type: 'resize-iframe', id: 1, height: 10 });
    post({ type: 'resize-iframe', id: 'f1', height: 'x' });
    post({ type: 'resize-iframe', id: 'f1', height: Number.POSITIVE_INFINITY });
    post({ type: 'resize-iframe', id: 'f1', height: -5 });
    post({ type: 'resize-iframe', id: 'missing', height: 10 });
    expect(iframe.style.height).toBe('');
    post({ type: 'resize-iframe', id: 'f1', height: 99.2 });
    expect(iframe.style.height).toBe('100px');
  });

  it('opens previews in a new window and revokes the blob URL', async () => {
    vi.useFakeTimers();
    const ui = await load();
    const { button, iframe } = wrap();
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    (URL as any).createObjectURL = create;
    (URL as any).revokeObjectURL = revoke;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    ui.openHtmlPreview(document.getElementById('lonely')!);
    iframe.srcdoc = '';
    ui.openHtmlPreview(button);
    expect(open).not.toHaveBeenCalled();
    iframe.srcdoc = '<b>x</b>';
    ui.openHtmlPreview(button);
    expect(open).toHaveBeenCalledWith('blob:x', '_blank', 'noopener,noreferrer');
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });

  it('opens and closes the preview modal', async () => {
    const ui = await load();
    const { button, iframe } = wrap();
    ui.openHtmlPreviewModal(document.getElementById('lonely')!);
    expect(document.querySelector('.mdn-export-html-preview-modal')).toBeNull();
    ui.openHtmlPreviewModal(button);
    ui.openHtmlPreviewModal(button);
    expect(document.querySelectorAll('.mdn-export-html-preview-modal')).toHaveLength(1);
    const modal = () => document.querySelector('.mdn-export-html-preview-modal') as HTMLElement | null;
    expect(modal()!.querySelector('iframe')!.srcdoc).toBe(iframe.srcdoc);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(modal()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal()).toBeNull();
    ui.openHtmlPreviewModal(button);
    modal()!.querySelector('.mdn-html-preview-modal__content')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal()).not.toBeNull();
    modal()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal()).toBeNull();
    ui.openHtmlPreviewModal(button);
    (modal()!.querySelector('.mdn-modal-close') as HTMLElement).click();
    expect(modal()).toBeNull();
  });
});
