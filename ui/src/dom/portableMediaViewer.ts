export type PortableMediaItem =
  | { kind: 'image'; src: string }
  | { kind: 'svg'; html: string };

const installedDocuments = new WeakSet<Document>();

function mediaElements(doc: Document): Element[] {
  const elements = [...doc.querySelectorAll('img, .mdn-mermaid-wrap .mermaid svg')];
  return elements.filter((element) => !element.closest('.mdn-export-media-viewer'));
}

function itemFromElement(element: Element): PortableMediaItem | null {
  if (element instanceof HTMLImageElement) {
    const src = element.currentSrc || element.src || element.getAttribute('src') || '';
    return src ? { kind: 'image', src } : null;
  }
  if (element instanceof SVGSVGElement) return { kind: 'svg', html: element.outerHTML };
  return null;
}

function renderItem(container: HTMLElement, item: PortableMediaItem, scale: number, panX: number, panY: number): HTMLElement {
  container.replaceChildren();
  const media = item.kind === 'image' ? document.createElement('img') : document.createElement('div');
  if (item.kind === 'image') {
    (media as HTMLImageElement).src = item.src;
    (media as HTMLImageElement).alt = '';
    (media as HTMLImageElement).draggable = false;
    media.className = 'mdn-modal-content-img media-modal__transform';
  } else {
    media.className = 'mdn-modal-content-svg media-modal__transform';
    media.innerHTML = item.html;
  }
  media.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  media.style.transformOrigin = 'center center';
  container.appendChild(media);
  return media;
}

export function openPortableMediaViewer(
  source: Element,
  doc: Document = document,
): HTMLDivElement | null {
  const elements = mediaElements(doc);
  const initialIndex = elements.indexOf(source);
  if (initialIndex < 0) return null;
  const items = elements.map(itemFromElement).filter((item): item is PortableMediaItem => item !== null);
  if (items.length === 0) return null;

  doc.querySelector('.mdn-export-media-viewer')?.remove();
  const modal = doc.createElement('div');
  modal.className = 'mdn-modal media-modal mdn-export-media-viewer';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Media viewer');
  modal.innerHTML = `
    <button type="button" class="mdn-modal-close" data-media-action="close" aria-label="Close">×</button>
    <button type="button" class="mdn-modal-btn mdn-modal-btn--prev" data-media-action="previous" aria-label="Previous">‹</button>
    <button type="button" class="mdn-modal-btn mdn-modal-btn--next" data-media-action="next" aria-label="Next">›</button>
    <div class="mdn-modal-content-wrap"><div class="mdn-modal-media-container"></div></div>
    <div class="mdn-modal-footer media-modal__footer"><div class="mdn-modal-toolbar">
      <button type="button" class="mdn-modal-tool" data-media-action="zoom-in" aria-label="Zoom in">+</button>
      <span class="mdn-modal-zoom-text">100%</span>
      <button type="button" class="mdn-modal-tool" data-media-action="zoom-out" aria-label="Zoom out">−</button>
      <button type="button" class="mdn-modal-tool" data-media-action="reset" aria-label="Reset zoom">100%</button>
    </div></div>`;
  doc.body.appendChild(modal);

  const wrap = modal.querySelector<HTMLElement>('.mdn-modal-content-wrap');
  const container = modal.querySelector<HTMLElement>('.mdn-modal-media-container');
  const zoomText = modal.querySelector<HTMLElement>('.mdn-modal-zoom-text');
  if (!wrap || !container || !zoomText) return modal;

  let index = Math.max(0, Math.min(initialIndex, items.length - 1));
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  const render = () => {
    scale = Math.max(0.1, Math.min(10, scale));
    renderItem(container, items[index], scale, panX, panY);
    zoomText.textContent = `${Math.round(scale * 100)}%`;
    modal.querySelectorAll<HTMLElement>('[data-media-action="previous"], [data-media-action="next"]')
      .forEach((button) => { button.hidden = items.length <= 1; });
  };

  const reset = () => { scale = 1; panX = 0; panY = 0; render(); };
  const close = () => {
    doc.removeEventListener('keydown', onKeyDown);
    modal.remove();
  };
  const navigate = (delta: number) => {
    index = (index + delta + items.length) % items.length;
    reset();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowLeft' && items.length > 1) navigate(-1);
    else if (event.key === 'ArrowRight' && items.length > 1) navigate(1);
  };

  modal.addEventListener('click', (event) => {
    if (event.target === modal) { close(); return; }
    const action = (event.target as Element | null)?.closest<HTMLElement>('[data-media-action]')?.dataset.mediaAction;
    if (action === 'close') close();
    else if (action === 'previous') navigate(-1);
    else if (action === 'next') navigate(1);
    else if (action === 'zoom-in') { scale += 0.1; render(); }
    else if (action === 'zoom-out') { scale -= 0.1; render(); }
    else if (action === 'reset') reset();
  });
  wrap.addEventListener('wheel', (event) => {
    event.preventDefault();
    scale += event.deltaY < 0 ? 0.1 : -0.1;
    render();
  }, { passive: false });
  wrap.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX - panX;
    startY = event.clientY - panY;
    wrap.setPointerCapture?.(event.pointerId);
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    panX = event.clientX - startX;
    panY = event.clientY - startY;
    render();
  });
  wrap.addEventListener('pointerup', () => { dragging = false; });
  wrap.addEventListener('pointercancel', () => { dragging = false; });
  doc.addEventListener('keydown', onKeyDown);
  render();
  return modal;
}

export function installPortableMediaViewer(doc: Document = document): void {
  if (installedDocuments.has(doc)) return;
  installedDocuments.add(doc);
  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.mdn-export-media-viewer')) return;
    const source = target.closest('img') ?? target.closest('.mdn-mermaid-wrap .mermaid svg');
    if (!source) return;
    event.preventDefault();
    openPortableMediaViewer(source, doc);
  });
}
