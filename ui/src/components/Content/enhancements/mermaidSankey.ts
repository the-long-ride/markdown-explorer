export interface SankeyLabelRepairOptions {
  readonly gap?: number;
  readonly columnTolerance?: number;
  readonly viewBoxPadding?: number;
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LogicalLabel {
  elements: SVGTextElement[];
  x: number;
  originalY: number;
  boxX: number;
  boxY: number;
  width: number;
  height: number;
  shiftY: number;
}

function finiteNumber(value: string | null | undefined): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeBBox(element: SVGGraphicsElement): DOMRect | SVGRect | null {
  try {
    const box = element.getBBox();
    if (
      Number.isFinite(box.x) && Number.isFinite(box.y)
      && Number.isFinite(box.width) && Number.isFinite(box.height)
    ) return box;
  } catch {
    // Hidden tabs may not expose SVG geometry yet.
  }
  return null;
}

function parseViewBox(svg: SVGSVGElement): ViewBox | null {
  const parts = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [x, y, width, height] = parts;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function labelKey(element: SVGTextElement, x: number, y: number): string {
  const text = String(element.textContent ?? '').replace(/\s+/g, ' ').trim();
  return `${text}\u0000${x.toFixed(2)}\u0000${y.toFixed(2)}`;
}

function collectLogicalLabels(svg: SVGSVGElement): LogicalLabel[] {
  if (typeof svg.querySelectorAll !== 'function') return [];
  const groups = new Map<string, LogicalLabel>();

  for (const element of svg.querySelectorAll<SVGTextElement>('g.node-labels text')) {
    const box = safeBBox(element);
    if (!box || box.height <= 0) continue;
    const x = finiteNumber(element.getAttribute('x')) ?? box.x + box.width / 2;
    const y = finiteNumber(element.getAttribute('y')) ?? box.y + box.height / 2;
    const key = labelKey(element, x, y);
    const existing = groups.get(key);
    if (existing) {
      existing.elements.push(element);
      existing.boxX = Math.min(existing.boxX, box.x);
      existing.boxY = Math.min(existing.boxY, box.y);
      existing.width = Math.max(existing.width, box.width);
      existing.height = Math.max(existing.height, box.height);
      continue;
    }
    groups.set(key, {
      elements: [element],
      x,
      originalY: y,
      boxX: box.x,
      boxY: box.y,
      width: box.width,
      height: box.height,
      shiftY: 0,
    });
  }

  return [...groups.values()];
}

function buildColumns(labels: LogicalLabel[], tolerance: number): LogicalLabel[][] {
  const sorted = [...labels].sort((a, b) => a.x - b.x);
  const columns: Array<{ center: number; labels: LogicalLabel[] }> = [];

  for (const label of sorted) {
    let column = columns.find((candidate) => Math.abs(candidate.center - label.x) <= tolerance);
    if (!column) {
      column = { center: label.x, labels: [] };
      columns.push(column);
    }
    column.labels.push(label);
    column.center = column.labels.reduce((sum, item) => sum + item.x, 0) / column.labels.length;
  }

  return columns.map((column) => column.labels);
}

function deconflictColumn(
  labels: LogicalLabel[],
  gap: number,
  viewBox: ViewBox | null,
  padding: number,
): void {
  labels.sort((a, b) => a.boxY - b.boxY);
  let cursor = Number.NEGATIVE_INFINITY;

  for (const label of labels) {
    const top = label.boxY;
    if (Number.isFinite(cursor) && top < cursor) label.shiftY = cursor - top;
    cursor = top + label.shiftY + label.height + gap;
  }

  if (!viewBox || labels.length === 0) return;
  const bottomLimit = viewBox.y + viewBox.height - padding;
  const finalBottom = Math.max(...labels.map((label) => label.boxY + label.shiftY + label.height));
  const overflow = Math.max(0, finalBottom - bottomLimit);
  if (overflow <= 0) return;

  const firstTop = Math.min(...labels.map((label) => label.boxY + label.shiftY));
  const availableUp = Math.max(0, firstTop - (viewBox.y + padding));
  const shiftUp = Math.min(overflow, availableUp);
  if (shiftUp > 0) labels.forEach((label) => { label.shiftY -= shiftUp; });
}

function applyLabelPositions(labels: LogicalLabel[]): void {
  for (const label of labels) {
    for (const element of label.elements) {
      element.setAttribute('y', String(label.originalY + label.shiftY));
      element.setAttribute('data-mdn-sankey-label-shift', String(label.shiftY));
    }
  }
}

function expandViewBoxForLabels(svg: SVGSVGElement, labels: LogicalLabel[], viewBox: ViewBox | null, padding: number): void {
  if (!viewBox || labels.length === 0) return;
  const minY = Math.min(...labels.map((label) => label.boxY + label.shiftY));
  const maxY = Math.max(...labels.map((label) => label.boxY + label.shiftY + label.height));
  const top = Math.min(viewBox.y, minY - padding);
  const bottom = Math.max(viewBox.y + viewBox.height, maxY + padding);
  if (top === viewBox.y && bottom === viewBox.y + viewBox.height) return;
  svg.setAttribute('viewBox', `${viewBox.x} ${top} ${viewBox.width} ${bottom - top}`);
}

export function raiseSankeyLabels(svg: SVGSVGElement): void {
  const nodeLabels = typeof svg.querySelector === 'function' ? svg.querySelector<SVGGElement>('g.node-labels') : null;
  if (nodeLabels && nodeLabels.parentElement) {
    nodeLabels.parentElement.appendChild(nodeLabels);
  }
}

export function repairSankeyLabelCollisions(
  svg: SVGSVGElement,
  options: SankeyLabelRepairOptions = {},
): number {
  raiseSankeyLabels(svg);
  const labels = collectLogicalLabels(svg);
  if (labels.length < 2) return 0;

  const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap ?? 8) : 8;
  const tolerance = Number.isFinite(options.columnTolerance)
    ? Math.max(0, options.columnTolerance ?? 24)
    : 24;
  const padding = Number.isFinite(options.viewBoxPadding)
    ? Math.max(0, options.viewBoxPadding ?? 8)
    : 8;
  const viewBox = parseViewBox(svg);
  const columns = buildColumns(labels, tolerance);

  columns.forEach((column) => deconflictColumn(column, gap, viewBox, padding));
  applyLabelPositions(labels);
  expandViewBoxForLabels(svg, labels, viewBox, padding);
  return labels.filter((label) => Math.abs(label.shiftY) > 0.001).length;
}

const SANKEY_MIN_INTRINSIC_WIDTH = 760;
const SANKEY_MAX_INTRINSIC_WIDTH = 1800;

function splitSankeyCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function sankeyPressure(source: string): { columns: number; longestLabel: number; maxPerColumn: number; nodes: number } {
  const edges: Array<[string, string]> = [];
  const labels = new Set<string>();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || /^sankey(?:-beta)?\b/i.test(line)) continue;
    const [sourceLabel, targetLabel] = splitSankeyCsvLine(line);
    if (!sourceLabel || !targetLabel) continue;
    edges.push([sourceLabel, targetLabel]);
    labels.add(sourceLabel);
    labels.add(targetLabel);
  }

  const level = new Map<string, number>([...labels].map((label) => [label, 0]));
  const indegree = new Map<string, number>([...labels].map((label) => [label, 0]));
  const outgoing = new Map<string, string[]>();
  for (const [sourceLabel, targetLabel] of edges) {
    indegree.set(targetLabel, (indegree.get(targetLabel) ?? 0) + 1);
    outgoing.set(sourceLabel, [...(outgoing.get(sourceLabel) ?? []), targetLabel]);
  }
  const queue = [...labels].filter((label) => (indegree.get(label) ?? 0) === 0);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.add(current);
    for (const target of outgoing.get(current) ?? []) {
      level.set(target, Math.max(level.get(target) ?? 0, (level.get(current) ?? 0) + 1));
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  if (visited.size < labels.size) {
    let fallbackLevel = 0;
    for (const label of labels) {
      if (visited.has(label)) continue;
      level.set(label, fallbackLevel++ % 3);
    }
  }

  const counts = new Map<number, number>();
  for (const value of level.values()) counts.set(value, (counts.get(value) ?? 0) + 1);
  return {
    columns: Math.max(2, ...(level.size ? [...level.values()].map((value) => value + 1) : [2])),
    longestLabel: Math.max(0, ...[...labels].map((label) => label.length)),
    maxPerColumn: Math.max(1, ...counts.values()),
    nodes: labels.size,
  };
}

export function estimateSankeyIntrinsicWidth(source: string, containerWidth = 0): number {
  const pressure = sankeyPressure(source);
  const perColumn = 170 + Math.min(90, pressure.longestLabel * 3);
  const columnPressure = pressure.columns * perColumn;
  const stackPressure = Math.max(0, pressure.maxPerColumn - 2) * 70;
  const nodePressure = Math.max(0, pressure.nodes - 8) * 18;
  const requested = Math.max(containerWidth || 0, columnPressure + stackPressure + nodePressure);
  return Math.round(Math.min(SANKEY_MAX_INTRINSIC_WIDTH, Math.max(SANKEY_MIN_INTRINSIC_WIDTH, requested)));
}

export function applySankeyIntrinsicWidth(
  svg: SVGSVGElement,
  wrapper: HTMLElement | null | undefined,
  source: string,
  requestedWidth?: number,
): number {
  const renderedWidth = Number.parseFloat(svg.getAttribute('width') || '0');
  const width = requestedWidth ?? estimateSankeyIntrinsicWidth(
    source,
    Math.max(wrapper?.clientWidth ?? 0, Number.isFinite(renderedWidth) ? renderedWidth : 0),
  );
  svg.setAttribute('width', String(width));
  if (svg.style) {
    svg.style.width = `${width}px`;
    svg.style.minWidth = `${width}px`;
    svg.style.maxWidth = 'none';
    svg.style.marginInline = '0';
  }
  if (wrapper?.style) {
    wrapper.style.overflowX = 'auto';
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
