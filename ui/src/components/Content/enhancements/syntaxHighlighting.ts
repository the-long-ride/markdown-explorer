interface HighlightLibrary {
  highlightElement(element: HTMLElement): void;
}

const CODE_SELECTOR = 'pre code:not(.is-custom-highlighted):not([data-mdn-highlighted]):not([data-mdn-render-error])';

function getPendingBlocks(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CODE_SELECTOR)].filter((block) => (
    !block.dataset.mdnHighlighted
    && !/\blanguage-(txt|text|plain|plaintext)\b/.test(block.className)
  ));
}

export async function enhanceSyntax(
  root: ParentNode,
  getLibrary: () => Promise<HighlightLibrary>,
): Promise<void> {
  if (getPendingBlocks(root).length === 0) return;

  const library = await getLibrary();
  getPendingBlocks(root).forEach((block) => {
    try {
      library.highlightElement(block);
      block.dataset.mdnHighlighted = 'true';
    } catch (error) {
      block.dataset.mdnRenderError = 'true';
      console.error('Highlight render error:', error);
    }
  });
}
