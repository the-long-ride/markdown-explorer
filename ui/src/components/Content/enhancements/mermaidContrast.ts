import {
  mermaidContrastRatio,
  parseMermaidColor,
  type MermaidThemeTokens,
} from './mermaidTheme.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LAYER_ATTR = 'data-mdn-mermaid-contrast-layer';
const DEFS_ATTR = 'data-mdn-mermaid-contrast-defs';
const CLIP_PREFIX = 'mdn-mermaid-contrast-clip';
let clipSequence = 0;

interface VisualBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaintedRegion {
  element: any;
  fill: string;
  box: VisualBox;
}

function readElementStyle(element: any, property: string): string {
  const camel = property.replace(/-([a-z])/g, (_match: string, char: string) => char.toUpperCase());
  const inline = element?.style?.getPropertyValue?.(property)?.trim?.() || element?.style?.[camel] || '';
  if (inline) return String(inline).trim();
  try {
    const computed = element?.ownerDocument?.defaultView?.getComputedStyle?.(element);
    return computed?.getPropertyValue?.(property)?.trim?.() || computed?.[camel]?.trim?.() || '';
  } catch {
    return '';
  }
}

function readableColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseMermaidColor(value);
  return parsed && parsed.a > 0.01 ? value.trim() : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function compositeFillOverBackground(fill: string, background: string): string {
  const foreground = parseMermaidColor(fill);
  const base = parseMermaidColor(background);
  if (!foreground || foreground.a >= 0.999 || !base) return fill;
  const baseAlpha = Math.min(1, Math.max(0, base.a));
  const baseR = base.r * baseAlpha + 255 * (1 - baseAlpha);
  const baseG = base.g * baseAlpha + 255 * (1 - baseAlpha);
  const baseB = base.b * baseAlpha + 255 * (1 - baseAlpha);
  const alpha = Math.min(1, Math.max(0, foreground.a));
  const channel = (value: number, baseValue: number) => Math.round(value * alpha + baseValue * (1 - alpha));
  return `rgb(${channel(foreground.r, baseR)}, ${channel(foreground.g, baseG)}, ${channel(foreground.b, baseB)})`;
}

export function chooseNeutralMermaidForeground(fill: string, tokens: MermaidThemeTokens): string {
  const candidates = unique([tokens.text, tokens.background, '#111111', '#ffffff']);
  const effectiveFill = compositeFillOverBackground(fill, tokens.background);
  let best = candidates[0] || '#111111';
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = mermaidContrastRatio(candidate, effectiveFill);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

function applySvgForeground(element: any, color: string): void {
  element?.setAttribute?.('fill', color);
  if (!element?.style) return;
  element.style.fill = color;
  element.style.color = color;
  element.style.setProperty?.('fill', color, 'important');
  element.style.setProperty?.('color', color, 'important');
}

function applyHtmlForeground(element: any, color: string): void {
  if (!element?.style) return;
  element.style.color = color;
  element.style.setProperty?.('color', color, 'important');
}

function labelDescendants(label: any): any[] {
  if (!label?.querySelectorAll) return [];
  try {
    return [...label.querySelectorAll('*')];
  } catch {
    return [];
  }
}

function isForeignObject(element: any): boolean {
  return String(element?.tagName || '').toLowerCase() === 'foreignobject';
}

function applyLabelForeground(label: any, color: string): void {
  if (isForeignObject(label)) {
    applyHtmlForeground(label, color);
    for (const child of labelDescendants(label)) applyHtmlForeground(child, color);
    return;
  }
  applySvgForeground(label, color);
  for (const child of labelDescendants(label)) {
    const tag = String(child?.tagName || '').toLowerCase();
    if (tag === 'tspan' || tag === 'text') applySvgForeground(child, color);
  }
}

function finiteBox(box: any): box is VisualBox {
  return box
    && Number.isFinite(box.x)
    && Number.isFinite(box.y)
    && Number.isFinite(box.width)
    && Number.isFinite(box.height)
    && box.width >= 0
    && box.height >= 0;
}

function transformPoint(matrix: any, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function visualBox(element: any): VisualBox | null {
  if (!element?.getBBox) return null;
  let box: any;
  try {
    box = element.getBBox();
  } catch {
    return null;
  }
  if (!finiteBox(box)) return null;
  const matrix = element.getCTM?.();
  if (!matrix || !['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key]))) return box;
  const corners = [
    transformPoint(matrix, box.x, box.y),
    transformPoint(matrix, box.x + box.width, box.y),
    transformPoint(matrix, box.x, box.y + box.height),
    transformPoint(matrix, box.x + box.width, box.y + box.height),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boxesIntersect(first: VisualBox, second: VisualBox): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

function shapeFill(shape: any): string | null {
  const opacity = Number.parseFloat(readElementStyle(shape, 'opacity') || '1');
  const fillOpacity = Number.parseFloat(readElementStyle(shape, 'fill-opacity') || '1');
  if ((Number.isFinite(opacity) && opacity <= 0.01) || (Number.isFinite(fillOpacity) && fillOpacity <= 0.01)) return null;
  return readableColor(shape?.getAttribute?.('fill')) || readableColor(readElementStyle(shape, 'fill'));
}

function blockedGeometry(shape: any): boolean {
  try {
    return Boolean(shape?.closest?.('defs, clipPath, mask, marker'));
  } catch {
    return false;
  }
}

function collectPaintedRegions(svg: any): PaintedRegion[] {
  if (!svg?.querySelectorAll) return [];
  let shapes: any[] = [];
  try {
    shapes = [...svg.querySelectorAll('rect, path, polygon, circle, ellipse')];
  } catch {
    return [];
  }
  const regions: PaintedRegion[] = [];
  for (const shape of shapes) {
    if (blockedGeometry(shape) || shape?.getAttribute?.(LAYER_ATTR) === 'true') continue;
    const fill = shapeFill(shape);
    if (!fill) continue;
    const box = visualBox(shape);
    if (!box) continue;
    regions.push({ element: shape, fill, box });
  }
  return regions;
}

function regionsForLabel(regions: readonly PaintedRegion[], label: any, labelBox: VisualBox): PaintedRegion[] {
  return regions.filter((region) => region.element !== label
    && !label?.contains?.(region.element)
    && boxesIntersect(labelBox, region.box));
}

function fallbackBackground(label: any, fallback: string): string {
  let current = label?.parentElement ?? null;
  let depth = 0;
  while (current && depth < 8) {
    const background = readableColor(readElementStyle(current, 'background-color'));
    if (background) return background;
    let shape: any = null;
    try {
      shape = current.querySelector?.(':scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path');
    } catch {
      shape = null;
    }
    const localFill = shapeFill(shape);
    if (localFill) return localFill;
    current = current.parentElement ?? null;
    depth += 1;
  }
  return fallback;
}

function directChildren(label: any): any[] {
  try {
    return label?.children ? [...label.children] : [];
  } catch {
    return [];
  }
}

function opaqueHtmlBackground(label: any): string | null {
  const candidates = [label, ...directChildren(label)];
  for (const candidate of candidates) {
    const background = readableColor(readElementStyle(candidate, 'background-color'));
    if (background) return background;
  }
  return null;
}

function repairHtmlLocalBackgrounds(label: any, tokens: MermaidThemeTokens): void {
  for (const candidate of labelDescendants(label)) {
    const background = readableColor(readElementStyle(candidate, 'background-color'));
    if (!background) continue;
    const foreground = chooseNeutralMermaidForeground(background, tokens);
    applyHtmlForeground(candidate, foreground);
    for (const child of labelDescendants(candidate)) applyHtmlForeground(child, foreground);
  }
}

function cleanupGeneratedLayers(svg: any): void {
  if (!svg?.querySelectorAll) return;
  for (const selector of [`[${LAYER_ATTR}="true"]`, `[${DEFS_ATTR}="true"]`]) {
    let elements: any[] = [];
    try {
      elements = [...svg.querySelectorAll(selector)];
    } catch {
      continue;
    }
    for (const element of elements) element?.remove?.();
  }
}

function createManagedDefs(svg: any): any | null {
  const doc = svg?.ownerDocument;
  if (!doc?.createElementNS) return null;
  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.setAttribute(DEFS_ATTR, 'true');
  try {
    svg.insertBefore?.(defs, svg.firstChild ?? null);
    if (!defs.parentElement && svg.appendChild) svg.appendChild(defs);
  } catch {
    return null;
  }
  return defs;
}

function relativeMatrix(shape: any, label: any): any | null {
  const shapeMatrix = shape?.getCTM?.();
  const labelMatrix = label?.getCTM?.();
  if (!shapeMatrix || !labelMatrix?.inverse) return null;
  try {
    const inverse = labelMatrix.inverse();
    return inverse?.multiply ? inverse.multiply(shapeMatrix) : null;
  } catch {
    return null;
  }
}

function matrixAttribute(matrix: any): string | null {
  if (!matrix || !['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key]))) return null;
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
}

function hasLocalTransform(element: any): boolean {
  const cssTransform = readElementStyle(element, 'transform');
  return Boolean(element?.getAttribute?.('transform') || (cssTransform && cssTransform !== 'none'));
}

function createRegionClip(defs: any, region: PaintedRegion, label: any): string | null {
  const doc = defs?.ownerDocument;
  if (!doc?.createElementNS || !region.element?.cloneNode) return null;
  const clipPath = doc.createElementNS(SVG_NS, 'clipPath');
  const id = `${CLIP_PREFIX}-${++clipSequence}`;
  clipPath.setAttribute('id', id);
  clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

  let geometry: any;
  try {
    geometry = region.element.cloneNode(false);
  } catch {
    return null;
  }
  geometry.removeAttribute?.('id');
  geometry.removeAttribute?.('style');
  const matrix = relativeMatrix(region.element, label);
  const sameCoordinateSpace = region.element?.parentElement === label?.parentElement
    && !hasLocalTransform(region.element)
    && !hasLocalTransform(label);
  if (!matrix && !sameCoordinateSpace) return null;
  const transform = matrixAttribute(matrix);
  if (transform) geometry.setAttribute?.('transform', transform);
  geometry.setAttribute?.('fill', '#ffffff');
  geometry.setAttribute?.('stroke', 'none');
  clipPath.appendChild?.(geometry);
  defs.appendChild?.(clipPath);
  return id;
}

function stripIds(element: any): void {
  element?.removeAttribute?.('id');
  for (const child of labelDescendants(element)) child?.removeAttribute?.('id');
}

function appendLayer(
  label: any,
  clipId: string,
  foreground: string,
  tokens: MermaidThemeTokens,
  anchor: any,
): any | null {
  if (!label?.cloneNode || !label?.parentElement?.insertBefore) return null;
  let clone: any;
  try {
    clone = label.cloneNode(true);
  } catch {
    return null;
  }
  stripIds(clone);
  clone.setAttribute?.(LAYER_ATTR, 'true');
  clone.setAttribute?.('aria-hidden', 'true');
  clone.setAttribute?.('clip-path', `url(#${clipId})`);
  if (clone.style) {
    clone.style.pointerEvents = 'none';
    clone.style.setProperty?.('pointer-events', 'none', 'important');
  }
  applyLabelForeground(clone, foreground);
  if (isForeignObject(clone)) repairHtmlLocalBackgrounds(clone, tokens);
  label.parentElement.insertBefore(clone, anchor?.nextSibling ?? null);
  return clone;
}

function isTopLevelLabel(element: any): boolean {
  const tag = String(element?.tagName || '').toLowerCase();
  return tag === 'text' || tag === 'foreignobject';
}

export interface MermaidContrastOptions {
  regionAware?: boolean;
}

export function enforceMermaidSvgContrast(
  svg: SVGSVGElement,
  tokens: MermaidThemeTokens,
  options: MermaidContrastOptions = {},
): void {
  if (typeof (svg as any)?.querySelectorAll !== 'function') return;
  cleanupGeneratedLayers(svg);
  const regionAware = options.regionAware !== false;
  const regions = regionAware ? collectPaintedRegions(svg) : [];
  const defs = regionAware ? createManagedDefs(svg) : null;
  let candidates: any[] = [];
  try {
    candidates = [...(svg as any).querySelectorAll('text, foreignObject')].filter(isTopLevelLabel);
  } catch {
    return;
  }

  for (const label of candidates) {
    if (label?.getAttribute?.(LAYER_ATTR) === 'true') continue;
    const tag = String(label?.tagName || '').toLowerCase();
    if (tag === 'foreignobject') {
      const localBackground = opaqueHtmlBackground(label);
      if (localBackground) {
        applyLabelForeground(label, chooseNeutralMermaidForeground(localBackground, tokens));
        repairHtmlLocalBackgrounds(label, tokens);
        continue;
      }
    }

    if (!regionAware) {
      const fill = fallbackBackground(label, tokens.background);
      applyLabelForeground(label, chooseNeutralMermaidForeground(fill, tokens));
      if (isForeignObject(label)) repairHtmlLocalBackgrounds(label, tokens);
      continue;
    }

    const box = visualBox(label);
    if (!box || box.width <= 0 || box.height <= 0 || !defs) {
      const fill = fallbackBackground(label, tokens.background);
      applyLabelForeground(label, chooseNeutralMermaidForeground(fill, tokens));
      continue;
    }

    applyLabelForeground(label, chooseNeutralMermaidForeground(tokens.background, tokens));
    if (isForeignObject(label)) repairHtmlLocalBackgrounds(label, tokens);
    let anchor: any = label;
    for (const region of regionsForLabel(regions, label, box)) {
      const clipId = createRegionClip(defs, region, label);
      if (!clipId) continue;
      const layer = appendLayer(
        label,
        clipId,
        chooseNeutralMermaidForeground(region.fill, tokens),
        tokens,
        anchor,
      );
      if (layer) anchor = layer;
    }
  }
}
