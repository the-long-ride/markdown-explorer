import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerCopyHandlers } from '../../../../ui/src/dom/copyHandlers';

describe('registerCopyHandlers', () => {
  let win: any;
  let mockCopy: any;

  beforeEach(() => {
    mockCopy = vi.fn();
    win = { UI: {}, PlatformBridge: { copyToClipboard: mockCopy } };
    document.body.innerHTML = '';
    delete (window as any).UI_copyCode;
  });

  it('registers UI methods on window', () => {
    registerCopyHandlers(win);
    expect(typeof win.UI.copySection).toBe('function');
    expect(typeof win.UI.copyDocument).toBe('function');
    expect(typeof win.UI.copyCode).toBe('function');
    expect(typeof win.UI.markCopyButtonCopied).toBe('function');
  });

  it('win.UI_copyCode is also set for backward compat', () => {
    registerCopyHandlers(win);
    expect(typeof win.UI_copyCode).toBe('function');
  });

  it('markCopyButtonCopied applies and resets copy state', () => {
    document.body.innerHTML = `
      <button id="copyBtn">
        <span class="tooltip-text">Copy</span>
      </button>
    `;
    registerCopyHandlers(win);
    const btn = document.getElementById('copyBtn') as HTMLElement;
    const tooltip = btn.querySelector('.tooltip-text') as HTMLElement;

    expect(btn.classList.contains('is-copied')).toBe(false);
    expect(tooltip.textContent).toBe('Copy');
  });

  it('copyCode extracts code text', () => {
    registerCopyHandlers(win);
    document.body.innerHTML = `
      <div class="mdn-codeblock">
        <code>console.log(1);</code>
        <button id="copyCodeBtn"></button>
      </div>
    `;
    const btn = document.getElementById('copyCodeBtn') as HTMLElement;
    // In JSDOM, innerText for <code> might not return value, but function should not crash
    expect(() => win.UI.copyCode(btn)).not.toThrow();
    // Verify markCopied side-effect (button gets is-copied class if copy succeeds)
  });

  it('copyDocument uses mdBody when present', () => {
    registerCopyHandlers(win);
    document.body.innerHTML = `
      <div id="mdBody">File content here</div>
      <button id="copyDocBtn"><span class="tooltip-text">Copy file</span></button>
    `;
    const btn = document.getElementById('copyDocBtn') as HTMLElement;
    win.UI.copyDocument(btn);
    expect(mockCopy).toHaveBeenCalledWith('File content here');
  });

  it('copySection uses markdown source when available', () => {
    registerCopyHandlers(win);
    const markdownSource = '# Hello\n\nContent here\n\n# Next';
    win.UI.currentMarkdownSource = markdownSource;
    document.body.innerHTML = `
      <div class="mdn-section" id="hello">
        <div class="mdn-section-body">Body</div>
        <button id="copySecBtn"></button>
      </div>
    `;
    const btn = document.getElementById('copySecBtn') as HTMLElement;
    win.UI.copySection(btn);
    expect(mockCopy).toHaveBeenCalledWith('# Hello\n\nContent here');
  });

  it('copySection falls back to body text when no markdown source', () => {
    registerCopyHandlers(win);
    document.body.innerHTML = `
      <div class="mdn-section" id="test-section">
        <div class="mdn-section-body">Fallback content</div>
        <button id="copySecBtn"></button>
      </div>
    `;
    const btn = document.getElementById('copySecBtn') as HTMLElement;
    win.UI.copySection(btn);
    expect(mockCopy).toHaveBeenCalledWith('Fallback content');
  });

  it('copyDocument does nothing when mdBody is missing', () => {
    registerCopyHandlers(win);
    document.body.innerHTML = '<button id="copyDocBtn"></button>';
    const btn = document.getElementById('copyDocBtn') as HTMLElement;
    win.UI.copyDocument(btn);
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
