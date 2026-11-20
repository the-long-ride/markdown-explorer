import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { installMermaidContentLifecycle } from '../../../../ui/src/components/Content/mermaidContentLifecycle';
import { scheduleContentEnhancements } from '../../../../ui/src/components/Content/scheduleContentEnhancements';
import { clearMermaidSvgCache } from '../../../../ui/src/components/Content/enhancements/mermaidSvgCache';

const renderState = vi.hoisted(() => ({
  calls: [] as Array<{ id: string; isHidden: boolean; markup: string }>,
}));

vi.mock('../../../../ui/src/lib/renderLibs', () => ({
  getMermaid: async () => ({
    initialize: vi.fn(),
    run: async ({ nodes }: { nodes: HTMLElement[] }) => {
      for (const node of nodes) {
        const section = node.closest('.mdn-section') as HTMLElement | null;
        const isHidden = !section || section.dataset.expanded !== 'true';
        const svgMarkup = isHidden
          ? '<svg viewBox="0 0 0 0"><g></g></svg>'
          : '<svg viewBox="0 0 120 40"><g><text>Rendered Label</text></g></svg>';
        renderState.calls.push({ id: node.id, isHidden, markup: node.textContent || '' });
        node.innerHTML = svgMarkup;
      }
    },
  }),
  getHighlightJs: async () => ({ highlightElement: vi.fn() }),
  getKatex: async () => ({ render: vi.fn() }),
  getChart: async () => ({}),
}));

async function flushAsync(ms = 40) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for diagram condition');
    }
    await flushAsync(20);
  }
}

describe('collapsed sections + theme toggle Mermaid rerender', () => {
  afterEach(() => {
    clearMermaidSvgCache();
    renderState.calls.length = 0;
    document.body.innerHTML = '';
  });

  it('invalidates collapsed diagrams on theme switch without rendering them until sections expand', async () => {
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.innerHTML = `
      <section class="mdn-section" id="sec-flow" data-expanded="true">
        <div class="mdn-section-body">
          <div class="mdn-mermaid-wrap"><div class="mermaid" id="diag-flow">flowchart LR\n  A-->B</div></div>
        </div>
      </section>
      <section class="mdn-section" id="sec-block" data-expanded="true">
        <div class="mdn-section-body">
          <div class="mdn-mermaid-wrap"><div class="mermaid" id="diag-block">block-beta\n  columns 1\n  A["Markdown Source"]</div></div>
        </div>
      </section>
    `;
    document.body.appendChild(body);

    const scrollRef = createRef<HTMLDivElement>();
    const runIdRef = { current: 0 };
    const previousAppearanceKeyRef = { current: null as string | null };

    const mountLifecycle = (theme: 'dark' | 'light') => {
      const state = {
        theme,
        themeStyle: 'default',
        settings: { activeCustomThemeId: null, customThemes: [], fontBindings: {} },
      };
      const startEnhancements = () => scheduleContentEnhancements({
        body,
        state,
        scrollRef,
        handleScroll: () => {},
        mermaidRunIdRef: runIdRef,
      });
      return installMermaidContentLifecycle({
        body,
        state,
        previousAppearanceKeyRef,
        runIdRef,
        startEnhancements,
      });
    };

    const diagFlow = document.getElementById('diag-flow')!;
    const diagBlock = document.getElementById('diag-block')!;
    const secFlow = document.getElementById('sec-flow')!;
    const secBlock = document.getElementById('sec-block')!;

    // 1. Expand all -> initial render in dark mode renders both diagrams
    let dispose = mountLifecycle('dark');
    await waitUntil(() => diagFlow.dataset.mdnRendered === 'true' && diagBlock.dataset.mdnRendered === 'true');
    expect(renderState.calls.map((c) => c.id)).toEqual(['diag-flow', 'diag-block']);
    expect(renderState.calls.every((c) => !c.isHidden)).toBe(true);

    // 2. Collapse all sections and toggle dark -> light mode
    secFlow.dataset.expanded = 'false';
    secBlock.dataset.expanded = 'false';
    await flushAsync(30);

    renderState.calls.length = 0;
    dispose();
    dispose = mountLifecycle('light');

    // Wait past debounce (160ms) + idle timeout (600ms) for invalidation & queue settling
    await waitUntil(() => !diagFlow.dataset.mdnRendered && !diagBlock.dataset.mdnRendered);
    await flushAsync(200);

    // Collapsed diagrams MUST be invalidated (raw source restored) without calling mermaid.run while hidden
    expect(renderState.calls).toEqual([]);
    expect(diagFlow.querySelector('svg')).toBeNull();
    expect(diagBlock.querySelector('svg')).toBeNull();
    expect(diagBlock.textContent).toContain('Markdown Source');

    // 3. Expand sec-flow -> ONLY diag-flow renders visibly; diag-block remains unrendered
    secFlow.dataset.expanded = 'true';
    await waitUntil(() => diagFlow.dataset.mdnRendered === 'true');
    expect(renderState.calls.map((c) => c.id)).toEqual(['diag-flow']);
    expect(renderState.calls[0].isHidden).toBe(false);
    expect(diagBlock.dataset.mdnRendered).toBeUndefined();

    // 4. Expand sec-block -> diag-block now renders visibly with full geometry (not 0x0)
    secBlock.dataset.expanded = 'true';
    await waitUntil(() => diagBlock.dataset.mdnRendered === 'true');
    expect(renderState.calls.map((c) => c.id)).toEqual(['diag-flow', 'diag-block']);
    expect(renderState.calls[1].isHidden).toBe(false);
    expect(diagBlock.querySelector('svg')?.getAttribute('viewBox')).not.toBe('0 0 0 0');

    dispose();
  });
});
