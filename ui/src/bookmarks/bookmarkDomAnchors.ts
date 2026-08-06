import type { BookmarkObjectIdentity, BookmarkTargetKind } from './types.ts';

export interface MarkdownProjection {
  readonly text: string;
  /** Source offset for every visible-text boundary. Length is text.length + 1. */
  readonly boundaries: readonly number[];
}

export interface SourceOffsetRange {
  readonly start: number;
  readonly end: number;
}

export interface BookmarkCaptureResult {
  readonly targetKind: BookmarkTargetKind;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly renderedText: string;
  readonly objectIdentity?: BookmarkObjectIdentity;
}

const FORMAT_MARKERS = ['***', '___', '**', '__', '~~', '*', '_'] as const;

function appendVisible(output: string[], boundaries: number[], value: string, sourceStart: number): void {
  for (let index = 0; index < value.length; index += 1) {
    output.push(value[index]);
    boundaries.push(sourceStart + index + 1);
  }
}

function matchingMarker(source: string, index: number): string | null {
  for (const marker of FORMAT_MARKERS) {
    if (source.startsWith(marker, index) && (source.indexOf(marker, index + marker.length) >= 0 || source.lastIndexOf(marker, index - 1) >= 0)) return marker;
  }
  return null;
}

function projectFencedBlock(source: string): MarkdownProjection | null {
  const match = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)(?:\n\1\s*)$/.exec(source);
  if (!match) return null;
  const contentStart = source.indexOf('\n') + 1;
  const output = [...match[2]];
  const boundaries = [contentStart];
  for (let index = 0; index < match[2].length; index += 1) boundaries.push(contentStart + index + 1);
  return { text: output.join(''), boundaries };
}

export function projectMarkdownSource(source: string): MarkdownProjection {
  const fenced = projectFencedBlock(source);
  if (fenced) return fenced;
  const output: string[] = [];
  const boundaries: number[] = [0];
  let index = 0;
  while (index < source.length) {
    const lineStart = index === 0 || source[index - 1] === '\n';
    if (lineStart) {
      const prefix = /^(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/.exec(source.slice(index));
      if (prefix) {
        index += prefix[0].length;
        boundaries[boundaries.length - 1] = index;
        continue;
      }
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(source.slice(index));
    if (image) {
      appendVisible(output, boundaries, image[1], index + 2);
      index += image[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(source.slice(index));
    if (link) {
      appendVisible(output, boundaries, link[1], index + 1);
      index += link[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const inlineCode = /^(`+)([\s\S]*?)\1/.exec(source.slice(index));
    if (inlineCode) {
      const content = inlineCode[2].replace(/[ \t]*\n[ \t]*/g, '');
      appendVisible(output, boundaries, content, index + inlineCode[1].length);
      index += inlineCode[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const parenMath = /^\\\(([\s\S]+?)\\\)/.exec(source.slice(index));
    if (parenMath) {
      appendVisible(output, boundaries, parenMath[1], index + 2);
      index += parenMath[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const dollarMath = /^\$([^\n$]+?)\$/.exec(source.slice(index));
    if (dollarMath) {
      appendVisible(output, boundaries, dollarMath[1], index + 1);
      index += dollarMath[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const htmlTag = /^<[^>]+>/.exec(source.slice(index));
    if (htmlTag) {
      index += htmlTag[0].length;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    const marker = matchingMarker(source, index);
    if (marker) {
      const markerStart = index;
      const opening = source.indexOf(marker, index + marker.length) >= 0;
      index += marker.length;
      boundaries[boundaries.length - 1] = opening ? markerStart : index;
      continue;
    }
    if (source[index] === '\\' && index + 1 < source.length) {
      appendVisible(output, boundaries, source[index + 1], index + 1);
      index += 2;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    if (source[index] === '\n') {
      if (output.length === 0 || output[output.length - 1] !== ' ') appendVisible(output, boundaries, ' ', index);
      index += 1;
      boundaries[boundaries.length - 1] = index;
      continue;
    }
    appendVisible(output, boundaries, source[index], index);
    index += 1;
  }
  return { text: output.join(''), boundaries };
}

function expandFormatting(source: string, range: SourceOffsetRange): SourceOffsetRange {
  let { start, end } = range;
  let changed = true;
  while (changed) {
    changed = false;
    for (const marker of ['***', '___', '**', '__', '~~', '`', '$', '*', '_']) {
      if (source.slice(Math.max(0, start - marker.length), start) === marker && source.slice(end, end + marker.length) === marker) {
        start -= marker.length;
        end += marker.length;
        changed = true;
        break;
      }
    }
    if (source.slice(Math.max(0, start - 2), start) === '\\(' && source.slice(end, end + 2) === '\\)') {
      start -= 2;
      end += 2;
      changed = true;
    }
  }
  return { start, end };
}

export function mapRenderedOffsetsToSource(source: string, renderedStart: number, renderedEnd: number): SourceOffsetRange {
  const projection = projectMarkdownSource(source);
  const startIndex = Math.max(0, Math.min(projection.text.length, Math.floor(renderedStart)));
  const endIndex = Math.max(startIndex, Math.min(projection.text.length, Math.floor(renderedEnd)));
  const start = projection.boundaries[startIndex] ?? 0;
  const end = projection.boundaries[endIndex] ?? source.length;
  return expandFormatting(source, { start, end });
}

interface LocatedObject extends SourceOffsetRange {
  readonly renderedText: string;
}

function collectMatches(source: string, regex: RegExp, accept: (match: RegExpExecArray) => boolean, text: (match: RegExpExecArray) => string): LocatedObject[] {
  const result: LocatedObject[] = [];
  for (const match of source.matchAll(regex)) {
    if (!accept(match) || match.index === undefined) continue;
    result.push({ start: match.index, end: match.index + match[0].length, renderedText: text(match) });
  }
  return result;
}

function htmlAttribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

export function locateBookmarkObjectSource(
  kind: BookmarkTargetKind,
  source: string,
  identity: BookmarkObjectIdentity = {},
  occurrence = 0,
): LocatedObject | null {
  let matches: LocatedObject[] = [];
  if (kind === 'mermaid') {
    matches = collectMatches(source, /(`{3,}|~{3,})\s*mermaid[^\n]*\n([\s\S]*?)\n\1/g, (match) => !identity.mermaidSource || match[2].trim() === identity.mermaidSource.trim(), (match) => match[2].trim());
  } else if (kind === 'image') {
    matches = collectMatches(source, /!\[([^\]]*)\]\(([^)]+)\)/g, (match) => (!identity.alt || match[1] === identity.alt) && (!identity.url || match[2] === identity.url), (match) => match[1] || match[2]);
    matches.push(...collectMatches(source, /<img\b[^>]*>/gi, (match) => {
      const url = htmlAttribute(match[0], 'src');
      const alt = htmlAttribute(match[0], 'alt');
      return (!identity.alt || alt === identity.alt) && (!identity.url || url === identity.url);
    }, (match) => htmlAttribute(match[0], 'alt') || htmlAttribute(match[0], 'src')));
    matches.sort((left, right) => left.start - right.start);
  } else if (kind === 'link') {
    matches = collectMatches(source, /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (match) => (!identity.label || match[1] === identity.label) && (!identity.url || match[2] === identity.url), (match) => match[1]);
    matches.push(...collectMatches(source, /<a\b[^>]*>[\s\S]*?<\/a>/gi, (match) => {
      const url = htmlAttribute(match[0], 'href');
      const label = stripHtml(match[0].replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, ''));
      return (!identity.label || label === identity.label) && (!identity.url || url === identity.url);
    }, (match) => stripHtml(match[0].replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '')) || htmlAttribute(match[0], 'href')));
    matches.sort((left, right) => left.start - right.start);
    if (matches.length === 0 && identity.url) {
      matches = collectMatches(source, /https?:\/\/[^\s<>"')]+/g, (match) => match[0] === identity.url, (match) => match[0]);
    }
  } else if (kind === 'math') {
    matches = collectMatches(source, /\\\(([\s\S]+?)\\\)|\$([^\n$]+?)\$/g, (match) => !identity.mathSource || (match[1] ?? match[2] ?? '').trim() === identity.mathSource.trim(), (match) => (match[1] ?? match[2] ?? '').trim());
    const display = collectMatches(source, /\$\$\s*\n?([\s\S]*?)\n?\$\$|\\\[\s*\n?([\s\S]*?)\n?\\\]/g, (match) => !identity.mathSource || (match[1] ?? match[2] ?? '').trim() === identity.mathSource.trim(), (match) => (match[1] ?? match[2] ?? '').trim());
    matches.push(...display);
    matches.sort((left, right) => left.start - right.start);
  } else if (kind === 'code') {
    matches = collectMatches(source, /(`+)([\s\S]*?)\1/g, () => true, (match) => match[2].trim());
  }
  return matches[Math.max(0, Math.floor(occurrence))] ?? null;
}

function bookmarkObjectLabel(
  kind: BookmarkTargetKind,
  identity: BookmarkObjectIdentity,
  renderedText: string,
  locatedText: string,
): string {
  return renderedText.trim()
    || locatedText.trim()
    || identity.alt
    || identity.label
    || identity.mathSource
    || identity.mermaidSource
    || identity.url
    || kind;
}

export function captureBookmarkObjectFromSource(
  kind: BookmarkTargetKind,
  source: string,
  identity: BookmarkObjectIdentity = {},
  occurrence = 0,
  renderedText = '',
): BookmarkCaptureResult | null {
  const located = locateBookmarkObjectSource(kind, source, identity, occurrence);
  if (!located || located.end <= located.start || !source.slice(located.start, located.end).trim()) return null;
  return {
    targetKind: kind,
    sourceStart: located.start,
    sourceEnd: located.end,
    renderedText: bookmarkObjectLabel(kind, identity, renderedText, located.renderedText),
    objectIdentity: identity,
  };
}

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}

function sourceRoot(node: Node, body: HTMLElement): HTMLElement | null {
  const element = elementForNode(node);
  const root = element?.closest<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]') ?? null;
  return root && body.contains(root) ? root : null;
}

function numericAttribute(element: Element, name: string): number | null {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function renderedOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function identityFromElement(element: Element): BookmarkObjectIdentity {
  const decode = (name: string) => {
    const value = element.getAttribute(name) ?? '';
    try { return decodeURIComponent(value); } catch { return value; }
  };
  return {
    mathSource: decode('data-mdn-math-source') || undefined,
    mermaidSource: decode('data-mdn-mermaid-source') || undefined,
    url: decode('data-mdn-bookmark-url') || undefined,
    label: decode('data-mdn-bookmark-label') || undefined,
    alt: decode('data-mdn-bookmark-alt') || undefined,
  };
}

function objectOccurrence(element: Element, root: Element, kind: BookmarkTargetKind, identity: BookmarkObjectIdentity): number {
  const selector = `[data-mdn-bookmark-kind="${kind}"]`;
  const candidates = [
    ...(root.matches(selector) ? [root] : []),
    ...root.querySelectorAll(selector),
  ].filter((candidate) => {
    const other = identityFromElement(candidate);
    return (!identity.url || other.url === identity.url)
      && (!identity.label || other.label === identity.label)
      && (!identity.alt || other.alt === identity.alt)
      && (!identity.mathSource || other.mathSource === identity.mathSource)
      && (!identity.mermaidSource || other.mermaidSource === identity.mermaidSource);
  });
  return Math.max(0, candidates.indexOf(element));
}

export function captureDomBookmarkTarget(body: HTMLElement, target: Range | Element, source: string): BookmarkCaptureResult | null {
  if ('startContainer' in target) {
    if (target.collapsed) return null;
    const startRoot = sourceRoot(target.startContainer, body);
    const endRoot = sourceRoot(target.endContainer, body);
    if (!startRoot || !endRoot) return null;
    const startBase = numericAttribute(startRoot, 'data-mdn-source-start');
    const startEnd = numericAttribute(startRoot, 'data-mdn-source-end');
    const endBase = numericAttribute(endRoot, 'data-mdn-source-start');
    const endEnd = numericAttribute(endRoot, 'data-mdn-source-end');
    if (startBase === null || startEnd === null || endBase === null || endEnd === null) return null;
    const startMapped = mapRenderedOffsetsToSource(source.slice(startBase, startEnd), renderedOffset(startRoot, target.startContainer, target.startOffset), Number.MAX_SAFE_INTEGER);
    const endMapped = mapRenderedOffsetsToSource(source.slice(endBase, endEnd), 0, renderedOffset(endRoot, target.endContainer, target.endOffset));
    const sourceStart = startBase + startMapped.start;
    const sourceEnd = endBase + endMapped.end;
    const renderedText = target.toString().trim();
    return renderedText && sourceEnd > sourceStart ? { targetKind: 'text', sourceStart, sourceEnd, renderedText } : null;
  }

  const object = target.closest<HTMLElement>('[data-mdn-bookmark-kind]');
  if (!object || !body.contains(object)) return null;
  const kind = object.dataset.mdnBookmarkKind as BookmarkTargetKind;
  if (!['code', 'math', 'mermaid', 'image', 'link'].includes(kind)) return null;
  const directStart = numericAttribute(object, 'data-mdn-source-start');
  const directEnd = numericAttribute(object, 'data-mdn-source-end');
  const identity = identityFromElement(object);
  const renderedText = object.textContent?.trim() ?? '';
  if (directStart !== null && directEnd !== null && directEnd <= source.length) {
    const fragment = source.slice(directStart, directEnd);
    if (directEnd > directStart && fragment.trim()) {
      return {
        targetKind: kind,
        sourceStart: directStart,
        sourceEnd: directEnd,
        renderedText: bookmarkObjectLabel(kind, identity, renderedText, fragment),
        objectIdentity: identity,
      };
    }
  }

  const root = sourceRoot(object, body);
  if (root) {
    const rootStart = numericAttribute(root, 'data-mdn-source-start');
    const rootEnd = numericAttribute(root, 'data-mdn-source-end');
    if (rootStart !== null && rootEnd !== null && rootEnd <= source.length) {
      const local = captureBookmarkObjectFromSource(
        kind,
        source.slice(rootStart, rootEnd),
        identity,
        objectOccurrence(object, root, kind, identity),
        renderedText,
      );
      if (local) {
        return {
          ...local,
          sourceStart: rootStart + local.sourceStart,
          sourceEnd: rootStart + local.sourceEnd,
        };
      }
    }
  }

  return captureBookmarkObjectFromSource(
    kind,
    source,
    identity,
    objectOccurrence(object, body, kind, identity),
    renderedText,
  );
}
