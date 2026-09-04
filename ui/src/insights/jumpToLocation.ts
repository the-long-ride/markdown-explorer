export interface JumpLocation {
  readonly line?: number;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

function sourceRange(element: Element): { start: number; end: number } | null {
  const start = Number(element.getAttribute('data-mdn-source-start'));
  const end = Number(element.getAttribute('data-mdn-source-end'));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { start, end } : null;
}

function offsetForLine(source: string, targetLine: number): number {
  if (targetLine <= 1) return 0;
  let line = 1;
  let offset = 0;
  while (line < targetLine && offset < source.length) {
    const nextNewline = source.indexOf('\n', offset);
    if (nextNewline === -1) break;
    offset = nextNewline + 1;
    line++;
  }
  return offset;
}

export function findSourceElement(root: HTMLElement, start: number, _end = start): HTMLElement | null {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]')];
  if (!elements.length) return null;

  const withRanges = elements
    .map(element => ({ element, range: sourceRange(element) }))
    .filter((entry): entry is { element: HTMLElement; range: { start: number; end: number } } => Boolean(entry.range));

  const enclosing = withRanges
    .filter(entry => entry.range.start <= start && entry.range.end >= start)
    .sort((left, right) => (left.range.end - left.range.start) - (right.range.end - right.range.start));

  if (enclosing.length > 0) {
    return enclosing[0].element;
  }

  let closest: HTMLElement | null = null;
  let minDiff = Infinity;
  for (const entry of withRanges) {
    const diff = Math.abs(entry.range.start - start);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry.element;
    }
  }
  return closest;
}

export function expandSectionAncestors(target: HTMLElement): void {
  let parent = target.closest('.mdn-section') as HTMLElement | null;
  while (parent) {
    parent.dataset.expanded = 'true';
    parent = (parent.parentElement?.closest('.mdn-section') as HTMLElement | null) ?? null;
  }
}

export function scrollAndHighlightElement(element: HTMLElement): void {
  expandSectionAncestors(element);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
  element.classList.add('mdn-lint-jump-target');
  window.setTimeout(() => {
    element.classList.remove('mdn-lint-jump-target');
  }, 2500);
}

export function jumpToLintLocation(
  targetPath: string,
  location: JumpLocation,
  maxAttempts = 15,
): () => void {
  let attempts = 0;
  let timer = 0;

  const tryJump = (): boolean => {
    const body = document.getElementById('mdBody');
    if (!(body instanceof HTMLElement)) return false;

    const currentDoc = body.dataset.mdnSourceDocumentPath ?? '';
    if (currentDoc) {
      const normCurrent = currentDoc.replace(/\\/g, '/').toLowerCase();
      const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
      if (!normTarget.endsWith(normCurrent) && !normCurrent.endsWith(normTarget)) {
        return false;
      }
    }

    let start = location.sourceStart;
    if (start === undefined && location.line !== undefined) {
      const text = body.textContent || '';
      start = offsetForLine(text, location.line);
    }
    if (start === undefined) start = 0;

    const targetEl = findSourceElement(body, start, location.sourceEnd ?? start);
    if (!targetEl) return false;

    const specificTarget = (targetEl.querySelector('img, svg, .mermaid, a') as HTMLElement | null) ?? targetEl;
    scrollAndHighlightElement(specificTarget);
    return true;
  };

  if (tryJump()) return () => {};

  timer = window.setInterval(() => {
    attempts++;
    if (tryJump() || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, 100);

  return () => window.clearInterval(timer);
}
