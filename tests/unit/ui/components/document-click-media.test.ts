import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentClickHandler } from '../../../../ui/src/components/Content/documentClickHandler';
import { attachContentScrollHandler, buildRenderedDocumentSnapshot, injectBaseHref, syncStickyTableHeaders } from '../../../../ui/src/components/Content/contentUtils';
import { createContentEnhancementScheduler } from '../../../../ui/src/components/Content/contentEnhancementScheduler';
import { CONTENT_ENHANCEMENT_RETRY_DELAYS_MS } from '../../../../ui/src/constants/limits';

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

function setup({ appRuntime = 'vscode', bridge = {} }: { appRuntime?: 'vscode' | null; bridge?: object } = {}) {
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
  const expandAncestors = vi.fn();
  const handler = createDocumentClickHandler({
    body,
    filePath: '/doc.md',
    appRuntime: appRuntime ?? undefined,
    bridge,
    previewLabels: { openError: 'err', modalTitle: 'm' } as any,
    headingSections: { expandAncestors } as any,
    callbacks: callbacks as any,
  });
  body.addEventListener('click', handler);
  return { body, callbacks, handler, expandAncestors };
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

  it('uses the desktop browser bridge by default and reports missing or unopenable HTML', () => {
    const postMessage = vi.fn().mockImplementationOnce(() => { throw new Error('Unavailable'); });
    const { body, callbacks, handler } = setup({ appRuntime: null, bridge: { postMessage } });
    body.innerHTML = `
      <button class="mdn-open-browser-btn">Missing browser data</button>
      <button class="mdn-open-modal-btn">Missing modal data</button>
      <div class="mdn-html-preview-wrap"><iframe class="mdn-html-preview-iframe" srcdoc="<p>Preview</p>"></iframe>
      <button class="mdn-open-browser-btn">Browser</button></div>
    `;
    handler(new Event('click'));
    click(body.children[0]);
    click(body.children[1]);
    expect(callbacks.onActionError).toHaveBeenCalledTimes(2);
    expect(postMessage).not.toHaveBeenCalled();
    const button = body.querySelector('.mdn-html-preview-wrap button')!;
    button.firstChild!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(postMessage).toHaveBeenCalledWith({ command: 'openHtmlPreview', documentHtml: expect.stringContaining('<p>Preview</p>') });
    expect(callbacks.onActionError).toHaveBeenLastCalledWith('err');
    expect(callbacks.onActionError).toHaveBeenCalledTimes(3);
  });

  it('ignores incomplete table controls and scrolls to a real fragment without animation in reduced-motion mode', () => {
    const { body, expandAncestors } = setup();
    const toggleViewDropdown = vi.fn();
    const switchView = vi.fn();
    vi.stubGlobal('Table', { toggleViewDropdown, switchView });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    try {
      body.innerHTML = `
        <div class="mdn-table-view-dropdown"><button class="mdn-table-view-select">No ID</button></div>
        <div class="mdn-table-view-dropdown" id="sales-view-dropdown"><button class="mdn-table-view-menu__option">No value</button></div>
        <a href="#absent">Absent section</a><a href="#present">Present section</a><h2 id="present">Present</h2>
      `;
      const heading = body.querySelector('h2')!;
      const scrollIntoView = vi.fn();
      heading.scrollIntoView = scrollIntoView;
      click(body.querySelector('.mdn-table-view-select')!);
      click(body.querySelector('.mdn-table-view-menu__option')!);
      click(body.querySelector('a')!);
      expect(toggleViewDropdown).not.toHaveBeenCalled();
      expect(switchView).not.toHaveBeenCalled();
      expect(expandAncestors).not.toHaveBeenCalled();
      click(body.querySelector('a[href="#present"]')!);
      expect(expandAncestors).toHaveBeenCalledWith(heading);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('content DOM utilities', () => {
  it('preserves markup without a base, adds one to headless markup, and escapes document titles', () => {
    expect(injectBaseHref('<p>Body</p>', '  ')).toBe('<p>Body</p>');
    expect(injectBaseHref('<p>Body</p>', 'file:///a"b/')).toBe('<base href="file:///a&quot;b/"><p>Body</p>');
    const snapshot = buildRenderedDocumentSnapshot('<p>Body</p>', 'A & <B> "C" \'D\'', null, 'not-a-fragment');
    expect(snapshot).toContain('<title>A &amp; &lt;B&gt; &quot;C&quot; &#39;D&#39;</title>');
    expect(snapshot).not.toContain('not-a-fragment');
  });

  it('accounts for a file-change notice when placing sticky headers and supports a missing scroll container', () => {
    const onScroll = vi.fn();
    expect(attachContentScrollHandler(null, onScroll)).toBeNull();
    expect(() => syncStickyTableHeaders(null)).not.toThrow();
    const container = document.createElement('div');
    container.style.paddingBottom = 'auto';
    container.innerHTML = '<div class="current-file-change-notice"></div><table class="mdn-table"></table>';
    vi.spyOn(container.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 42, height: 42 } as DOMRect);
    syncStickyTableHeaders(container);
    expect(container.style.getPropertyValue('--mdn-sticky-top-offset')).toBe('42px');
    expect(container.style.getPropertyValue('--mdn-sticky-bottom-offset')).toMatch(/^-?0px$/);
  });
});

describe('content enhancement scheduler', () => {
  function createScheduler(body: HTMLElement, pending = () => true) {
    let handle = 0;
    const frames = new Map<number, FrameRequestCallback>();
    const delays = new Map<number, () => void>();
    const run = vi.fn(async () => {});
    const onSettled = vi.fn();
    const clearDelay = vi.fn((id: number) => delays.delete(id));
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    let notify: MutationCallback;
    const setDelay = vi.fn((callback: () => void, _ms: number) => {
      delays.set(++handle, callback);
      return handle;
    });
    const scheduler = createContentEnhancementScheduler({
      body, hasPending: pending, run, onSettled, setDelay, clearDelay,
      requestFrame: (callback) => { frames.set(++handle, callback); return handle; },
      cancelFrame: (id) => { frames.delete(id); },
      createObserver: (callback) => { notify = callback; return observer; },
    });
    return { ...scheduler, run, onSettled, frames, delays, setDelay, clearDelay,
      notify: () => notify([{ type: 'childList' } as MutationRecord], observer as unknown as MutationObserver),
    };
  }

  it('runs the entire retry budget once and resets the backoff on a child mutation', async () => {
    const body = document.body.appendChild(document.createElement('div'));
    const scheduler = createScheduler(body);
    async function runFrame() {
      const [id, callback] = [...scheduler.frames.entries()][0];
      scheduler.frames.delete(id);
      callback(0);
      await Promise.resolve();
    }
    await runFrame();
    for (const ms of CONTENT_ENHANCEMENT_RETRY_DELAYS_MS) {
      expect(scheduler.setDelay).toHaveBeenLastCalledWith(expect.any(Function), ms);
      const [id, callback] = [...scheduler.delays.entries()][0];
      scheduler.delays.delete(id);
      callback();
      await runFrame();
    }
    expect(scheduler.onSettled).toHaveBeenCalledTimes(6);
    expect(scheduler.delays.size).toBe(0);
    scheduler.notify();
    await runFrame();
    expect(scheduler.setDelay).toHaveBeenLastCalledWith(expect.any(Function), 60);
    scheduler.dispose();
    expect(scheduler.clearDelay).toHaveBeenCalledOnce();
    scheduler.notify();
    scheduler.requestRun();
    expect(scheduler.frames.size).toBe(0);
  });

  it('drops queued work for a detached document instead of producing a settled event', async () => {
    const body = document.body.appendChild(document.createElement('div'));
    const scheduler = createScheduler(body);
    body.remove();
    const callback = [...scheduler.frames.values()][0];
    callback(0);
    await Promise.resolve();
    expect(scheduler.run).not.toHaveBeenCalled();
    expect(scheduler.onSettled).not.toHaveBeenCalled();
    scheduler.dispose();
  });
});
