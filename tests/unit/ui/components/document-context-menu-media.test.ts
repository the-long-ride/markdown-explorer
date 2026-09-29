import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentContextMenuHandler } from '../../../../ui/src/components/Content/documentContextMenuHandler';

const COPY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4"/></svg>';

const HTML = `
  <div class="mdn-mermaid-wrap"><div class="mermaid"><svg class="diagram"><g><text>A</text></g></svg></div></div>
  <div class="mdn-codeblock">
    <div class="mdn-codeblock-header">
      <button class="mdn-copy-btn">${COPY_ICON}</button>
    </div>
    <pre class="mdn-code-source"><code>const x = 1;</code></pre>
  </div>
  <p>Inline <svg class="loose-icon"><path d="M0 0"/></svg> icon</p>
  <p><img class="pic" src="a.png" alt="a"></p>`;

function setup() {
  const body = document.createElement('div');
  body.className = 'mdn-body';
  body.innerHTML = HTML;
  document.body.appendChild(body);
  const callbacks = { onOpenLinkMenu: vi.fn(), onBookmarkContextMenu: vi.fn(() => false) };
  body.addEventListener('contextmenu', createDocumentContextMenuHandler({ body, filePath: '/doc.md', callbacks: callbacks as any }));
  return { body, callbacks };
}

function rightClick(el: Element) {
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
}

afterEach(() => { document.body.innerHTML = ''; });

describe('document context menu media routing', () => {
  it('does not open the image menu for the copy-code button icon', () => {
    const { body, callbacks } = setup();
    rightClick(body.querySelector('.mdn-copy-btn svg path')!);
    rightClick(body.querySelector('.mdn-copy-btn svg')!);
    expect(callbacks.onOpenLinkMenu).not.toHaveBeenCalled();
  });

  it('does not treat a loose inline svg as an image target', () => {
    const { body, callbacks } = setup();
    rightClick(body.querySelector('.loose-icon path')!);
    expect(callbacks.onOpenLinkMenu).not.toHaveBeenCalled();
  });

  it('opens the image menu for mermaid diagrams and images', () => {
    const { body, callbacks } = setup();
    rightClick(body.querySelector('.diagram text')!);
    expect(callbacks.onOpenLinkMenu).toHaveBeenLastCalledWith(expect.objectContaining({ imageTarget: body.querySelector('.mdn-mermaid-wrap') }));
    rightClick(body.querySelector('.pic')!);
    expect(callbacks.onOpenLinkMenu).toHaveBeenLastCalledWith(expect.objectContaining({ imageTarget: body.querySelector('.pic') }));
  });
});
