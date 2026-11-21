import { unicodeIndexOf } from './unicodeSearch';

export interface SearchJumpOptions {
  readonly lineNumber?: number;
  readonly excerpt?: string;
}

export interface ResolvedSourceTarget {
  readonly normalizedSource: string;
  readonly normalizedOffset: number;
  readonly lineIndex: number;
  readonly lineText: string;
  readonly columnOffset: number;
}

export interface SourceOffsetRange {
  readonly start: number;
  readonly end: number;
}

const PIPE_TABLE_SEPARATOR_RE = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const FENCE_OPEN_RE = /^(`{3,}|~{3,})/;

export function normalizeMarkdownLineEndings(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function utf8ByteOffsetToUtf16(source: string, byteOffset: number): number {
  if (!Number.isFinite(byteOffset) || byteOffset <= 0) return 0;
  let bytes = 0;
  let index = 0;
  while (index < source.length && bytes < byteOffset) {
    const code = source.codePointAt(index)!;
    const charBytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + charBytes > byteOffset) break;
    bytes += charBytes;
    index += code > 0xffff ? 2 : 1;
  }
  return index;
}

export function rawOffsetToNormalizedOffset(rawSource: string, rawUtf16Offset: number): number {
  const clamped = Math.max(0, Math.min(rawSource.length, Math.floor(rawUtf16Offset)));
  let crCount = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (rawSource.charCodeAt(i) === 13 && rawSource.charCodeAt(i + 1) === 10) {
      crCount += 1;
    }
  }
  return Math.max(0, clamped - crCount);
}

export function findNextInText(
  text: string,
  needle: string,
  fromIndex: number,
  matchCase: boolean,
): { index: number; matchLength: number } | null {
  if (matchCase) {
    const index = text.indexOf(needle, fromIndex);
    return index < 0 ? null : { index, matchLength: needle.length };
  }
  return unicodeIndexOf(text, needle, fromIndex);
}

function findAllInText(
  text: string,
  needle: string,
  matchCase: boolean,
): Array<{ index: number; matchLength: number }> {
  const matches: Array<{ index: number; matchLength: number }> = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const hit = findNextInText(text, needle, cursor, matchCase);
    if (!hit) break;
    matches.push(hit);
    cursor = hit.index + Math.max(1, hit.matchLength);
  }
  return matches;
}

function lineBoundsAt(normalizedSource: string, targetLineIndex: number): { start: number; end: number } | null {
  if (targetLineIndex < 0) return null;
  let currentLine = 0;
  let start = 0;
  while (currentLine < targetLineIndex) {
    const nextBreak = normalizedSource.indexOf('\n', start);
    if (nextBreak < 0) return null;
    start = nextBreak + 1;
    currentLine += 1;
  }
  const endBreak = normalizedSource.indexOf('\n', start);
  return { start, end: endBreak < 0 ? normalizedSource.length : endBreak };
}

export function lineIndexAtOffset(normalizedSource: string, offset: number): number {
  const clamped = Math.max(0, Math.min(normalizedSource.length, offset));
  let line = 0;
  let pos = normalizedSource.indexOf('\n');
  while (pos >= 0 && pos < clamped) {
    line += 1;
    pos = normalizedSource.indexOf('\n', pos + 1);
  }
  return line;
}

function matchesAtOffset(
  normalizedSource: string,
  offset: number,
  needle: string,
  matchCase: boolean,
): boolean {
  if (offset < 0 || offset >= normalizedSource.length) return false;
  const window = normalizedSource.slice(offset, offset + Math.max(needle.length * 2, needle.length + 8));
  const hit = findNextInText(window, needle, 0, matchCase);
  return Boolean(hit && hit.index === 0);
}

export function candidateNormalizedOffsets(rawSource: string, matchIndex: number): number[] {
  const rawUtf16 = rawOffsetToNormalizedOffset(rawSource, matchIndex);
  const utf8Converted = rawOffsetToNormalizedOffset(rawSource, utf8ByteOffsetToUtf16(rawSource, matchIndex));
  const direct = Math.max(0, Math.floor(matchIndex));
  return Array.from(new Set([rawUtf16, utf8Converted, direct]));
}

function buildResolvedTarget(normalizedSource: string, offset: number): ResolvedSourceTarget {
  const lineIndex = lineIndexAtOffset(normalizedSource, offset);
  const bounds = lineBoundsAt(normalizedSource, lineIndex);
  return {
    normalizedSource,
    normalizedOffset: offset,
    lineIndex,
    lineText: bounds ? normalizedSource.slice(bounds.start, bounds.end) : '',
    columnOffset: bounds ? Math.max(0, offset - bounds.start) : 0,
  };
}

function pickClosestMatch(
  hits: readonly { index: number; matchLength: number }[],
  candidates: readonly number[],
  baseOffset = 0,
): { index: number; matchLength: number } {
  let picked = hits[0];
  let bestDist = Infinity;
  for (const hit of hits) {
    const absoluteOffset = baseOffset + hit.index;
    for (const candidate of candidates) {
      const dist = Math.abs(absoluteOffset - candidate);
      if (dist < bestDist) {
        bestDist = dist;
        picked = hit;
      }
    }
  }
  return picked;
}

export function resolveNormalizedSourceTarget(
  rawMarkdownSource: string | null | undefined,
  needle: string,
  matchCase: boolean,
  matchOrdinal?: number,
  matchIndex?: number,
  options?: SearchJumpOptions,
): ResolvedSourceTarget | null {
  if (!rawMarkdownSource || !needle) return null;
  const normalizedSource = normalizeMarkdownLineEndings(rawMarkdownSource);
  const hasMatchIndex = matchIndex !== undefined && Number.isFinite(matchIndex) && matchIndex >= 0;
  const hasMatchOrdinal = matchOrdinal !== undefined && Number.isFinite(matchOrdinal) && matchOrdinal >= 0;

  const rawLineNumber = options?.lineNumber;
  if (rawLineNumber !== undefined && Number.isFinite(rawLineNumber) && rawLineNumber >= 1) {
    const lineIndex = Math.floor(rawLineNumber) - 1;
    const bounds = lineBoundsAt(normalizedSource, lineIndex);
    if (bounds) {
      const lineText = normalizedSource.slice(bounds.start, bounds.end);
      const lineMatches = findAllInText(lineText, needle, matchCase);
      if (lineMatches.length === 0) {
        return { normalizedSource, normalizedOffset: bounds.start, lineIndex, lineText, columnOffset: 0 };
      }
      let picked = lineMatches[0];
      if (lineMatches.length > 1) {
        if (hasMatchIndex) {
          picked = pickClosestMatch(lineMatches, candidateNormalizedOffsets(rawMarkdownSource, matchIndex), bounds.start);
        } else if (hasMatchOrdinal) {
          const beforeCount = findAllInText(normalizedSource.slice(0, bounds.start), needle, matchCase).length;
          const localIndex = Math.max(0, Math.min(lineMatches.length - 1, Math.floor(matchOrdinal) - beforeCount));
          picked = lineMatches[localIndex];
        }
      }
      return {
        normalizedSource,
        normalizedOffset: bounds.start + picked.index,
        lineIndex,
        lineText,
        columnOffset: picked.index,
      };
    }
  }

  if (hasMatchIndex) {
    const candidates = candidateNormalizedOffsets(rawMarkdownSource, matchIndex);
    for (const candidate of candidates) {
      if (matchesAtOffset(normalizedSource, candidate, needle, matchCase)) {
        return buildResolvedTarget(normalizedSource, candidate);
      }
    }
    const allMatches = findAllInText(normalizedSource, needle, matchCase);
    if (allMatches.length > 0) {
      return buildResolvedTarget(normalizedSource, pickClosestMatch(allMatches, candidates).index);
    }
  }

  if (hasMatchOrdinal) {
    const hit = findAllInText(normalizedSource, needle, matchCase)[Math.floor(matchOrdinal)];
    if (hit) return buildResolvedTarget(normalizedSource, hit.index);
  }

  return null;
}

export function deriveMarkdownStrippedQuery(query: string): string {
  let cleaned = query.trim();
  if (!cleaned) return '';
  // Strip block-level prefixes (headings, blockquotes, lists, tasks)
  cleaned = cleaned.replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '');
  // Unwrap markdown images and links: ![alt](url) / [label](url) -> alt / label
  cleaned = cleaned.replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Unwrap angle-bracket autolinks: <https://...> -> https://...
  cleaned = cleaned.replace(/<(https?:\/\/[^>\s]+)>/gi, '$1');
  // Replace table pipe delimiters with spaces
  cleaned = cleaned.replace(/\|/g, ' ');
  // Strip inline formatting delimiters (backticks, bold/italic/strikethrough)
  cleaned = cleaned.replace(/`+/g, '');
  cleaned = cleaned.replace(/\*\*\*|___|~~|\*\*|__/g, '');
  cleaned = cleaned.replace(/(^|\s)[*_](?=\S)|(?<=\S)[*_](?=\s|$|[.,;:!?])/g, '$1');
  // Collapse whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function tokenizeContextWords(text: string): string[] {
  return text
    .replace(/[#*_[\]()`~:|<>\-+=,.;!?/\\]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

export function getElementSourceRange(element: Element): SourceOffsetRange | null {
  const startAttr = element.getAttribute('data-mdn-source-start');
  const endAttr = element.getAttribute('data-mdn-source-end');
  if (startAttr === null || endAttr === null) return null;
  const start = Number(startAttr);
  const end = Number(endAttr);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { start, end } : null;
}

export function findEnclosingSourceElement(root: HTMLElement, offset: number): HTMLElement | null {
  const candidates = [...root.querySelectorAll<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]')]
    .filter((element) => !element.parentElement?.closest('.mdn-callout-body, .mdn-list-nested'))
    .map((element) => ({ element, range: getElementSourceRange(element) }))
    .filter((entry): entry is { element: HTMLElement; range: SourceOffsetRange } => (
      Boolean(entry.range && entry.range.start <= offset && entry.range.end >= offset)
    ))
    .sort((left, right) => (left.range.end - left.range.start) - (right.range.end - right.range.start));
  return candidates[0]?.element ?? null;
}

export function findTableRowForSourceLine(
  container: HTMLElement,
  normalizedSource: string,
  blockRange: SourceOffsetRange,
  targetLineIndex: number,
): HTMLTableRowElement | null {
  if (!container.matches('.mdn-table-source, .mdn-codeblock, .mdn-table-wrap, table.mdn-table')) {
    return null;
  }
  const table = container.matches('table.mdn-table')
    ? (container as HTMLTableElement)
    : container.querySelector<HTMLTableElement>('table.mdn-table');
  if (!table) return null;
  const blockStartLine = lineIndexAtOffset(normalizedSource, blockRange.start);
  const relLine = targetLineIndex - blockStartLine;
  if (relLine < 0) return null;

  const blockText = normalizedSource.slice(blockRange.start, blockRange.end);
  const blockLines = blockText.split('\n');
  const isFencedDelimited = FENCE_OPEN_RE.test(blockLines[0]?.trim() ?? '');

  if (isFencedDelimited) {
    if (relLine === 1) return table.querySelector<HTMLTableRowElement>('thead tr');
    if (relLine >= 2) {
      const dataRows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter((r) => !r.dataset.toggle);
      return dataRows[relLine - 2] ?? null;
    }
    return null;
  }

  const hasSeparator = blockLines.length >= 2 && PIPE_TABLE_SEPARATOR_RE.test(blockLines[1] ?? '');
  if (relLine === 0) return table.querySelector<HTMLTableRowElement>('thead tr');
  if (hasSeparator && relLine === 1) return table.querySelector<HTMLTableRowElement>('thead tr');
  const rowIndex = hasSeparator ? relLine - 2 : relLine - 1;
  const dataRows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter((r) => !r.dataset.toggle);
  return rowIndex >= 0 ? (dataRows[rowIndex] ?? null) : null;
}
