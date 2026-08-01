export interface MediaItem {
  type: 'img' | 'svg';
  src?: string;
  html?: string;
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
  return element.closest<HTMLElement>('.mdn-mermaid-wrap') ?? element;
}

export function createMediaGallery(
  clickedElement: HTMLElement,
  root: ParentNode = document,
): MediaGallery | null {
  const clicked = normalizeClickedElement(clickedElement);
  const candidates: MediaCandidate[] = [];

  root.querySelectorAll<HTMLElement>('.mdn-body img, .mdn-body .mdn-mermaid-wrap').forEach((element) => {
    if (element.tagName.toLowerCase() === 'img') {
      const image = element as HTMLImageElement;
      const src = image.currentSrc || image.src;
      if (src) candidates.push({ type: 'img', element, src });
      return;
    }

    const svg = element.querySelector<SVGSVGElement>('svg');
    if (svg) candidates.push({ type: 'svg', element, html: svg.outerHTML });
  });

  if (candidates.length === 0) return null;
  const selectedIndex = candidates.findIndex(({ element }) => element === clicked);
  return {
    items: candidates.map(({ type, src, html }) => ({ type, src, html })),
    currentIndex: selectedIndex >= 0 ? selectedIndex : 0,
  };
}
