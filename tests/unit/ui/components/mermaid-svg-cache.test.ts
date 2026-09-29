import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearMermaidSvgCache,
  getCachedMermaidSvg,
  isCacheableMermaidSource,
  mermaidCacheKey,
  MERMAID_SVG_CACHE_LIMIT,
  resolveMermaidCacheSignature,
  setCachedMermaidSvg,
} from '../../../../ui/src/components/Content/enhancements/mermaidSvgCache';
import { enhanceMermaidLazily } from '../../../../ui/src/components/Content/enhancements/mermaidLazyRendering';
import type { MermaidOptions } from '../../../../ui/src/components/Content/enhancements/mermaidRendering';

afterEach(() => {
  clearMermaidSvgCache();
  document.documentElement.removeAttribute('style');
});

type LazyOptions = Omit<MermaidOptions, 'nodes'>;
type Library = Awaited<ReturnType<MermaidOptions['getLibrary']>>;

function mountDiagram(source: string): { root: HTMLElement; node: HTMLElement } {
  const root = document.createElement('div');
  root.innerHTML = '<div class="mdn-mermaid-wrap"><div class="mermaid"></div></div>';
  const node = root.querySelector<HTMLElement>('.mermaid')!;
  node.textContent = source;
  document.body.appendChild(root);
  return { root, node };
}

function lazyOptions(library: unknown, cacheSignature?: string): LazyOptions {
  return {
    getLibrary: async () => library as Library,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    isDark: false,
    cacheSignature,
  };
}

const immediateScheduler = {
  requestIdle: (callback: () => void) => setTimeout(callback, 0) as unknown as number,
  cancelIdle: (id: number) => clearTimeout(id),
  requestFrame: (callback: () => void) => setTimeout(callback, 0) as unknown as number,
  cancelFrame: (id: number) => clearTimeout(id),
};

describe('mermaidSvgCache', () => {
  it('keys on source and theme signature', () => {
    expect(mermaidCacheKey('graph TD; A-->B', 'dark')).not.toBe(mermaidCacheKey('graph TD; A-->B', 'light'));
    expect(mermaidCacheKey('graph TD; A-->B', 'dark')).toBe(mermaidCacheKey('graph TD; A-->B', 'dark'));
    expect(mermaidCacheKey('graph TD; A-->C', 'dark')).not.toBe(mermaidCacheKey('graph TD; A-->B', 'dark'));
  });

  it('evicts the least recently used entry past the limit', () => {
    for (let i = 0; i <= MERMAID_SVG_CACHE_LIMIT; i += 1) setCachedMermaidSvg(`k${i}`, `<svg>${i}</svg>`);
    expect(getCachedMermaidSvg('k0')).toBeUndefined();
    expect(getCachedMermaidSvg(`k${MERMAID_SVG_CACHE_LIMIT}`)).toBe(`<svg>${MERMAID_SVG_CACHE_LIMIT}</svg>`);
  });

  it('refreshes recency on read so a hot entry survives eviction', () => {
    for (let i = 0; i < MERMAID_SVG_CACHE_LIMIT; i += 1) setCachedMermaidSvg(`k${i}`, `<svg>${i}</svg>`);
    expect(getCachedMermaidSvg('k0')).toBe('<svg>0</svg>');
    setCachedMermaidSvg('extra', '<svg>extra</svg>');
    expect(getCachedMermaidSvg('k0')).toBe('<svg>0</svg>');
    expect(getCachedMermaidSvg('k1')).toBeUndefined();
  });

  it('does not cache width-dependent diagram kinds', () => {
    expect(isCacheableMermaidSource('gantt\n title x')).toBe(false);
    expect(isCacheableMermaidSource('sankey-beta\n a,b,1')).toBe(false);
    expect(isCacheableMermaidSource('graph TD; A-->B')).toBe(true);
  });

  it('changes the signature when the theme mode or theme variables change', () => {
    const light = resolveMermaidCacheSignature(document, false);
    expect(resolveMermaidCacheSignature(document, true)).not.toBe(light);
    document.documentElement.style.setProperty('--accent', '#ff00aa');
    expect(resolveMermaidCacheSignature(document, false)).not.toBe(light);
  });

  it('renders a cached diagram without calling mermaid.run', async () => {
    const { root, node } = mountDiagram('graph TD; A-->B');
    const run = vi.fn();
    const library = { initialize: vi.fn(), run };
    setCachedMermaidSvg(mermaidCacheKey('graph TD; A-->B', 'light'), '<svg viewBox="0 0 10 10"></svg>');
    await enhanceMermaidLazily(root, lazyOptions(library, 'light'));
    expect(run).not.toHaveBeenCalled();
    expect(node.querySelector('svg')).not.toBeNull();
    expect(node.dataset.mdnRendered).toBe('true');
    expect(node.dataset.originalCode).toBe('graph TD; A-->B');
    root.remove();
  });

  it('stores the raw svg of a freshly rendered diagram, but not for gantt', async () => {
    const run = vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
      nodes.forEach((target) => { target.innerHTML = '<svg viewBox="0 0 10 10"><g></g></svg>'; });
    });
    const library = { initialize: vi.fn(), run };
    const flow = mountDiagram('graph TD; A-->B');
    const gantt = mountDiagram('gantt\n title x');
    await enhanceMermaidLazily(flow.root, lazyOptions(library, 'light'), { scheduler: immediateScheduler });
    await enhanceMermaidLazily(gantt.root, lazyOptions(library, 'light'), { scheduler: immediateScheduler });
    expect(run).toHaveBeenCalledTimes(2);
    expect(flow.node.dataset.mdnRendered).toBe('true');
    expect(getCachedMermaidSvg(mermaidCacheKey('graph TD; A-->B', 'light'))).toBe('<svg viewBox="0 0 10 10"><g></g></svg>');
    expect(getCachedMermaidSvg(mermaidCacheKey('gantt\n title x', 'light'))).toBeUndefined();

    const again = mountDiagram('graph TD; A-->B');
    await enhanceMermaidLazily(again.root, lazyOptions(library, 'light'), { scheduler: immediateScheduler });
    expect(run).toHaveBeenCalledTimes(2);
    expect(again.node.dataset.mdnRendered).toBe('true');

    const otherTheme = mountDiagram('graph TD; A-->B');
    await enhanceMermaidLazily(otherTheme.root, lazyOptions(library, 'dark'), { scheduler: immediateScheduler });
    expect(run).toHaveBeenCalledTimes(3);
    [flow, gantt, again, otherTheme].forEach(({ root }) => root.remove());
  });
});
