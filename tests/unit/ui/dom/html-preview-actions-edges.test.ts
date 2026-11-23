import { describe, expect, it, vi } from 'vitest';
import {
  applyPreviewActionTranslations, documentBaseHref, getHtmlPreviewDocument, openLocalFileInBrowser,
} from '../../../../ui/src/dom/htmlPreviewActions';

describe('html preview action edges', () => {
  it('reads preview documents from templates or iframes', () => {
    const lone = document.createElement('button');
    expect(getHtmlPreviewDocument(lone)).toBeNull();
    const wrap = document.createElement('div');
    wrap.className = 'mdn-html-preview-wrap';
    const btn = document.createElement('button');
    wrap.append(btn);
    expect(getHtmlPreviewDocument(btn)).toBeNull();
    const iframe = document.createElement('iframe');
    iframe.className = 'mdn-html-preview-iframe';
    wrap.append(iframe);
    expect(getHtmlPreviewDocument(btn)).toBeNull();
    iframe.setAttribute('srcdoc', '<p>x</p>');
    expect(getHtmlPreviewDocument(btn)).toBe('<p>x</p>');
    const tpl = document.createElement('template');
    tpl.className = 'mdn-html-preview-source';
    tpl.innerHTML = '<p>src</p>';
    wrap.append(tpl);
    expect(getHtmlPreviewDocument(btn, 'external')).toContain('src');
  });

  it('computes base hrefs and opens local files', () => {
    expect(documentBaseHref(null)).toBeNull();
    expect(documentBaseHref('https://h/a/b.md')).toBe('https://h/a/');
    expect(documentBaseHref('/w/docs/a.md')).toMatch(/^file:.*\/w\/docs\/$/);
    const bridge: any = { postMessage: vi.fn() };
    expect(openLocalFileInBrowser(bridge, '')).toBe(false);
    expect(openLocalFileInBrowser(bridge, '/w/a.html')).toBe(true);
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openExternal' }));
  });

  it('applies translations to tooltips, hover tooltips, content and preview labels', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button data-i18n-key="showCode" title="t"><span class="tooltip-text">old</span></button>
      <button data-i18n-key="showPreview" data-hover-tooltip="old"></button>
      <button data-i18n-key="missingKey"></button>
      <button data-i18n-key="showCode" id="plain"></button>
      <span data-i18n-content-key="showCode">c</span><span data-i18n-content-key="nope">n</span>
      <div class="mdn-codeblock" data-mode="code"><span class="mdn-codeblock-lang" data-i18n-preview-key="showPreview">L</span></div>
      <div class="mdn-codeblock" data-mode="preview"><span class="mdn-codeblock-lang" data-i18n-preview-key="showPreview">L</span><span class="mdn-codeblock-lang" data-i18n-preview-key="nope">N</span></div>
      <button class="mdn-toggle-preview-btn"></button>`;
    applyPreviewActionTranslations(root, { showCode: 'Code', showPreview: 'Preview' } as any);
    expect(root.querySelector('.tooltip-text')!.textContent).toBe('Code');
    expect(root.querySelector('[data-hover-tooltip]')!.getAttribute('data-hover-tooltip')).toBe('Preview');
    expect(root.querySelector('[data-i18n-key="missingKey"]')!.hasAttribute('aria-label')).toBe(false);
    const langs = root.querySelectorAll<HTMLElement>('.mdn-codeblock-lang');
    expect(langs[0].textContent).toBe('L');
    expect(langs[0].dataset.translatedPreviewLabel).toBe('Preview');
    expect(langs[1].textContent).toBe('Preview');
    expect((root.querySelector('.mdn-toggle-preview-btn') as HTMLElement).dataset.labelShowCode).toBe('Code');
  });
});
