import { slugify } from './utils.ts';

export interface WikiLinkToken {
  readonly kind: 'link' | 'embed';
  readonly raw: string;
  readonly target: string;
  readonly fragment?: string;
  readonly label?: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface WikiParseFailure {
  readonly ok: false;
  readonly raw: string;
  readonly reason: 'malformed' | 'empty';
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface WikiDocumentDescriptor {
  readonly path: string;
  readonly canonicalPath?: string;
  readonly title?: string;
  readonly aliases: readonly string[];
  readonly anchors?: readonly string[];
}

export interface WikiResolverContext {
  readonly sourceDocumentPath: string;
  readonly documents: readonly WikiDocumentDescriptor[];
}

export type WikiResolution =
  | {
      readonly status: 'resolved';
      readonly documentPath: string;
      readonly canonicalPath: string;
      readonly fragment?: string;
      readonly caseMismatch: boolean;
    }
  | { readonly status: 'ambiguous'; readonly candidates: readonly string[] }
  | { readonly status: 'missing' | 'outside-workspace' | 'invalid-anchor' };

function separatorIndex(value: string, separator: '#' | '|'): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== separator) continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return index;
  }
  return -1;
}

function decodeWikiPart(value: string, pathPart = false): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\') {
      result += char;
      continue;
    }
    const next = value[index + 1];
    if (next === '#' || next === '|' || next === '\\') {
      result += next;
      index += 1;
      continue;
    }
    if (pathPart) result += '/';
    else if (next !== undefined) {
      result += next;
      index += 1;
    }
  }
  return result.trim();
}

export function parseWikiLink(raw: string, offset = 0): WikiLinkToken | WikiParseFailure {
  const kind = raw.startsWith('![[') ? 'embed' : raw.startsWith('[[') ? 'link' : null;
  const openerLength = kind === 'embed' ? 3 : 2;
  if (!kind || !raw.endsWith(']]') || raw.length < openerLength + 2) {
    return { ok: false, raw, reason: 'malformed', sourceStart: offset, sourceEnd: offset + raw.length };
  }

  const inner = raw.slice(openerLength, -2);
  const labelIndex = separatorIndex(inner, '|');
  const destination = labelIndex >= 0 ? inner.slice(0, labelIndex) : inner;
  const rawLabel = labelIndex >= 0 ? inner.slice(labelIndex + 1) : undefined;
  const fragmentIndex = separatorIndex(destination, '#');
  const rawTarget = fragmentIndex >= 0 ? destination.slice(0, fragmentIndex) : destination;
  const rawFragment = fragmentIndex >= 0 ? destination.slice(fragmentIndex + 1) : undefined;

  const target = decodeWikiPart(rawTarget, true);
  const fragment = rawFragment === undefined ? undefined : decodeWikiPart(rawFragment);
  const label = rawLabel === undefined ? undefined : decodeWikiPart(rawLabel);
  if (!target && !fragment) {
    return { ok: false, raw, reason: 'empty', sourceStart: offset, sourceEnd: offset + raw.length };
  }

  return {
    kind,
    raw,
    target,
    ...(fragment ? { fragment } : {}),
    ...(label ? { label } : {}),
    sourceStart: offset,
    sourceEnd: offset + raw.length,
  };
}

function isFailure(token: WikiLinkToken | WikiParseFailure): token is WikiParseFailure {
  return 'ok' in token && token.ok === false;
}

function normalizedText(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('en-US');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').normalize('NFC');
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? '' : normalized.slice(0, slash);
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? normalized : normalized.slice(slash + 1);
}

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

function stem(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

function resolveRelative(sourcePath: string, target: string): { path?: string; outside: boolean } {
  const absoluteFromWorkspace = target.startsWith('/');
  const baseSegments = absoluteFromWorkspace ? [] : dirname(sourcePath).split('/').filter(Boolean);
  const targetSegments = normalizePath(target).replace(/^\//, '').split('/');
  const segments = [...baseSegments];

  for (const segment of targetSegments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return { outside: true };
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return { path: segments.join('/'), outside: false };
}

function indexDocumentPriority(path: string): number {
  switch (basename(path).toLowerCase()) {
    case 'readme.md': return 0;
    case 'readme.mdx': return 1;
    case 'index.md': return 2;
    case 'index.mdx': return 3;
    default: return 10;
  }
}

function sortedUnique(documents: readonly WikiDocumentDescriptor[]): WikiDocumentDescriptor[] {
  const byCanonical = new Map<string, WikiDocumentDescriptor>();
  for (const document of documents) {
    const canonical = normalizePath(document.canonicalPath ?? document.path);
    if (!byCanonical.has(normalizedText(canonical))) byCanonical.set(normalizedText(canonical), document);
  }
  return [...byCanonical.values()].sort((a, b) => {
    const aPath = normalizePath(a.canonicalPath ?? a.path);
    const bPath = normalizePath(b.canonicalPath ?? b.path);
    const priorityDifference = indexDocumentPriority(aPath) - indexDocumentPriority(bPath);
    return priorityDifference || aPath.localeCompare(bPath);
  });
}

function resolutionFor(
  candidates: readonly WikiDocumentDescriptor[],
  token: WikiLinkToken,
  matchedValue?: string,
): WikiResolution {
  const unique = sortedUnique(candidates);
  if (unique.length === 0) return { status: 'missing' };
  if (unique.length > 1) {
    return { status: 'ambiguous', candidates: unique.map((item) => normalizePath(item.canonicalPath ?? item.path)) };
  }

  const document = unique[0];
  const canonicalPath = normalizePath(document.canonicalPath ?? document.path);
  let fragment: string | undefined;
  if (token.fragment) {
    let decoded = token.fragment;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Keep the literal fragment when percent escapes are malformed; anchor validation will fail.
    }
    const slug = slugify(decoded);
    const anchors = document.anchors ?? [];
    const matchedAnchor = anchors.find((anchor) =>
      normalizedText(anchor) === normalizedText(slug) || normalizedText(anchor) === normalizedText(decoded),
    );
    if (!matchedAnchor) return { status: 'invalid-anchor' };
    fragment = matchedAnchor;
  }

  const queryValue = matchedValue ?? token.target;
  const caseMismatch = Boolean(queryValue) && queryValue.normalize('NFC') !== (matchedValue ?? queryValue).normalize('NFC')
    ? true
    : Boolean(queryValue) && normalizedText(queryValue) === normalizedText(matchedValue ?? queryValue)
      && queryValue.normalize('NFC') !== (matchedValue ?? queryValue).normalize('NFC');

  return {
    status: 'resolved',
    documentPath: normalizePath(document.path),
    canonicalPath,
    ...(fragment ? { fragment } : {}),
    caseMismatch,
  };
}

function resolvedWithCase(
  candidates: readonly { document: WikiDocumentDescriptor; matched: string }[],
  token: WikiLinkToken,
): WikiResolution {
  const documents = candidates.map(({ document }) => document);
  const result = resolutionFor(documents, token);
  if (result.status !== 'resolved') return result;
  const selected = candidates.find(({ document }) =>
    normalizePath(document.canonicalPath ?? document.path) === result.canonicalPath,
  );
  const matched = selected?.matched ?? token.target;
  return {
    ...result,
    caseMismatch: normalizedText(token.target) === normalizedText(matched)
      ? token.target.normalize('NFC') !== matched.normalize('NFC')
      : false,
  };
}

export function resolveWikiLink(
  token: WikiLinkToken | WikiParseFailure,
  context: WikiResolverContext,
): WikiResolution {
  if (isFailure(token)) return { status: 'missing' };
  const documents = context.documents;

  if (!token.target) {
    const current = documents.filter((document) =>
      normalizedText(normalizePath(document.canonicalPath ?? document.path)) === normalizedText(normalizePath(context.sourceDocumentPath)),
    );
    return resolutionFor(current, token, context.sourceDocumentPath);
  }

  const target = normalizePath(token.target);
  const targetExt = extension(target);
  const isExplicitPath = token.target.startsWith('.') || token.target.startsWith('/') || target.includes('/') || targetExt === '.md' || targetExt === '.mdx';

  if (isExplicitPath) {
    const resolved = resolveRelative(context.sourceDocumentPath, target);
    if (resolved.outside || !resolved.path) return { status: 'outside-workspace' };
    const requested = normalizePath(resolved.path);
    const directCandidates = documents.filter((document) =>
      normalizedText(normalizePath(document.canonicalPath ?? document.path)) === normalizedText(requested),
    );
    if (directCandidates.length > 0) {
      const result = resolutionFor(directCandidates, token);
      if (result.status === 'resolved') {
        return { ...result, caseMismatch: requested !== result.canonicalPath };
      }
      return result;
    }

    if (!targetExt) {
      const extensionCandidates = documents.filter((document) => {
        const canonical = normalizePath(document.canonicalPath ?? document.path);
        return normalizedText(canonical) === normalizedText(`${requested}.md`)
          || normalizedText(canonical) === normalizedText(`${requested}.mdx`);
      });
      if (extensionCandidates.length > 0) return resolutionFor(extensionCandidates, token);
    }
    return { status: 'missing' };
  }

  const byStem = documents
    .filter((document) => normalizedText(stem(document.path)) === normalizedText(target))
    .map((document) => ({ document, matched: stem(document.path) }));
  if (byStem.length > 0) return resolvedWithCase(byStem, token);

  const byTitle = documents
    .filter((document) => document.title && normalizedText(document.title) === normalizedText(target))
    .map((document) => ({ document, matched: document.title ?? '' }));
  if (byTitle.length > 0) return resolvedWithCase(byTitle, token);

  const byAlias = documents.flatMap((document) =>
    document.aliases
      .filter((alias) => normalizedText(alias) === normalizedText(target))
      .map((alias) => ({ document, matched: alias })),
  );
  if (byAlias.length > 0) return resolvedWithCase(byAlias, token);

  const directoryCandidates = documents.filter((document) => {
    const canonical = normalizePath(document.canonicalPath ?? document.path);
    if (normalizedText(dirname(canonical)) !== normalizedText(target)) return false;
    const name = basename(canonical).toLowerCase();
    return name === 'readme.md' || name === 'readme.mdx' || name === 'index.md' || name === 'index.mdx';
  });
  if (directoryCandidates.length > 0) return resolutionFor(directoryCandidates, token);

  return { status: 'missing' };
}
