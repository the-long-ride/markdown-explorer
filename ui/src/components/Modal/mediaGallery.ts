import { snapshotSvgHtml } from '../Content/enhancements/mermaidSvgSnapshot.ts';

export interface MediaItem {
  type: 'img' | 'svg';
  src?: string;
  html?: string;
  kind?: string;
  source?: string;
}

export interface MediaGallery {
  items: MediaItem[];
  currentIndex: number;
}

interface MediaCandidate extends MediaItem {
  element: HTMLElement;
}

function normalizeClickedElement(element: HTMLElement): HTMLElement {
  if (element.tagName.toLowerCase() === 'img') return element;
  return element.closest<HTMLElement>('.mdn-mermaid-wrap, .mermaid, svg') ?? element;
}

/**
 * Read the raw mermaid source for a wrap so the media modal can re-render
 * the diagram with a different theme palette without losing the user's zoom
 * and pan position. Prefer the URL-encoded `data-mdn-mermaid-source` (set by
 * the markdown code renderer on `.mdn-mermaid-wrap`); fall back to the
 * `.mermaid` node's `data-original-code` (raw, set by the mermaid render
 * pipeline).
 */
function readMermaidSource(wrap: HTMLElement): string | undefined {
  const encoded = wrap.dataset?.mdnMermaidSource;
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* fall through */ }
  }
  const raw = wrap.querySelector<HTMLElement>('.mermaid')?.dataset?.originalCode;
  return raw || undefined;
}

export function createMediaGallery(
  clickedElement: HTMLElement,
  root: ParentNode = document,
): MediaGallery | null {
  const clicked = normalizeClickedElement(clickedElement);
  const candidates: MediaCandidate[] = [];

  root.querySelectorAll<HTMLElement>('.mdn-body img, .mdn-body .mdn-mermaid-wrap, .mdn-body .mermaid, img.mdn-img, .mdn-mermaid-wrap, .mermaid').forEach((element) => {
    if (element.tagName.toLowerCase() === 'img') {
      const image = element as HTMLImageElement;
      const src = image.currentSrc || image.src;
      if (src) candidates.push({ type: 'img', element, src });
      return;
    }

    const wrap = element.closest<HTMLElement>('.mdn-mermaid-wrap') ?? element;
    if (candidates.some((c) => c.element === wrap)) return;

    const svg = (wrap.tagName.toLowerCase() === 'svg' ? wrap : wrap.querySelector<SVGSVGElement>('svg')) as SVGSVGElement | null;
    const kind = wrap.dataset?.mdnMermaidKind || wrap.querySelector<HTMLElement>('[data-mdn-mermaid-kind]')?.dataset?.mdnMermaidKind;
    if (svg) candidates.push({ type: 'svg', element: wrap, html: snapshotSvgHtml(svg), kind, source: readMermaidSource(wrap) });
  });

  if (candidates.length === 0) return null;
  const clickedWrap = clicked.closest<HTMLElement>('.mdn-mermaid-wrap') ?? clicked;
  const selectedIndex = candidates.findIndex(
    ({ element }) =>
      element === clickedWrap
      || element === clicked
      || Boolean(element?.contains?.(clicked))
      || Boolean(clicked?.contains?.(element))
      || Boolean(element.querySelector?.('svg')?.contains?.(clicked)),
  );
  return {
    items: candidates.map(({ type, src, html, kind, source }) => ({ type, src, html, kind, source })),
    currentIndex: selectedIndex >= 0 ? selectedIndex : 0,
  };
}
