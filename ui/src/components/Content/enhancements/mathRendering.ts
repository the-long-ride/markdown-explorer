interface KatexLibrary {
  render(
    tex: string,
    element: HTMLElement,
    options: {
      displayMode: boolean;
      throwOnError: boolean;
      strict: boolean;
      trust: boolean;
      output: 'html';
    },
  ): void;
}

const MATH_SELECTOR = '.mdn-math[data-math]:not(.is-rendered):not([data-mdn-render-error])';

function getPendingMath(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(MATH_SELECTOR)]
    .filter((element) => !element.classList.contains('is-rendered'));
}

export async function enhanceMath(
  root: ParentNode,
  getLibrary: () => Promise<KatexLibrary>,
): Promise<void> {
  if (getPendingMath(root).length === 0) return;

  const katex = await getLibrary();
  getPendingMath(root).forEach((element) => {
    const raw = element.dataset.math;
    if (!raw) return;
    try {
      katex.render(decodeURIComponent(raw), element, {
        displayMode: element.classList.contains('mdn-math-block'),
        throwOnError: false,
        strict: false,
        trust: false,
        output: 'html',
      });
      element.classList.add('is-rendered');
    } catch (error) {
      element.dataset.mdnRenderError = 'true';
      console.error('KaTeX render error:', error);
    }
  });
}
