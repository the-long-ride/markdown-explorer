interface MermaidLibrary {
  initialize(options: Record<string, unknown>): void;
  run?(options: { nodes: HTMLElement[] }): Promise<void>;
}

export interface MermaidOptions {
  getLibrary: () => Promise<MermaidLibrary>;
  isDark: boolean;
  isCancelled: () => boolean;
  runIdRef: { current: number };
}

const MERMAID_SELECTOR = '.mermaid:not([data-mdn-rendered]):not([data-mdn-render-error])';
const MAX_RENDER_ATTEMPTS = 2;

function getPendingNodes(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(MERMAID_SELECTOR)]
    .filter((element) => !element.dataset.mdnRendered);
}

export async function enhanceMermaid(
  root: ParentNode,
  options: MermaidOptions,
): Promise<void> {
  if (getPendingNodes(root).length === 0) return;

  const mermaid = await options.getLibrary();
  if (options.isCancelled()) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'var(--font-mono)',
    theme: options.isDark ? 'dark' : 'default',
  });

  if (typeof mermaid.run !== 'function') return;
  const runId = ++options.runIdRef.current;
  const nodes = getPendingNodes(root);

  for (const node of nodes) {
    if (options.isCancelled() || runId !== options.runIdRef.current) return;

    if (!node.dataset.originalCode) {
      node.dataset.originalCode = node.textContent || '';
    }
    if (node.querySelector('svg')) {
      node.dataset.mdnRendered = 'true';
      delete node.dataset.mdnRenderAttempts;
      delete node.dataset.mdnRenderError;
      continue;
    }

    node.removeAttribute('data-processed');
    try {
      await mermaid.run({ nodes: [node] });
      if (!node.querySelector('svg')) {
        throw new Error('Mermaid completed without producing an SVG');
      }
      node.dataset.mdnRendered = 'true';
      delete node.dataset.mdnRenderAttempts;
      delete node.dataset.mdnRenderError;
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      });
    } catch (error) {
      const originalCode = node.dataset.originalCode || '';
      if (!node.querySelector('svg') && node.textContent !== originalCode) {
        node.textContent = originalCode;
      }
      node.removeAttribute('data-processed');
      const attempts = Number.parseInt(node.dataset.mdnRenderAttempts || '0', 10) + 1;
      node.dataset.mdnRenderAttempts = String(attempts);
      if (attempts >= MAX_RENDER_ATTEMPTS) {
        node.dataset.mdnRenderError = 'true';
      }
      console.error('Mermaid diagram render error:', error);
    }
  }
}
