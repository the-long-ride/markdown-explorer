const SVG_NS = 'http://www.w3.org/2000/svg';

export const TABLE_ICON_PATHS = {
  rowAbove: 'M4 14h16M4 20h16M12 9V3m-3.5 3.5L12 3l3.5 3.5',
  rowBelow: 'M4 4h16M4 10h16M12 15v6m-3.5-3.5L12 21l3.5-3.5',
  rowDelete: 'M4 5h16M4 19h16M10 10l4 4m0-4-4 4',
  colLeft: 'M14 4v16M20 4v16M9 12H3m3.5-3.5L3 12l3.5 3.5',
  colRight: 'M4 4v16M10 4v16M15 12h6m-3.5-3.5L21 12l-3.5 3.5',
  colDelete: 'M5 4v16M19 4v16M10 10l4 4m0-4-4 4',
  rawMarkdown: 'M7 8L3 11.6923L7 16M17 8L21 11.6923L17 16M14 4L10 20',
};

export function createSvgIcon(pathD: string, size = 14, strokeWidth = 2): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

export function createTableGridIcon(size = 14): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '4');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '16');
  rect.setAttribute('rx', '2');
  svg.appendChild(rect);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M3 10h18M3 15h18M10 4v16');
  svg.appendChild(path);

  return svg;
}
