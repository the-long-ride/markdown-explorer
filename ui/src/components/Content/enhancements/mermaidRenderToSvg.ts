import {
  detectMermaidDiagramKind,
  estimateGanttIntrinsicWidth,
  getMermaidLayoutConfig,
  type MermaidDiagramKind,
} from './mermaidLayout.ts';
import { estimateSankeyIntrinsicWidth } from './mermaidSankey.ts';
import {
  buildMermaidC4ThemeConfig,
  buildMermaidThemeVariables,
  readMermaidThemeTokens,
} from './mermaidTheme.ts';
import {
  prepareMermaidSvg,
  resolveMermaidFontFamily,
  resolveMermaidThemeOptions,
} from './mermaidRendering.ts';
import { snapshotSvgHtml } from './mermaidSvgSnapshot.ts';

export interface RenderMermaidToSvgArgs {
  source: string;
  kind?: MermaidDiagramKind;
  isDark: boolean;
  document?: Document;
}

/**
 * Standalone single-shot render of a mermaid source string into a self-contained
 * SVG, intended for re-rendering a diagram with a new theme palette while
 * preserving the calling surface's existing zoom/pan state. Shares the same
 * low-level helpers as the content render loop (`enhanceMermaid`) but runs as
 * one off-DOM scratch render; it does not refactor or hold shared state with
 * the batched loop. The dynamic import of `getMermaid` keeps the css-bearing
 * `renderLibs` module out of the static module graph so node-strip-types
 * consumers of `mermaidRendering` never transitively pull the highlight.js
 * stylesheet import.
 */
export async function renderMermaidToSvg(args: RenderMermaidToSvgArgs): Promise<{ svgHtml: string }> {
  const doc = args.document ?? (typeof document !== 'undefined' ? document : undefined);
  if (!doc) throw new Error('renderMermaidToSvg requires a document');

  const themeTokens = readMermaidThemeTokens(doc, args.isDark);
  const fontFamily = resolveMermaidFontFamily(doc);
  const kind = args.kind ?? detectMermaidDiagramKind(args.source);
  const layoutConfig = getMermaidLayoutConfig(kind, fontFamily, args.source);

  if (kind === 'gantt' && layoutConfig.gantt) {
    layoutConfig.gantt.useWidth = estimateGanttIntrinsicWidth(args.source, 0);
  }
  if (kind === 'sankey') {
    layoutConfig.sankey = {
      width: estimateSankeyIntrinsicWidth(args.source, 0),
      useMaxWidth: false,
    };
  }
  if (kind === 'c4' && layoutConfig.c4) {
    Object.assign(layoutConfig.c4, buildMermaidC4ThemeConfig(themeTokens));
  }

  const themeVariables = buildMermaidThemeVariables(
    themeTokens,
    args.isDark,
    resolveMermaidThemeOptions(kind, args.source),
  );

  const scratchNode = doc.createElement('div');
  scratchNode.className = 'mermaid';
  scratchNode.dataset.originalCode = args.source;
  scratchNode.textContent = args.source;

  // Attach the scratch node to a hidden off-screen host on the document body
  // so mermaid.run() can measure text/containers via getBoundingClientRect /
  // getComputedTextLength. For layout-sensitive kinds (sequence, packet,
  // kanban, pie, quadrant, xychart, zenuml, sankey) a detached scratch node
  // returns 0 for every measurement → degenerate SVGs (empty/0×0 boxes) that
  // match the symptom "diagram shows empty box until user interacts with
  // zoom/pan". Hosting the render in-DOM fixes both the initial re-render and
  // the theme-flip recolor paths. The host is removed in `finally` so the
  // user never sees it.
  const host = doc.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  // Parked off-screen but NOT visibility:hidden: dagre/mermaid measure edge
  // labels through layout APIs while rendering, and a hidden subtree can yield
  // undefined label sizes → "translate(undefined, NaN)" transform errors.
  // Off-screen positioning alone keeps it invisible to the user.
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.width = `${doc.documentElement?.clientWidth || 1024}px`;
  host.style.height = '0';
  host.style.overflow = 'visible';
  host.style.pointerEvents = 'none';
  host.appendChild(scratchNode);
  doc.body.appendChild(host);

  const { getMermaid } = await import('../../../lib/renderLibs.ts');
  const mermaid = await getMermaid();
  if (typeof mermaid.run !== 'function') throw new Error('renderMermaidToSvg: mermaid.run unavailable');

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables,
    fontFamily,
    ...layoutConfig,
  });
  try {
    await mermaid.run({ nodes: [scratchNode] });
  } finally {
    host.remove();
  }

  const svg = scratchNode.querySelector('svg');
  if (!svg) throw new Error('renderMermaidToSvg: mermaid produced no svg');

  prepareMermaidSvg(svg, kind, args.source, null, themeTokens, fontFamily);
  return { svgHtml: snapshotSvgHtml(svg) };
}
