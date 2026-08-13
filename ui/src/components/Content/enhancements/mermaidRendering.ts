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
const MERMAID_VIEWBOX_PADDING = 12;

export function fitMermaidSvg(svg: SVGSVGElement, padding = MERMAID_VIEWBOX_PADDING): void {
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  if (svg.style) {
    svg.style.display = 'block';
    svg.style.width = 'auto';
    svg.style.height = 'auto';
    svg.style.maxWidth = '100%';
    svg.style.marginInline = 'auto';
  }

  try {
    const graphics = typeof svg.querySelector === 'function'
      ? svg.querySelector<SVGGElement>('g') ?? svg
      : svg;
    if (typeof graphics.getBBox !== 'function') return;
    const box = graphics.getBBox();
    if (
      Number.isFinite(box.x) && Number.isFinite(box.y) &&
      Number.isFinite(box.width) && Number.isFinite(box.height) &&
      box.width > 0 && box.height > 0
    ) {
      const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : MERMAID_VIEWBOX_PADDING;
      const fittedWidth = box.width + safePadding * 2;
      const fittedHeight = box.height + safePadding * 2;
      svg.setAttribute(
        'viewBox',
        `${box.x - safePadding} ${box.y - safePadding} ${fittedWidth} ${fittedHeight}`,
      );
      svg.setAttribute('width', String(Math.ceil(fittedWidth)));
      svg.setAttribute('height', String(Math.ceil(fittedHeight)));
    }
  } catch {
    // SVG geometry may be unavailable while a hidden tab is being laid out.
  }
}

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
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      nodeSpacing: 28,
      rankSpacing: 34,
      padding: 8,
      curve: 'linear',
    },
    sequence: {
      useMaxWidth: true,
      diagramMarginX: 8,
      diagramMarginY: 8,
      actorMargin: 36,
      boxMargin: 6,
      messageMargin: 24,
    },
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
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => fitMermaidSvg(svg));
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
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => fitMermaidSvg(svg));
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
