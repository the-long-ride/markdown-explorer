function directImageFromNode(node: ChildNode): HTMLImageElement | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node instanceof HTMLImageElement) return node;
  if (node.tagName.toLowerCase() !== 'a') return null;
  const visibleChildren = [...node.childNodes].filter(
    (child) => child.nodeType !== Node.TEXT_NODE || Boolean(child.textContent?.trim()),
  );
  if (visibleChildren.length !== 1 || !(visibleChildren[0] instanceof HTMLImageElement)) return null;
  return visibleChildren[0];
}

export function isRawHtmlImageRow(container: Element): boolean {
  if (!/^(p|div|span)$/i.test(container.tagName)) return false;
  let imageCount = 0;
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) return false;
      continue;
    }
    if (!directImageFromNode(node)) return false;
    imageCount += 1;
  }
  return imageCount >= 2;
}

export function enhanceRawHtmlImageRows(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('p, div, span').forEach((container) => {
    if (!isRawHtmlImageRow(container)) return;
    if (container.classList.contains('mdn-image-row--html')) return;
    const imageNodes = [...container.childNodes]
      .map((node) => ({ node, image: directImageFromNode(node) }))
      .filter((entry): entry is { node: ChildNode; image: HTMLImageElement } => Boolean(entry.image));
    container.classList.add('mdn-image-row', 'mdn-image-row--html');
    container.style.setProperty('--mdn-image-count', String(imageNodes.length));
    imageNodes.forEach(({ node, image }) => {
      const item = node instanceof HTMLElement ? node : image;
      item.classList.add('mdn-image-row__item');
      const authorWidth = image.getAttribute('width')?.trim();
      if (authorWidth) {
        const normalized = /^\d+(?:\.\d+)?$/.test(authorWidth) ? `${authorWidth}px` : authorWidth;
        item.style.flexBasis = normalized;
        item.style.maxWidth = normalized;
      }
      image.style.maxWidth = '100%';
      image.style.height = 'auto';
    });
  });
}
