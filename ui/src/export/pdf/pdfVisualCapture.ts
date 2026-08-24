import { isLightPrintColor } from './pdfPrintLayout';
import type { PdfVisualBlock, PdfVisualKind } from './pdfModel';

const MAX_DIMENSION = 1800;
const MAX_PIXELS = 2_500_000;
const PRINT_TEXT = '#1f2328';
const PRINT_STROKE = '#57606a';

function dimensions(element: Element): { width: number; height: number } {
  const rect = element.getBoundingClientRect?.();
  const width = Math.max(1, Math.round(rect?.width || Number(element.getAttribute('width')) || 640));
  const height = Math.max(1, Math.round(rect?.height || Number(element.getAttribute('height')) || 360));
  const scale = Math.min(1, MAX_DIMENSION / width, MAX_DIMENSION / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

function normalizeStylePaint(node: Element, textNode: boolean): void {
  const style = node.getAttribute('style');
  if (!style) return;
  const declarations = style.split(';').map((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return declaration;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property === 'stroke' && isLightPrintColor(value)) return `stroke:${PRINT_STROKE}`;
    if (textNode && (property === 'fill' || property === 'color') && isLightPrintColor(value)) return `${property}:${PRINT_TEXT}`;
    return declaration;
  });
  node.setAttribute('style', declarations.join(';'));
}

function sanitizeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('script,foreignObject').forEach((node) => node.remove());
  clone.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
    }
    const textNode = ['text', 'tspan'].includes(node.tagName.toLowerCase());
    const stroke = node.getAttribute('stroke');
    if (isLightPrintColor(stroke)) node.setAttribute('stroke', PRINT_STROKE);
    const fill = node.getAttribute('fill');
    if (textNode && isLightPrintColor(fill)) node.setAttribute('fill', PRINT_TEXT);
    normalizeStylePaint(node, textNode);
  });
  const size = dimensions(svg);
  if (!clone.getAttribute('width')) clone.setAttribute('width', String(size.width));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(size.height));
  return clone.outerHTML;
}

function canvasDataUrl(canvas: HTMLCanvasElement): string | null {
  const width = canvas.width || Math.round(canvas.getBoundingClientRect?.().width || 0);
  const height = canvas.height || Math.round(canvas.getBoundingClientRect?.().height || 0);
  if (width <= 0 || height <= 0 || width * height > MAX_PIXELS || width > MAX_DIMENSION * 2 || height > MAX_DIMENSION * 2) return null;
  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

function imageDataUrl(image: HTMLImageElement): string | null {
  const src = image.currentSrc || image.src || image.getAttribute('src') || '';
  if (/^data:image\//i.test(src)) return src;
  const naturalWidth = image.naturalWidth || Math.round(image.getBoundingClientRect?.().width || 0);
  const naturalHeight = image.naturalHeight || Math.round(image.getBoundingClientRect?.().height || 0);
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;
  const size = dimensions(image);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, size.width, size.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] || character);
}

function staticPreviewSvg(iframe: HTMLIFrameElement): { svg: string; width: number; height: number } {
  const source = iframe.srcdoc || '';
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  parsed.querySelectorAll('script,noscript').forEach((node) => node.remove());
  parsed.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
    }
  });
  const text = (parsed.body.textContent || 'HTML preview').replace(/\s+/g, ' ').trim() || 'HTML preview';
  const lines = text.match(/.{1,82}(?:\s|$)/g)?.slice(0, 18).map((line) => line.trim()) ?? [text.slice(0, 82)];
  const width = 720;
  const height = Math.max(120, 54 + lines.length * 22);
  const tspans = lines.map((line, index) => `<tspan x="22" y="${48 + index * 22}">${escapeXml(line)}</tspan>`).join('');
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="8" fill="#ffffff" stroke="#c7c7c7"/><text font-family="Arial,sans-serif" font-size="15" fill="#222222">${tspans}</text></svg>`,
  };
}

function captureElement(element: Element, kind: PdfVisualKind, id: string): PdfVisualBlock {
  if (kind === 'mermaid') {
    const svg = element.matches('svg') ? element as SVGSVGElement : element.querySelector<SVGSVGElement>('svg');
    if (!svg) return { id, kind, fallbackText: 'Mermaid diagram unavailable' };
    return { id, kind, svg: sanitizeSvg(svg), ...dimensions(svg) };
  }
  if (kind === 'chart') {
    const canvas = element.matches('canvas') ? element as HTMLCanvasElement : element.querySelector<HTMLCanvasElement>('canvas');
    const image = canvas ? canvasDataUrl(canvas) : null;
    return image && canvas
      ? { id, kind, image, ...dimensions(canvas) }
      : { id, kind, fallbackText: 'Chart preview unavailable', warning: 'Chart canvas could not be captured.' };
  }
  if (kind === 'image') {
    const imageElement = element as HTMLImageElement;
    const image = imageDataUrl(imageElement);
    return image ? { id, kind, image, ...dimensions(imageElement) } : { id, kind, fallbackText: imageElement.alt || 'Image unavailable', warning: 'Image could not be captured for PDF.' };
  }
  const iframe = element.matches('iframe') ? element as HTMLIFrameElement : element.querySelector<HTMLIFrameElement>('.mdn-html-preview-iframe');
  if (!iframe) return { id, kind, fallbackText: 'HTML preview unavailable' };
  const preview = staticPreviewSvg(iframe);
  return { id, kind, svg: preview.svg, width: preview.width, height: preview.height };
}

export function capturePdfVisualBlocks(root: ParentNode): PdfVisualBlock[] {
  const candidates: Array<{ element: Element; kind: PdfVisualKind }> = [];
  root.querySelectorAll('img, .mdn-html-preview-wrap, .mdn-mermaid-wrap, .mdn-table-chart-container').forEach((element) => {
    if (element.matches('.mdn-table-chart-container') && !element.querySelector('canvas')) return;
    const kind: PdfVisualKind = element.matches('img') ? 'image'
      : element.matches('.mdn-html-preview-wrap') ? 'htmlPreview'
        : element.matches('.mdn-mermaid-wrap') ? 'mermaid' : 'chart';
    candidates.push({ element, kind });
  });
  return candidates.map(({ element, kind }, index) => {
    const id = `pdfv-${index + 1}`;
    element.setAttribute('data-mdn-pdf-visual-id', id);
    return captureElement(element, kind, id);
  });
}
