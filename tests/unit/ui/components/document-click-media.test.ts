import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentClickHandler } from '../../../../ui/src/components/Content/documentClickHandler';

const COPY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4"/></svg>';

const HTML = `
  <div class="mdn-mermaid-wrap"><div class="mermaid"><svg class="diagram"><g><text>A</text></g></svg></div></div>
  <div class="mdn-codeblock">
    <div class="mdn-codeblock-header">
      <button class="mdn-copy-btn">${COPY_ICON}</button>
    </div>
    <pre class="mdn-code-source"><code>const x = 1;</code></pre>
  </div>
  <p>Inline <svg class="loose-icon"><path d="M0 0"/></svg> icon</p>`;

function setup() {
  const body = document.createElement('div');
  body.className = 'mdn-body';
  body.innerHTML = HTML;
  document.body.appendChild(body);
  const callbacks = {
    onImageClick: vi.fn(),
    navigate: vi.fn(),
    onOpenHtmlModal: vi.fn(),
    onOpenLinkMenu: vi.fn(),
    onBookmarkContextMenu: vi.fn(),
    onActionError: vi.fn(),
  };
  const handler = createDocumentClickHandler({
    body,
    filePath: '/doc.md',
    appRuntime: 'vscode' as any,
    bridge: {},
    previewLabels: { openError: 'err', modalTitle: 'm' } as any,
    headingSections: { expandAncestors: vi.fn() } as any,
    callbacks: callbacks as any,
  });
  body.addEventListener('click', handler);
  return { body, callbacks };
}

function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

afterEach(() => { document.body.innerHTML = ''; });

describe('document click handler media routing', () => {
  it('does not open the media viewer when clicking the copy-code button icon', () => {
    const { body, callbacks } = setup();
    click(body.querySelector('.mdn-copy-btn svg path')!);
    click(body.querySelector('.mdn-copy-btn svg')!);
    click(body.querySelector('.mdn-copy-btn')!);
    expect(callbacks.onImageClick).not.toHaveBeenCalled();
  });

  it('does not treat a loose inline svg as a media item', () => {
    const { body, callbacks } = setup();
    click(body.querySelector('.loose-icon path')!);
    expect(callbacks.onImageClick).not.toHaveBeenCalled();
  });

  it('still opens the viewer for mermaid diagrams', () => {
    const { body, callbacks } = setup();
    click(body.querySelector('.diagram text')!);
    expect(callbacks.onImageClick).toHaveBeenCalledWith(body.querySelector('.mdn-mermaid-wrap'));
  });
});
