export interface MarkdownSourceRange {
  readonly start: number;
  readonly end: number;
}

function isValidRange(range: MarkdownSourceRange, sourceLength: number): boolean {
  return Number.isInteger(range.start)
    && Number.isInteger(range.end)
    && range.start >= 0
    && range.end >= range.start
    && range.end <= sourceLength;
}

export function readEditableRange(
  element: Element,
  sourceLength: number,
): MarkdownSourceRange | null {
  const startAttr = element.getAttribute('data-mdn-source-start');
  const endAttr = element.getAttribute('data-mdn-source-end');
  if (startAttr === null || endAttr === null) return null;

  const range = {
    start: Number(startAttr),
    end: Number(endAttr),
  };
  return isValidRange(range, sourceLength) ? range : null;
}

export function replaceSourceRange(
  source: string,
  range: MarkdownSourceRange,
  replacement: string,
): string {
  if (!isValidRange(range, source.length)) {
    throw new Error('Invalid Markdown source range');
  }
  return source.slice(0, range.start) + replacement + source.slice(range.end);
}
