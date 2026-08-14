import {
  detectMermaidDiagramKind,
  estimateGanttIntrinsicWidth,
  getMermaidLayoutConfig,
  type MermaidDiagramKind,
} from './mermaidLayout.ts';
import { enforceMermaidSvgContrast } from './mermaidContrast.ts';
import { repairArchitectureLabelCollisions } from './mermaidArchitecture.ts';
import { enforceZenUmlFont, repairZenUmlTitle } from './mermaidZenUml.ts';
import {
  applySankeyIntrinsicWidth,
  estimateSankeyIntrinsicWidth,
  repairSankeyLabelCollisions,
} from './mermaidSankey.ts';
import {
  buildMermaidC4ThemeConfig,
  buildMermaidThemeVariables,
  readMermaidThemeTokens,
  type MermaidThemeTokens,
} from './mermaidTheme.ts';

export { enforceMermaidSvgContrast, chooseNeutralMermaidForeground } from './mermaidContrast.ts';
export {
  curveArchitectureEdgePath,
  curveArchitectureEdges,
  enforceArchitectureGroupBounds,
  repairArchitectureLabelCollisions,
} from './mermaidArchitecture.ts';
export { enforceZenUmlFont, repairZenUmlTitle } from './mermaidZenUml.ts';
export {
  applySankeyIntrinsicWidth,
  estimateSankeyIntrinsicWidth,
  repairSankeyLabelCollisions,
} from './mermaidSankey.ts';

interface MermaidLibrary {
  initialize(options: Record<string, unknown>): void;
  run?(options: { nodes: HTMLElement[] }): Promise<void>;
}

export interface MermaidOptions {
  getLibrary: () => Promise<MermaidLibrary>;
  isDark: boolean;
  isCancelled: () => boolean;
  runIdRef: { current: number };
  document?: Pick<Document, 'documentElement' | 'defaultView'>;
  nodes?: readonly HTMLElement[];
}

const MERMAID_SELECTOR = '.mermaid:not([data-mdn-rendered]):not([data-mdn-render-error])';
const MERMAID_RESET_SELECTOR = '.mermaid[data-original-code], .mermaid[data-mdn-rendered], .mermaid[data-mdn-render-error]';
const MAX_RENDER_ATTEMPTS = 2;
const MERMAID_VIEWBOX_PADDING = 12;

export function enforceC4Font(svg: SVGSVGElement, fontFamily: string): void {
  if (typeof svg.querySelectorAll !== 'function') return;
  svg.querySelectorAll<any>('text, tspan, foreignObject *').forEach((element: any) => {
    if (!element?.style) return;
    element.style.fontFamily = fontFamily;
    element.style.setProperty?.('font-family', fontFamily, 'important');
  });
}

function resolveMermaidFontFamily(doc: Pick<Document, 'documentElement' | 'defaultView'> | undefined): string {
  const style = doc?.defaultView?.getComputedStyle(doc.documentElement);
  return style?.getPropertyValue('--font-mermaid').trim() || 'var(--font-mermaid)';
}

export function polishMermaidSvg(svg: SVGSVGElement, kind?: MermaidDiagramKind): void {
  svg.setAttribute('shape-rendering', 'geometricPrecision');
  svg.setAttribute('text-rendering', 'geometricPrecision');
  if (svg.style) {
    svg.style.fontFamily = 'var(--font-mermaid)';
    svg.style.fontStyle = 'var(--font-mermaid-style)';
    svg.style.fontWeight = 'var(--font-mermaid-weight)';
  }

  if (typeof svg.querySelectorAll !== 'function') return;
  svg.querySelectorAll<SVGElement>('path,line,polyline,polygon').forEach((element) => {
    const className = element.getAttribute?.('class') || '';
    const nativeStrokeScaling = kind === 'zenuml' || kind === 'sankey'
      || (kind === 'architecture' && /(?:^|\s)arrow(?:\s|$)/.test(className));
    if (nativeStrokeScaling) element.removeAttribute?.('vector-effect');
    else element.setAttribute('vector-effect', 'non-scaling-stroke');
    if (kind === 'sankey') {
      element.removeAttribute?.('stroke-linecap');
      element.removeAttribute?.('stroke-linejoin');
    } else {
      element.setAttribute('stroke-linecap', 'round');
      element.setAttribute('stroke-linejoin', 'round');
    }
  });
}

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

export function applyGanttIntrinsicWidth(
  svg: SVGSVGElement,
  wrapper: HTMLElement | null | undefined,
  source: string,
): number {
  const renderedWidth = Number.parseFloat(svg.getAttribute('width') || '0');
  const width = estimateGanttIntrinsicWidth(source, Number.isFinite(renderedWidth) ? renderedWidth : 0);
  svg.setAttribute('width', String(width));
  if (svg.style) {
    svg.style.width = `${width}px`;
    svg.style.minWidth = `${width}px`;
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    svg.style.marginInline = '0';
  }
  if (wrapper?.style) {
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'auto';
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '100%';
    wrapper.style.minWidth = '0';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.marginLeft = '0';
    wrapper.style.marginRight = '0';
    wrapper.style.setProperty?.('--mdn-mermaid-intrinsic-width', `${width}px`);
  }
  return width;
}

function prepareMermaidSvg(
  svg: SVGSVGElement,
  kind: ReturnType<typeof detectMermaidDiagramKind>,
  source: string,
  wrapper: HTMLElement | null | undefined,
  tokens: MermaidThemeTokens,
  fontFamily: string,
): void {
  polishMermaidSvg(svg, kind);
  if (kind === 'c4') enforceC4Font(svg, fontFamily);
  // Diagrams that produce correct intrinsic dimensions themselves — don't refit their viewBox.
  // Architecture: has its own icon/label system.
  // ZenUML/Sankey: sized by special helpers.
  // Sequence: getBBox() on the first <g> only sees one actor, clipping the rest.
  const preserveNativeCanvas = kind === 'zenuml' || kind === 'sankey' || kind === 'architecture';
  const skipFitSvg = preserveNativeCanvas || kind === 'sequence';
  // Architecture and sequence diagrams have their own dedicated SVG styles and theme colors;
  // running the generic contrast pass over them causes labels to turn dark/invisible in dark mode.
  if (kind !== 'architecture' && kind !== 'sequence') {
    enforceMermaidSvgContrast(svg, tokens, { regionAware: !preserveNativeCanvas });
  }
  if (kind === 'zenuml') {
    enforceZenUmlFont(svg, fontFamily);
    repairZenUmlTitle(svg, tokens, fontFamily, source);
  }
  if (kind === 'sankey') {
    applySankeyIntrinsicWidth(svg, wrapper, source);
    repairSankeyLabelCollisions(svg);
  }
  if (kind === 'architecture') repairArchitectureLabelCollisions(svg);
  if (kind === 'sequence') fitSequenceSvg(svg);
  if (!skipFitSvg) fitMermaidSvg(svg);
  if (kind === 'gantt') applyGanttIntrinsicWidth(svg, wrapper, source);
}

/**
 * Makes a sequence diagram SVG responsive while preserving Mermaid's computed layout.
 * Unlike fitMermaidSvg, we do NOT call getBBox() on the first <g> (which only captures
 * the last rendered actor). Instead, we keep Mermaid's width/height/viewBox and just
 * make the SVG scale to fill its container.
 */
export function fitSequenceSvg(svg: SVGSVGElement): void {
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  if (svg.style) {
    svg.style.display = 'block';
    svg.style.width = 'auto';
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = 'var(--mermaid-max-h)';
    svg.style.marginInline = 'auto';
  }
}

function getPendingNodes(root: ParentNode, explicitNodes?: readonly HTMLElement[]): HTMLElement[] {
  const nodes = explicitNodes ?? [...root.querySelectorAll<HTMLElement>(MERMAID_SELECTOR)];
  return [...nodes].filter((element) => !element.dataset.mdnRendered && !element.dataset.mdnRenderError);
}

export function getMermaidRenderNodes(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    '.mermaid[data-mdn-rendered], .mermaid[data-original-code]:not([data-mdn-render-error])',
  )];
}

export function invalidateMermaidRendering(node: HTMLElement): void {
  const originalCode = node.dataset.originalCode;
  if (originalCode !== undefined) node.textContent = originalCode;
  delete node.dataset.mdnRendered;
  delete node.dataset.mdnRenderError;
  delete node.dataset.mdnRenderAttempts;
  delete node.dataset.mdnRenderRun;
  node.removeAttribute('data-processed');
  const wrapper = node.closest?.<HTMLElement>('.mdn-mermaid-wrap');
  if (wrapper) delete wrapper.dataset.mdnMermaidKind;
}

export function invalidateMermaidRenderings(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(MERMAID_RESET_SELECTOR).forEach(invalidateMermaidRendering);
}

export async function enhanceMermaid(
  root: ParentNode,
  options: MermaidOptions,
): Promise<void> {
  if (getPendingNodes(root, options.nodes).length === 0) return;

  const mermaid = await options.getLibrary();
  if (options.isCancelled()) return;
  if (typeof mermaid.run !== 'function') return;

  const runId = ++options.runIdRef.current;
  const nodes = getPendingNodes(root, options.nodes);
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined);
  const themeTokens = readMermaidThemeTokens(doc, options.isDark);
  const themeVariables = buildMermaidThemeVariables(themeTokens, options.isDark);
  const fontFamily = resolveMermaidFontFamily(doc);

  for (const node of nodes) {
    if (options.isCancelled() || runId !== options.runIdRef.current) return;

    if (!node.dataset.originalCode) node.dataset.originalCode = node.textContent || '';
    const originalCode = node.dataset.originalCode || '';
    const kind = detectMermaidDiagramKind(originalCode);
    const wrapper = node.closest?.<HTMLElement>('.mdn-mermaid-wrap');
    if (wrapper) wrapper.dataset.mdnMermaidKind = kind;

    const renderToken = String(runId);
    node.dataset.mdnRenderRun = renderToken;

    const layoutConfig = getMermaidLayoutConfig(kind, fontFamily, originalCode);
    if (kind === 'gantt' && layoutConfig.gantt) {
      layoutConfig.gantt.useWidth = estimateGanttIntrinsicWidth(originalCode, wrapper?.clientWidth ?? 0);
    }
    if (kind === 'sankey') {
      layoutConfig.sankey = {
        width: estimateSankeyIntrinsicWidth(originalCode, wrapper?.clientWidth ?? 0),
        useMaxWidth: false,
      };
    }
    if (kind === 'c4' && layoutConfig.c4) {
      Object.assign(layoutConfig.c4, buildMermaidC4ThemeConfig(themeTokens));
    }
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables,
      fontFamily,
      ...layoutConfig,
    });

    if (node.querySelector('svg')) {
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => prepareMermaidSvg(svg, kind, originalCode, wrapper, themeTokens, fontFamily));
      node.dataset.mdnRendered = 'true';
      delete node.dataset.mdnRenderAttempts;
      delete node.dataset.mdnRenderError;
      continue;
    }

    node.removeAttribute('data-processed');
    try {
      await mermaid.run({ nodes: [node] });
      if (options.isCancelled() || runId !== options.runIdRef.current) {
        if (!node.dataset.mdnRenderRun || node.dataset.mdnRenderRun === renderToken) {
          node.textContent = originalCode;
          node.removeAttribute('data-processed');
          delete node.dataset.mdnRenderRun;
        }
        return;
      }
      if (node.dataset.mdnRenderRun !== renderToken) return;
      if (!node.querySelector('svg')) throw new Error('Mermaid completed without producing an SVG');
      node.dataset.mdnRendered = 'true';
      delete node.dataset.mdnRenderAttempts;
      delete node.dataset.mdnRenderError;
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => prepareMermaidSvg(svg, kind, originalCode, wrapper, themeTokens, fontFamily));
    } catch (error) {
      if (options.isCancelled() || runId !== options.runIdRef.current) {
        if (!node.dataset.mdnRenderRun || node.dataset.mdnRenderRun === renderToken) {
          node.textContent = originalCode;
          node.removeAttribute('data-processed');
          delete node.dataset.mdnRenderRun;
        }
        return;
      }
      if (node.dataset.mdnRenderRun !== renderToken) return;
      if (!node.querySelector('svg') && node.textContent !== originalCode) node.textContent = originalCode;
      node.removeAttribute('data-processed');
      const attempts = Number.parseInt(node.dataset.mdnRenderAttempts || '0', 10) + 1;
      node.dataset.mdnRenderAttempts = String(attempts);
      if (attempts >= MAX_RENDER_ATTEMPTS) node.dataset.mdnRenderError = 'true';
      console.error('Mermaid diagram render error:', error);
    }
  }
}
