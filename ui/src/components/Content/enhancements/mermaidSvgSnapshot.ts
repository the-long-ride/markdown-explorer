const PIXEL_ATTR = /^\d+(?:\.\d+)?(?:px)?$/;

function readPxAttribute(svg: SVGSVGElement, name: 'width' | 'height'): number {
  const value = (svg.getAttribute(name) ?? '').trim();
  return PIXEL_ATTR.test(value) ? Number.parseFloat(value) : NaN;
}

function readViewBoxSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const parts = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
    return { width: parts[2], height: parts[3] };
  }
  return { width: 0, height: 0 };
}

/**
 * Mermaid "responsive" renderers (packet, kanban, pie, quadrant, xychart, …)
 * emit `<svg width="100%">` with no height attribute and rely on ambient CSS.
 * The modal re-injects the snapshot into a different CSS context where that
 * SVG has no intrinsic size and can collapse to 0×0, while in-document CSS
 * (`.mdn-body .mermaid svg` max-width/max-height) can clamp rendered rects
 * smaller than the diagram's intrinsic size so first-open modal views look
 * shrunk. Preserve unclamped intrinsic/viewBox dimensions so the modal can
 * size the diagram cleanly up to the full modal viewport on first open.
 */
export function snapshotSvgHtml(svg: SVGSVGElement): string {
  if (typeof svg.cloneNode !== 'function') return svg.outerHTML;
  const snapshot = svg.cloneNode(true) as SVGSVGElement;

  const rect = svg.getBoundingClientRect?.();
  const hasRect = Boolean(rect && rect.width > 0 && rect.height > 0);
  const attrWidth = readPxAttribute(svg, 'width');
  const attrHeight = readPxAttribute(svg, 'height');
  const hasAttr = attrWidth > 0 && attrHeight > 0;
  const { width: viewBoxWidth, height: viewBoxHeight } = readViewBoxSize(svg);
  const hasViewBox = viewBoxWidth > 0 && viewBoxHeight > 0;

  let width = NaN;
  let height = NaN;

  if (hasAttr) {
    if (hasRect && rect!.width >= attrWidth && rect!.height >= attrHeight) {
      width = rect!.width;
      height = rect!.height;
    } else {
      width = attrWidth;
      height = attrHeight;
    }
  } else if (hasRect) {
    if (hasViewBox && (viewBoxWidth > rect!.width || viewBoxHeight > rect!.height)) {
      width = viewBoxWidth;
      height = viewBoxHeight;
    } else {
      width = rect!.width;
      height = rect!.height;
    }
  } else if (hasViewBox) {
    width = 900;
    height = (900 * viewBoxHeight) / viewBoxWidth;
  }

  if (width > 0 && height > 0) {
    snapshot.setAttribute('width', String(Math.ceil(width)));
    snapshot.setAttribute('height', String(Math.ceil(height)));
  }

  return snapshot.outerHTML;
}
