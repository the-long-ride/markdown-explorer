const PIXEL_ATTR = /^\d+(?:\.\d+)?(?:px)?$/;

function readPxAttribute(svg: SVGSVGElement, name: 'width' | 'height'): number {
  const value = (svg.getAttribute(name) ?? '').trim();
  return PIXEL_ATTR.test(value) ? Number.parseFloat(value) : NaN;
}

/**
 * Mermaid "responsive" renderers (packet, kanban, pie, quadrant, xychart, …)
 * emit `<svg width="100%">` with no height attribute and rely on ambient CSS.
 * The modal re-injects the snapshot into a different CSS context where that
 * SVG has no intrinsic size and can collapse to 0×0. Snapshot the rendered
 * pixel size at capture time so the injected copy always has deterministic
 * intrinsic dimensions.
 */
export function snapshotSvgHtml(svg: SVGSVGElement): string {
  if (typeof svg.cloneNode !== 'function') return svg.outerHTML;
  const snapshot = svg.cloneNode(true) as SVGSVGElement;

  let width = NaN;
  let height = NaN;

  const rect = svg.getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) {
    width = rect.width;
    height = rect.height;
  } else {
    const attrWidth = readPxAttribute(svg, 'width');
    const attrHeight = readPxAttribute(svg, 'height');
    if (attrWidth > 0 && attrHeight > 0) {
      width = attrWidth;
      height = attrHeight;
    } else {
      const viewBox = svg.viewBox?.baseVal;
      let viewBoxWidth = 0;
      let viewBoxHeight = 0;
      if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        viewBoxWidth = viewBox.width;
        viewBoxHeight = viewBox.height;
      } else {
        const parts = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          viewBoxWidth = parts[2];
          viewBoxHeight = parts[3];
        }
      }
      if (viewBoxWidth > 0 && viewBoxHeight > 0) {
        width = 900;
        height = (900 * viewBoxHeight) / viewBoxWidth;
      }
    }
  }

  if (width > 0 && height > 0) {
    snapshot.setAttribute('width', String(Math.ceil(width)));
    snapshot.setAttribute('height', String(Math.ceil(height)));
  }

  return snapshot.outerHTML;
}
