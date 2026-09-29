/** Interactive controls whose decorative icons must never be treated as media. */
export const MEDIA_EXCLUDED_CONTROLS = 'button, [role="button"], input, select, textarea, summary';

export function isInsideMediaExcludedControl(target: Element): boolean {
  return Boolean(target.closest(MEDIA_EXCLUDED_CONTROLS));
}

/**
 * Resolves the media item (image or mermaid diagram) under `target`. Bare
 * `<svg>` icons are not media; only `<img>` and `.mdn-mermaid-wrap`/`.mermaid`
 * count, and nothing inside an interactive control does.
 */
export function findDocumentMediaTarget(
  target: Element,
  acceptImage: (img: HTMLElement) => boolean = () => true,
): HTMLElement | null {
  if (isInsideMediaExcludedControl(target)) return null;
  const img = target.closest<HTMLElement>('img');
  if (img && acceptImage(img)) return img;
  const mermaidWrap = target.closest<HTMLElement>('.mdn-mermaid-wrap, .mermaid');
  if (!mermaidWrap) return null;
  return mermaidWrap.closest<HTMLElement>('.mdn-mermaid-wrap') ?? mermaidWrap;
}
