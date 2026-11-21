import { describe, expect, it, vi } from 'vitest';
import {
  enhanceMermaidLazily,
  renderMermaidNodesLazily,
  resolveMermaidViewport,
  runInMermaidRenderLane,
} from '../../../../ui/src/components/Content/enhancements/mermaidLazyRendering';
import {
  clearMermaidSvgCache,
  getCachedMermaidSvg,
  mermaidCacheKey,
} from '../../../../ui/src/components/Content/enhancements/mermaidSvgCache';
import {
  isMermaidNodeHidden,
  type MermaidQueueScheduler,
} from '../../../../ui/src/components/Content/enhancements/mermaidRerenderQueue';

const rectOf = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) as DOMRect });
const win = { innerHeight: 800 };

function manualScheduler() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const scheduler: MermaidQueueScheduler = {
    requestIdle: (callback) => { const id = next++; pending.set(id, callback); return id; },
    cancelIdle: (id) => { pending.delete(id); },
    requestFrame: (callback) => { const id = next++; pending.set(id, callback); return id; },
    cancelFrame: (id) => { pending.delete(id); },
  };
  const flush = async () => {
    for (let i = 0; i < 50; i += 1) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (pending.size === 0) return;
    }
  };
  return { scheduler, pending, flush };
}

function node(id: string, top: number): HTMLElement {
  const element = document.createElement('div');
  element.id = id;
  element.getBoundingClientRect = () => ({ top, bottom: top + 50 }) as DOMRect;
  return element;
}

describe('resolveMermaidViewport', () => {
  it('uses the visible part of the document root scroll container', () => {
    expect(resolveMermaidViewport(rectOf(100, 400), win)).toEqual({ top: 100, bottom: 400, nearDistance: 300 });
    expect(resolveMermaidViewport(rectOf(-50, 2000), win)).toEqual({ top: 0, bottom: 800, nearDistance: 800 });
  });

  it('falls back to the window when there is no usable scroll container', () => {
    expect(resolveMermaidViewport(null, win)).toEqual({ top: 0, bottom: 800, nearDistance: 800 });
    expect(resolveMermaidViewport(rectOf(0, 0), win)).toEqual({ top: 0, bottom: 800, nearDistance: 800 });
  });
});

describe('renderMermaidNodesLazily', () => {
  it('renders nothing synchronously and orders diagrams by the root scroll container', async () => {
    const { scheduler, flush } = manualScheduler();
    const rendered: string[] = [];
    const done = renderMermaidNodesLazily(
      [node('clipped', 450), node('visible', 120)],
      async (element) => { rendered.push(element.id); },
      { scroll: rectOf(100, 300), isCancelled: () => false, scheduler },
    );
    expect(rendered).toEqual([]);
    await flush();
    await done;
    expect(rendered).toEqual(['visible', 'clipped']);
  });

  it('stops and resolves once the owner is cancelled', async () => {
    const { scheduler, flush } = manualScheduler();
    let cancelled = false;
    const rendered: string[] = [];
    const done = renderMermaidNodesLazily(
      [node('a', 0), node('b', 10), node('c', 20)],
      async (element) => { rendered.push(element.id); cancelled = true; },
      { isCancelled: () => cancelled, scheduler },
    );
    await flush();
    await done;
    expect(rendered).toEqual(['a']);
  });

  it('resolves immediately when there is nothing to render', async () => {
    await expect(renderMermaidNodesLazily([], async () => {}, { isCancelled: () => false })).resolves.toBeUndefined();
  });
});

describe('runInMermaidRenderLane', () => {
  it('never runs two diagram renders at the same time, even after a failure', async () => {
    let active = 0;
    let peak = 0;
    const task = (fail = false) => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      if (fail) throw new Error('render failed');
    };
    await Promise.allSettled([runInMermaidRenderLane(task(true)), runInMermaidRenderLane(task()), runInMermaidRenderLane(task())]);
    expect(peak).toBe(1);
  });
});

describe('isMermaidNodeHidden', () => {
  it('detects collapsed sections, nested collapsed ancestors, closed details, hidden attributes, and display:none', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <section class="mdn-section" data-expanded="false">
        <div class="mdn-section-body"><div class="mermaid" id="m-collapsed">graph TD; A-->B</div></div>
      </section>
      <section class="mdn-section" data-expanded="true">
        <div class="mdn-section-body"><div class="mermaid" id="m-expanded">graph TD; A-->B</div></div>
      </section>
      <section class="mdn-section" data-expanded="false">
        <div class="mdn-section-body">
          <section class="mdn-section" data-expanded="true">
            <div class="mdn-section-body"><div class="mermaid" id="m-nested">graph TD; A-->B</div></div>
          </section>
        </div>
      </section>
      <details id="d-closed"><summary>Sum</summary><div class="mermaid" id="m-details-closed">graph TD; A-->B</div></details>
      <details id="d-open" open><summary>Sum</summary><div class="mermaid" id="m-details-open">graph TD; A-->B</div></details>
      <div hidden><div class="mermaid" id="m-hidden">graph TD; A-->B</div></div>
      <div style="display: none"><div class="mermaid" id="m-display-none">graph TD; A-->B</div></div>
    `;
    document.body.appendChild(container);
    try {
      expect(isMermaidNodeHidden(document.getElementById('m-collapsed'))).toBe(true);
      expect(isMermaidNodeHidden(document.getElementById('m-expanded'))).toBe(false);
      expect(isMermaidNodeHidden(document.getElementById('m-nested'))).toBe(true);
      expect(isMermaidNodeHidden(document.getElementById('m-details-closed'))).toBe(true);
      expect(isMermaidNodeHidden(document.getElementById('m-details-open'))).toBe(false);
      expect(isMermaidNodeHidden(document.getElementById('m-hidden'))).toBe(true);
      expect(isMermaidNodeHidden(document.getElementById('m-display-none'))).toBe(true);
    } finally {
      container.remove();
    }
  });

  it('skips hidden diagrams during lazy enhancement and renders + caches only once expanded', async () => {
    clearMermaidSvgCache();
    const { scheduler, flush } = manualScheduler();
    const root = document.createElement('div');
    root.innerHTML = `
      <section class="mdn-section" data-expanded="false" id="sec-1">
        <div class="mdn-section-body">
          <div class="mdn-mermaid-wrap"><div class="mermaid" id="diag-1">block-beta\n  a["Hello"]</div></div>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    const run = vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
      for (const el of nodes) {
        el.innerHTML = '<svg viewBox="0 0 10 10"><g></g></svg>';
      }
    });
    const options = {
      getLibrary: async () => ({ initialize: vi.fn(), run }),
      isDark: false,
      isCancelled: () => false,
      runIdRef: { current: 0 },
      cacheSignature: 'sig-light',
    };

    try {
      await enhanceMermaidLazily(root, options, { scheduler });
      expect(run).not.toHaveBeenCalled();
      const diag = document.getElementById('diag-1')!;
      expect(diag.dataset.mdnRendered).toBeUndefined();
      expect(getCachedMermaidSvg(mermaidCacheKey('block-beta\n  a["Hello"]', 'sig-light'))).toBeUndefined();

      document.getElementById('sec-1')!.dataset.expanded = 'true';
      const pending = enhanceMermaidLazily(root, options, { scheduler });
      await flush();
      await pending;

      expect(run).toHaveBeenCalledTimes(1);
      expect(diag.dataset.mdnRendered).toBe('true');
      expect(getCachedMermaidSvg(mermaidCacheKey('block-beta\n  a["Hello"]', 'sig-light'))).toBe('<svg viewBox="0 0 10 10"><g></g></svg>');
    } finally {
      clearMermaidSvgCache();
      root.remove();
    }
  });
});
