import { enhanceMermaid, type MermaidOptions } from './mermaidRendering.ts';
import {
  getCachedMermaidSvg,
  isCacheableMermaidSource,
  mermaidCacheKey,
  resolveMermaidCacheSignature,
  setCachedMermaidSvg,
} from './mermaidSvgCache.ts';
import {
  createMermaidRerenderQueue,
  type MermaidQueueScheduler,
  type MermaidViewport,
} from './mermaidRerenderQueue.ts';

// Lazy, one-by-one Mermaid rendering shared by every document root (main view,
// split panes, scope view). Each root orders its diagrams against its own
// scroll container, and all roots share one render lane so two panes never
// render diagrams at the same time (mermaid.initialize is global state).

type ViewportElement = Pick<Element, 'getBoundingClientRect'>;

interface ViewportWindow {
  innerHeight?: number;
  document?: { documentElement?: { clientHeight?: number } };
}

function windowHeight(win: ViewportWindow | undefined): number {
  return Math.max(1, win?.innerHeight || win?.document?.documentElement?.clientHeight || 1);
}

export function resolveMermaidViewport(
  scroll: ViewportElement | null | undefined,
  win: ViewportWindow | undefined = typeof window === 'undefined' ? undefined : window,
): MermaidViewport {
  const height = windowHeight(win);
  if (!scroll || typeof scroll.getBoundingClientRect !== 'function') {
    return { top: 0, bottom: height, nearDistance: height };
  }
  const rect = scroll.getBoundingClientRect();
  const top = Math.max(0, rect.top);
  const bottom = Math.min(height, rect.bottom);
  if (!(bottom > top)) return { top: 0, bottom: height, nearDistance: height };
  return { top, bottom, nearDistance: bottom - top };
}

let lane: Promise<void> = Promise.resolve();

export function runInMermaidRenderLane(task: () => Promise<void>): Promise<void> {
  const run = lane.then(task, task);
  lane = run.then(() => undefined, () => undefined);
  return run;
}

export interface LazyMermaidRenderOptions {
  scroll?: ViewportElement | null;
  isCancelled: () => boolean;
  scheduler?: MermaidQueueScheduler;
}

type RenderableNode = HTMLElement;

// Renders the given nodes one at a time, visible diagrams first, yielding to the
// browser between diagrams. Resolves when every node was processed or the
// caller cancelled.
export function renderMermaidNodesLazily(
  nodes: readonly RenderableNode[],
  renderNode: (node: RenderableNode, isCancelled: () => boolean) => Promise<void>,
  options: LazyMermaidRenderOptions,
): Promise<void> {
  if (nodes.length === 0 || options.isCancelled()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const queue = createMermaidRerenderQueue<RenderableNode>(async (node, queueCancelled) => {
      const cancelled = () => options.isCancelled() || queueCancelled();
      if (cancelled()) {
        queue.cancel();
        finish();
        return;
      }
      await runInMermaidRenderLane(() => (cancelled() ? Promise.resolve() : renderNode(node, cancelled)));
      if (options.isCancelled()) {
        queue.cancel();
        finish();
      }
    }, options.scheduler, {
      viewport: () => resolveMermaidViewport(options.scroll),
      onComplete: finish,
    });
    queue.start(nodes);
  });
}

const PENDING_MERMAID_SELECTOR = '.mermaid:not([data-mdn-rendered]):not([data-mdn-render-error]):not([data-mdn-rerender-queued])';

// Initial (non-theme) render of a document root's pending diagrams. Diagrams
// already in the SVG cache are inserted first in one lane slot (enhanceMermaid
// prepares nodes that already hold an SVG); the rest render lazily and feed the
// cache with the raw markup mermaid produced.
export async function enhanceMermaidLazily(
  root: ParentNode,
  options: Omit<MermaidOptions, 'nodes'>,
  lazy: Omit<LazyMermaidRenderOptions, 'isCancelled'> = {},
): Promise<void> {
  const doc = options.document ?? (typeof document === 'undefined' ? undefined : document);
  const signature = options.cacheSignature ?? resolveMermaidCacheSignature(doc, options.isDark);
  const hits: HTMLElement[] = [];
  const misses: HTMLElement[] = [];
  for (const node of root.querySelectorAll<HTMLElement>(PENDING_MERMAID_SELECTOR)) {
    if (!node.dataset.originalCode) node.dataset.originalCode = node.textContent || '';
    const source = node.dataset.originalCode;
    const cached = isCacheableMermaidSource(source) ? getCachedMermaidSvg(mermaidCacheKey(source, signature)) : undefined;
    if (cached && !node.querySelector('svg')) {
      node.innerHTML = cached;
      hits.push(node);
    } else {
      misses.push(node);
    }
  }
  if (hits.length > 0 && !options.isCancelled()) {
    await runInMermaidRenderLane(() => enhanceMermaid(root, { ...options, nodes: hits }));
  }
  const onRawSvg = (node: HTMLElement, source: string, svg: string) => {
    if (isCacheableMermaidSource(source)) setCachedMermaidSvg(mermaidCacheKey(source, signature), svg);
    options.onRawSvg?.(node, source, svg);
  };
  return renderMermaidNodesLazily(misses, (node, isCancelled) => enhanceMermaid(root, {
    ...options,
    onRawSvg,
    isCancelled,
    nodes: [node],
  }), { ...lazy, isCancelled: options.isCancelled });
}
