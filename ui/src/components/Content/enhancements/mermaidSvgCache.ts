import { detectMermaidDiagramKind } from './mermaidLayout.ts';
import { resolveMermaidFontFamily } from './mermaidRendering.ts';
import { readMermaidThemeTokens } from './mermaidTheme.ts';

// Rendered Mermaid SVG markup keyed by diagram source + theme signature, so a
// document re-mounted by a tab switch (main view or split pane) shows its
// diagrams instantly instead of re-running mermaid one diagram at a time.
export const MERMAID_SVG_CACHE_LIMIT = 200;
const cache = new Map<string, string>();

function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

export function mermaidCacheKey(source: string, signature: string): string {
  return `${hash(signature)}:${source.length}:${hash(source)}`;
}

// Everything that feeds Mermaid colors and fonts: the dark/light flag plus the
// resolved theme CSS variables (theme style, custom theme and font settings all
// land there), read the same way enhanceMermaid reads them.
export function resolveMermaidCacheSignature(
  doc: Pick<Document, 'documentElement' | 'defaultView'> | undefined,
  isDark: boolean,
): string {
  return `${isDark ? 'dark' : 'light'}|${resolveMermaidFontFamily(doc)}|${JSON.stringify(readMermaidThemeTokens(doc, isDark))}`;
}

// Gantt and sankey layouts depend on the container width, so a cached SVG
// could be wrong for another pane width.
export function isCacheableMermaidSource(source: string): boolean {
  const kind = detectMermaidDiagramKind(source);
  return kind !== 'gantt' && kind !== 'sankey';
}

export function getCachedMermaidSvg(key: string): string | undefined {
  const svg = cache.get(key);
  if (svg === undefined) return undefined;
  cache.delete(key);
  cache.set(key, svg);
  return svg;
}

export function setCachedMermaidSvg(key: string, svg: string): void {
  cache.delete(key);
  cache.set(key, svg);
  while (cache.size > MERMAID_SVG_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function clearMermaidSvgCache(): void {
  cache.clear();
}
