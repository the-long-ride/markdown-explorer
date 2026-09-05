import type { BlockToken } from './parser.ts';
import { slugify } from './utils.ts';

export interface DocumentAnchorIndex {
  readonly anchors: Set<string>;
  readonly dynamic: string[];
}

export function createHeadingIdAllocator(): (text: string) => string {
  const counts = new Map<string, number>();
  return (text: string): string => {
    const baseId = slugify(text);
    const duplicateIndex = counts.get(baseId) ?? 0;
    counts.set(baseId, duplicateIndex + 1);
    return duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex}`;
  };
}

function unescapeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function extractStaticAnchors(source: string): DocumentAnchorIndex {
  const anchors = new Set<string>();
  const dynamic: string[] = [];
  const tagPattern = /<[^>]+>/g;

  for (const tagMatch of source.matchAll(tagPattern)) {
    const tag = tagMatch[0];
    const staticPattern = /\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    for (const attribute of tag.matchAll(staticPattern)) {
      const value = attribute[1] ?? attribute[2] ?? '';
      if (value) anchors.add(unescapeHtmlAttribute(value));
    }

    const dynamicPattern = /\b(?:id|name)\s*=\s*\{[^}]*\}/g;
    for (const attribute of tag.matchAll(dynamicPattern)) {
      dynamic.push(attribute[0]);
    }
  }

  return { anchors, dynamic };
}

export function buildDocumentAnchorIndex(
  tokens: readonly BlockToken[],
  staticHtmlSource = '',
): DocumentAnchorIndex {
  const anchors = new Set<string>();
  const nextHeadingId = createHeadingIdAllocator();

  for (const token of tokens) {
    if (token.type !== 'heading') continue;
    anchors.add(nextHeadingId(token.text));
  }

  const staticAnchors = extractStaticAnchors(staticHtmlSource);
  for (const anchor of staticAnchors.anchors) anchors.add(anchor);
  return { anchors, dynamic: staticAnchors.dynamic };
}
