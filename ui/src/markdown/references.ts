import { parse, type BlockToken } from './parser.ts';
import { parseWikiLink, type WikiLinkToken } from './wikiLinks.ts';

export type DocumentReferenceKind =
  | 'wiki-link'
  | 'wiki-embed'
  | 'link'
  | 'media'
  | 'html-link'
  | 'html-media';

export interface DocumentReference {
  readonly kind: DocumentReferenceKind;
  readonly target: string;
  readonly fragment?: string;
  readonly label?: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly remote: boolean;
}

export interface DynamicDocumentReference {
  readonly attribute: 'href' | 'src';
  readonly expression: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface ExtractedDocumentReferences {
  readonly references: DocumentReference[];
  readonly dynamicReferences: DynamicDocumentReference[];
  readonly tags: string[];
}

interface SourceRange {
  readonly start: number;
  readonly end: number;
}

function overlaps(ranges: readonly SourceRange[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function codeRanges(source: string, tokens?: readonly BlockToken[]): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (const token of tokens ?? parse(source, true).tokens) {
    if (token.type !== 'code' || token.sourceStart === undefined || token.sourceEnd === undefined) continue;
    ranges.push({ start: token.sourceStart, end: token.sourceEnd });
  }
  return ranges;
}

function inlineCodeRanges(source: string, blocked: readonly SourceRange[]): SourceRange[] {
  const ranges: SourceRange[] = [];
  const pattern = /(`+)([^\n]*?)\1/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!overlaps(blocked, start, end)) ranges.push({ start, end });
  }
  return ranges;
}

function htmlTagRanges(source: string, blocked: readonly SourceRange[]): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (const match of source.matchAll(/<[^>]+>/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!overlaps(blocked, start, end)) ranges.push({ start, end });
  }
  return ranges;
}

function decodeFragment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeDestination(rawValue: string): { target: string; fragment?: string; remote: boolean } {
  let value = rawValue.trim();
  if (value.startsWith('<') && value.endsWith('>')) value = value.slice(1, -1);

  const hashIndex = value.indexOf('#');
  const fragment = decodeFragment(hashIndex >= 0 ? value.slice(hashIndex + 1) : undefined);
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf('?');
  const target = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  return {
    target,
    ...(fragment ? { fragment } : {}),
    remote: /^https?:\/\//i.test(target),
  };
}

function wikiReference(token: WikiLinkToken): DocumentReference {
  return {
    kind: token.kind === 'embed' ? 'wiki-embed' : 'wiki-link',
    target: token.target,
    ...(token.fragment ? { fragment: decodeFragment(token.fragment) } : {}),
    ...(token.label ? { label: token.label } : {}),
    sourceStart: token.sourceStart,
    sourceEnd: token.sourceEnd,
    remote: /^https?:\/\//i.test(token.target),
  };
}

function markdownReferences(
  source: string,
  blocked: readonly SourceRange[],
): { references: DocumentReference[]; destinationRanges: SourceRange[] } {
  const references: DocumentReference[] = [];
  const destinationRanges: SourceRange[] = [];
  const pattern = /(!?)\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(blocked, start, end)) continue;
    const rawDestination = match[3];
    const destinationOffset = match[0].indexOf(rawDestination);
    destinationRanges.push({
      start: start + destinationOffset,
      end: start + destinationOffset + rawDestination.length,
    });
    const normalized = normalizeDestination(rawDestination);
    references.push({
      kind: match[1] ? 'media' : 'link',
      target: normalized.target,
      ...(normalized.fragment ? { fragment: normalized.fragment } : {}),
      ...(match[2] ? { label: match[2] } : {}),
      sourceStart: start,
      sourceEnd: end,
      remote: normalized.remote,
    });
  }
  return { references, destinationRanges };
}

function htmlReferences(
  source: string,
  blocked: readonly SourceRange[],
): { references: DocumentReference[]; dynamicReferences: DynamicDocumentReference[]; tagRanges: SourceRange[] } {
  const references: DocumentReference[] = [];
  const dynamicReferences: DynamicDocumentReference[] = [];
  const tagRanges = htmlTagRanges(source, blocked);

  for (const range of tagRanges) {
    const tag = source.slice(range.start, range.end);
    const staticPattern = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    for (const match of tag.matchAll(staticPattern)) {
      const attribute = match[1].toLowerCase() as 'href' | 'src';
      const rawValue = match[2] ?? match[3] ?? '';
      const normalized = normalizeDestination(rawValue);
      const localStart = match.index ?? 0;
      references.push({
        kind: attribute === 'src' ? 'html-media' : 'html-link',
        target: normalized.target,
        ...(normalized.fragment ? { fragment: normalized.fragment } : {}),
        sourceStart: range.start + localStart,
        sourceEnd: range.start + localStart + match[0].length,
        remote: normalized.remote,
      });
    }

    const dynamicPattern = /\b(href|src)\s*=\s*\{([^}]*)\}/gi;
    for (const match of tag.matchAll(dynamicPattern)) {
      const localStart = match.index ?? 0;
      dynamicReferences.push({
        attribute: match[1].toLowerCase() as 'href' | 'src',
        expression: match[2].trim(),
        sourceStart: range.start + localStart,
        sourceEnd: range.start + localStart + match[0].length,
      });
    }
  }

  return { references, dynamicReferences, tagRanges };
}

function wikiReferences(source: string, blocked: readonly SourceRange[]): DocumentReference[] {
  const references: DocumentReference[] = [];
  const pattern = /!?\[\[(?:\\.|[^\]])*\]\]/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(blocked, start, end)) continue;
    const token = parseWikiLink(match[0], start);
    if (!('kind' in token)) continue;
    references.push(wikiReference(token));
  }
  return references;
}

function proseTags(source: string, blocked: readonly SourceRange[]): string[] {
  const matches: Array<{ value: string; start: number }> = [];
  const pattern = /(^|[\s([{>])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gmu;
  for (const match of source.matchAll(pattern)) {
    const prefix = match[1] ?? '';
    const start = (match.index ?? 0) + prefix.length;
    const end = start + 1 + match[2].length;
    if (overlaps(blocked, start, end)) continue;
    if (start > 0 && source[start - 1] === '\\') continue;
    matches.push({ value: match[2], start });
  }

  matches.sort((a, b) => a.start - b.start);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const match of matches) {
    if (seen.has(match.value)) continue;
    seen.add(match.value);
    tags.push(match.value);
  }
  return tags;
}

/**
 * Extract document references using an already-parsed token stream when available.
 * Passing tokens lets Insights perform one structural Markdown parse per document revision.
 */
export function extractDocumentReferences(
  source: string,
  tokens?: readonly BlockToken[],
): ExtractedDocumentReferences {
  const fencedCode = codeRanges(source, tokens);
  const inlineCode = inlineCodeRanges(source, fencedCode);
  const baseBlocked = [...fencedCode, ...inlineCode];
  const markdown = markdownReferences(source, baseBlocked);
  const html = htmlReferences(source, baseBlocked);
  const proseBlocked = [...baseBlocked, ...markdown.destinationRanges, ...html.tagRanges];
  const wiki = wikiReferences(source, proseBlocked);

  const references = [...wiki, ...markdown.references, ...html.references]
    .sort((a, b) => a.sourceStart - b.sourceStart || a.sourceEnd - b.sourceEnd);
  const dynamicReferences = [...html.dynamicReferences]
    .sort((a, b) => a.sourceStart - b.sourceStart || a.sourceEnd - b.sourceEnd);

  return {
    references,
    dynamicReferences,
    tags: proseTags(source, proseBlocked),
  };
}
