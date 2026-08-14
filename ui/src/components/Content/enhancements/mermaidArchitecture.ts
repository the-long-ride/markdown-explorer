const ARCHITECTURE_EDGE_MARKER = 'data-mdn-architecture-edge-curved';
const ARCHITECTURE_GROUP_MARKER = 'data-mdn-architecture-group-refined';

function serviceGroups(svg: SVGSVGElement): any[] {
  if (typeof svg.querySelectorAll !== 'function') return [];
  const explicit = [...svg.querySelectorAll<any>('g.architecture-service')];
  return explicit.length > 0 ? explicit : [...svg.querySelectorAll<any>('g.service')];
}

function serviceLabels(group: any): any[] {
  if (!group?.querySelectorAll) return [];
  const explicit = [...group.querySelectorAll('.architecture-service-label')];
  return explicit.length > 0 ? explicit : [...group.querySelectorAll('text, foreignObject')];
}

function applyTextHalo(node: any): void {
  if (!node?.style) return;
  node.style.paintOrder = 'stroke fill';
  node.style.stroke = 'var(--bg-s, var(--bg, transparent))';
  node.style.strokeWidth = '2.5px';
  node.style.strokeLinejoin = 'round';
}

function styleArchitectureLabel(label: any): void {
  if (!label) return;
  // Apply font to container so all children inherit it
  if (label.style) {
    label.style.fontFamily = 'var(--font-mermaid)';
  }
  // Apply paint-order halo to text/tspan nodes only — NOT to g containers whose stroke
  // would be inherited by icon paths, making them invisible.
  const tag = String(label.tagName || '').toLowerCase();
  if (tag === 'text' || tag === 'tspan') {
    // label IS a text node — apply directly
    applyTextHalo(label);
  } else if (typeof label.querySelectorAll === 'function') {
    // label is a g container — find its text/tspan children
    const children = [...label.querySelectorAll('text, tspan')];
    if (children.length > 0) {
      for (const node of children) applyTextHalo(node);
    } else {
      // No text children found — may be a mock/leaf element, apply directly
      applyTextHalo(label);
    }
  } else {
    // No querySelectorAll (mock or bare leaf element) — apply directly
    applyTextHalo(label);
  }
}

export function parseSvgPathPoints(d: string): Array<{ cmd: string; x: number; y: number }> {
  const points: Array<{ cmd: string; x: number; y: number }> = [];
  const regex = /([ML])\s*([-\d.]+)[,\s]+([-\d.]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(d)) !== null) {
    const x = Number.parseFloat(match[2]);
    const y = Number.parseFloat(match[3]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ cmd: match[1].toUpperCase(), x, y });
    }
  }
  return points;
}

function detectArrowOrientation(arrowEl?: SVGElement | null): 'right' | 'left' | 'down' | 'up' | null {
  if (!arrowEl?.getAttribute) return null;
  const points = arrowEl.getAttribute('points') || '';
  if (points.includes(',0') && points.includes(',13') && points.startsWith('13')) {
    return 'right';
  }
  if (points.startsWith('0,0') && points.includes('13') && points.includes('6.6')) {
    return 'down';
  }
  if (points.startsWith('6.6') || points.includes('0,13.33')) {
    return 'up';
  }
  return null;
}

export function curveArchitectureEdgePath(d: string, arrowEl?: SVGElement | null): string {
  const points = parseSvgPathPoints(d);
  if (points.length < 2) return d;

  if (points.length === 2) {
    const p0 = points[0];
    const pEnd = points[1];
    const isPureHorizontal = Math.abs(p0.y - pEnd.y) < 0.5;
    const isPureVertical = Math.abs(p0.x - pEnd.x) < 0.5;

    if (isPureHorizontal || isPureVertical) {
      return `M ${p0.x},${p0.y} L ${pEnd.x},${pEnd.y}`;
    }

    const dx = pEnd.x - p0.x;
    const dy = pEnd.y - p0.y;
    const arrowDir = detectArrowOrientation(arrowEl);

    if (arrowDir === 'down' || arrowDir === 'up') {
      const cy1 = p0.y + dy * 0.5;
      return `M ${p0.x},${p0.y} C ${p0.x},${cy1} ${pEnd.x},${cy1} ${pEnd.x},${pEnd.y}`;
    }

    const cx = p0.x + dx * 0.5;
    return `M ${p0.x},${p0.y} C ${cx},${p0.y} ${cx},${pEnd.y} ${pEnd.x},${pEnd.y}`;
  }

  // Multi-point waypoint path: apply smooth corner fillet radius at each waypoint vertex
  let pathStr = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len2 = Math.hypot(v2.x, v2.y);

    if (len1 < 1 || len2 < 1) {
      pathStr += ` L ${curr.x},${curr.y}`;
      continue;
    }

    // Check if points are collinear
    const cross = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(cross) < 1e-3) {
      continue;
    }

    // Adaptively scale radius up to 48% of the incoming/outgoing segments
    const r = Math.min(len1 * 0.48, len2 * 0.48);
    const startX = curr.x + (v1.x / len1) * r;
    const startY = curr.y + (v1.y / len1) * r;
    const endX = curr.x + (v2.x / len2) * r;
    const endY = curr.y + (v2.y / len2) * r;

    pathStr += ` L ${startX},${startY} Q ${curr.x},${curr.y} ${endX},${endY}`;
  }

  pathStr += ` L ${points[points.length - 1].x},${points[points.length - 1].y}`;
  return pathStr;
}

export function curveArchitectureEdges(svg: SVGSVGElement): number {
  if (typeof svg.querySelectorAll !== 'function') return 0;
  let curved = 0;
  const edgeGroups = [...svg.querySelectorAll<any>('g.architecture-edges > g')];

  if (edgeGroups.length > 0) {
    for (const group of edgeGroups) {
      const path = group?.querySelector?.('path.edge, path');
      if (!path?.getAttribute || typeof path?.setAttribute !== 'function' || path.getAttribute(ARCHITECTURE_EDGE_MARKER) === 'true') continue;
      const arrow = group.querySelector?.('polygon.arrow, polygon');
      const oldD = path.getAttribute('d');
      if (!oldD) continue;
      const newD = curveArchitectureEdgePath(oldD, arrow);
      if (newD !== oldD) {
        path.setAttribute('d', newD);
        curved += 1;
      }
      path.setAttribute(ARCHITECTURE_EDGE_MARKER, 'true');
    }
  } else {
    const paths = [...svg.querySelectorAll<any>('path.edge, g.architecture-edges path')];
    for (const path of paths) {
      if (!path?.getAttribute || typeof path?.setAttribute !== 'function' || path.getAttribute(ARCHITECTURE_EDGE_MARKER) === 'true') continue;
      const oldD = path.getAttribute('d');
      if (!oldD) continue;
      const newD = curveArchitectureEdgePath(oldD);
      if (newD !== oldD) {
        path.setAttribute('d', newD);
        curved += 1;
      }
      path.setAttribute(ARCHITECTURE_EDGE_MARKER, 'true');
    }
  }

  return curved;
}

export function enforceArchitectureGroupBounds(svg: SVGSVGElement): number {
  if (typeof svg.querySelectorAll !== 'function') return 0;
  let modified = 0;
  const groupRects = [
    ...svg.querySelectorAll<any>('g.architecture-groups rect.node-bkg'),
    ...svg.querySelectorAll<any>('g.architecture-groups rect'),
  ];
  for (const rect of groupRects) {
    if (!rect?.getAttribute || typeof rect?.setAttribute !== 'function') continue;
    if (rect.getAttribute(ARCHITECTURE_GROUP_MARKER) === 'true') continue;
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    rect.setAttribute(ARCHITECTURE_GROUP_MARKER, 'true');
    modified += 1;
  }
  return modified;
}

export function repairArchitectureLabelCollisions(svg: SVGSVGElement): number {
  if (typeof svg.querySelectorAll !== 'function') return 0;
  for (const group of serviceGroups(svg)) {
    const labels = serviceLabels(group);
    for (const label of labels) {
      styleArchitectureLabel(label);
    }
  }
  curveArchitectureEdges(svg);
  enforceArchitectureGroupBounds(svg);
  return 0;
}
