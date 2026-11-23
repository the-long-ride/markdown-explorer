import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealElementAncestors } from '../../../../ui/src/utils/searchJumpDom';

afterEach(() => { delete (window as any).UI; document.body.innerHTML = ''; });

function block(extra: string, attrs = 'data-mode="preview"') {
  document.body.innerHTML = `<div class="mdn-codeblock" ${attrs}>${extra}<pre class="mdn-code-source" style="display:none"><code><span id="hit">x</span></code></pre></div>`;
  return { el: document.getElementById('hit')!, code: document.querySelector('.mdn-codeblock') as HTMLElement };
}

describe('revealElementAncestors code blocks', () => {
  it('uses html and csv preview toggles when available', () => {
    const toggleHtmlMode = vi.fn();
    const toggleCsvMode = vi.fn();
    (window as any).UI = { toggleHtmlMode, toggleCsvMode };
    revealElementAncestors(block('<button class="mdn-toggle-preview-btn"></button>').el);
    expect(toggleHtmlMode).toHaveBeenCalled();
    revealElementAncestors(block('<button class="mdn-toggle-csv-btn"></button>').el);
    expect(toggleCsvMode).toHaveBeenCalled();
  });

  it('falls back to switching modes and expanding collapsed blocks manually', () => {
    const { el, code } = block('<div class="mdn-html-preview-body"></div><button class="mdn-codeblock-toggle-btn" data-label-show-less="Less"></button>', 'data-mode="preview" data-collapsed="true"');
    revealElementAncestors(el);
    expect(code.dataset.mode).toBe('code');
    expect((code.querySelector('.mdn-html-preview-body') as HTMLElement).style.display).toBe('none');
    expect(code.dataset.collapsed).toBe('false');
    expect(code.querySelector('.mdn-codeblock-toggle-btn')!.textContent).toBe('Less');
    const second = block('', 'data-mode="preview" data-collapsed="true"');
    revealElementAncestors(second.el);
    expect(second.code.dataset.collapsed).toBe('false');
  });

  it('delegates collapse toggling to the UI runtime', () => {
    const toggleCodeCollapse = vi.fn();
    (window as any).UI = { toggleCodeCollapse };
    revealElementAncestors(block('<button class="mdn-codeblock-toggle-btn"></button>', 'data-collapsed="true"').el);
    expect(toggleCodeCollapse).toHaveBeenCalled();
  });
});
