import { describe, expect, test, vi } from 'vitest';
import {
  applyPreviewActionTranslations,
  buildBrowserPreviewShell,
  getHtmlPreviewDocument,
  injectBaseHref,
  openHtmlPreviewInBrowser,
  revokeAllHtmlPreviewUrls,
} from '../../../../ui/src/dom/htmlPreviewActions';

const labels = {
  openInBrowser: 'Browser', openAsModal: 'Modal', showCode: 'Code', showPreview: 'Preview',
  copyCode: 'Copy', modalTitle: 'HTML', closeModal: 'Close', openError: 'Error',
  linkMenu: 'Links', copyLink: 'Copy link', linkCopied: 'Copied', unableToOpenLink: 'No open', copyFailed: 'No copy',
};

describe('html preview actions', () => {
  test('extracts srcdoc from the HTML block containing the trigger', () => {
    document.body.innerHTML = '<div class="mdn-html-preview-wrap"><button id="b"></button><iframe class="mdn-html-preview-iframe" srcdoc="&lt;p&gt;x&lt;/p&gt;"></iframe></div>';
    expect(getHtmlPreviewDocument(document.getElementById('b')!)).toBe('<p>x</p>');
  });

  test('rebuilds modal and browser previews from the preserved raw HTML source', () => {
    document.body.innerHTML = '<div class="mdn-html-preview-wrap" data-preview-theme="dark"><button id="b"></button><template class="mdn-html-preview-source">&lt;p&gt;hello&lt;/p&gt;&lt;script&gt;window.ok=1&lt;/script&gt;</template></div>';
    const result = getHtmlPreviewDocument(document.getElementById('b')!, 'modal');
    expect(result).toContain('<p>hello</p><script>window.ok=1</script>');
    expect(result).toContain('data-theme="dark"');
    expect(result).not.toContain('data-mdn-inline-resize');
  });

  test('injects one base element into a standalone document', () => {
    const result = injectBaseHref('<html><head><title>x</title></head><body></body></html>', 'file:///tmp/docs/');
    expect(result.match(/<base /g)).toHaveLength(1);
    expect(result).toContain('href="file:///tmp/docs/"');
  });

  test('applies translated title, aria label, tooltip, and toggle label data', () => {
    document.body.innerHTML = '<button data-i18n-key="openInBrowser"><span class="tooltip-text"></span></button><button class="mdn-toggle-preview-btn" data-i18n-key="showCode"><span class="tooltip-text"></span></button>';
    applyPreviewActionTranslations(document.body, labels);
    const button = document.querySelector('[data-i18n-key="openInBrowser"]')!;
    expect(button.getAttribute('title')).toBe('Browser');
    expect(button.getAttribute('aria-label')).toBe('Browser');
    expect(button.querySelector('.tooltip-text')?.textContent).toBe('Browser');
    const toggle = document.querySelector('.mdn-toggle-preview-btn')!;
    expect(toggle.getAttribute('data-label-show-code')).toBe('Code');
    expect(toggle.getAttribute('data-label-show-preview')).toBe('Preview');
  });

  test('wraps browser previews in a full-viewport sandbox without same-origin access', () => {
    const shell = buildBrowserPreviewShell('blob:user-html', 'Localized preview');
    expect(shell).toContain('sandbox="allow-scripts"');
    expect(shell).not.toContain('allow-same-origin');
    expect(shell).toContain('src="blob:user-html"');
    expect(shell).toContain('position:fixed');
    expect(shell).toContain('<title>Localized preview</title>');
  });

  test('dispatches desktop previews to the host bridge', () => {
    const postMessage = vi.fn();
    openHtmlPreviewInBrowser({ bridge: { postMessage } as any, runtime: 'desktop', documentHtml: '<p>x</p>', currentFile: null });
    expect(postMessage).toHaveBeenCalledWith({ command: 'openHtmlPreview', documentHtml: expect.stringContaining('<p>x</p>') });
  });


  test('reports synchronous desktop bridge failures', () => {
    const onError = vi.fn();
    const postMessage = vi.fn(() => { throw new Error('host unavailable'); });
    openHtmlPreviewInBrowser({ bridge: { postMessage } as any, runtime: 'desktop', documentHtml: '<p>x</p>', currentFile: null, onError });
    expect(onError).toHaveBeenCalled();
  });

  test('revokes both Blob URLs when opening the browser throws', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:user-html')
      .mockReturnValueOnce('blob:shell');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window, 'open').mockImplementation(() => { throw new Error('blocked'); });
    const onError = vi.fn();
    openHtmlPreviewInBrowser({ bridge: {} as any, runtime: 'chrome', documentHtml: '<p>x</p>', currentFile: null, onError });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:user-html');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:shell');
    expect(onError).toHaveBeenCalled();
  });

  test('severs the opener before navigating to a sandbox shell and revokes both Blob URLs', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:user-html')
      .mockReturnValueOnce('blob:shell');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const replace = vi.fn();
    const previewWindow = { closed: false, opener: window, location: { replace } } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(previewWindow);
    openHtmlPreviewInBrowser({ bridge: {} as any, runtime: 'chrome', documentHtml: '<p>x</p>', currentFile: null });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(previewWindow.opener).toBeNull();
    expect(replace).toHaveBeenCalledWith('blob:shell');
    revokeAllHtmlPreviewUrls();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:user-html');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:shell');
  });
});
