import type { GitRevisionFile } from './contracts';

export type SnapshotLinkTarget =
  | { readonly kind: 'fragment'; readonly fragment: string }
  | { readonly kind: 'external'; readonly url: string }
  | { readonly kind: 'snapshot-file'; readonly path: string; readonly fragment: string | null }
  | { readonly kind: 'not-found'; readonly targetPath: string };

const DANGEROUS_SCHEME_RE = /^(?:javascript|data|vbscript):/i;
const EXTERNAL_SCHEME_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const INLINE_NAV_ONCLICK_RE = /\s+onclick="Nav\.go\((?:[^"\\]|\\.)*\);return false;"/g;

function normalizeRepoPath(path: string): string {
  return String(path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveSnapshotDocumentFilePath(workspacePath: string | undefined, snapshotPath: string): string {
  const normalizedSnapshot = normalizeRepoPath(snapshotPath);
  const base = String(workspacePath ?? '').trim().replace(/[\\/]+$/, '');
  if (!base) return normalizedSnapshot;
  return normalizedSnapshot ? `${base}/${normalizedSnapshot}` : base;
}

export function stripSnapshotInlineNavHandlers(html: string): string {
  if (!html) return html;
  return html.replace(INLINE_NAV_ONCLICK_RE, '');
}

function resolveRelativePathSegments(rawPath: string, currentSnapshotPath: string): string | null {
  const decoded = decodeSafe(rawPath).replace(/\\/g, '/').trim();
  if (!decoded) return null;

  const isRootRelative = decoded.startsWith('/');
  const segments = isRootRelative
    ? []
    : normalizeRepoPath(currentSnapshotPath).split('/').slice(0, -1).filter(Boolean);

  for (const segment of decoded.replace(/^\/+/, '').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.length > 0 ? segments.join('/') : null;
}

function matchRevisionFile(
  candidate: string,
  files: readonly GitRevisionFile[],
  allowWikiBasenameFallback = false,
): GitRevisionFile | null {
  const normalized = normalizeRepoPath(candidate);
  if (!normalized) return null;

  const exactCandidates = /\.[a-z0-9]+$/i.test(normalized)
    ? [normalized]
    : [normalized, `${normalized}.md`, `${normalized}.mdx`];

  for (const target of exactCandidates) {
    const exact = files.find((file) => normalizeRepoPath(file.path) === target);
    if (exact) return exact;
  }

  const lowerCandidates = exactCandidates.map((item) => item.toLowerCase());
  for (const targetLower of lowerCandidates) {
    const ci = files.find((file) => normalizeRepoPath(file.path).toLowerCase() === targetLower);
    if (ci) return ci;
  }

  if (allowWikiBasenameFallback && !normalized.includes('/')) {
    const wantedNames = new Set(lowerCandidates);
    const byBasename = files.find((file) => {
      const base = normalizeRepoPath(file.path).split('/').pop()?.toLowerCase() ?? '';
      return wantedNames.has(base);
    });
    if (byBasename) return byBasename;
  }

  return null;
}

export function resolveSnapshotLinkTarget(
  rawHref: string,
  currentSnapshotPath: string,
  files: readonly GitRevisionFile[],
  options?: { isWikiLink?: boolean },
): SnapshotLinkTarget | null {
  const trimmed = String(rawHref ?? '').trim();
  if (!trimmed || trimmed === '#' || DANGEROUS_SCHEME_RE.test(trimmed)) return null;

  if (trimmed.startsWith('#')) {
    const fragment = decodeSafe(trimmed.slice(1)).trim();
    return fragment ? { kind: 'fragment', fragment } : null;
  }

  if (EXTERNAL_SCHEME_RE.test(trimmed)) {
    return { kind: 'external', url: trimmed };
  }

  const hashIndex = trimmed.indexOf('#');
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const rawFragment = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : '';
  const fragment = rawFragment ? decodeSafe(rawFragment).trim() || null : null;
  const pathOnly = withoutHash.split('?', 1)[0].trim();

  if (!pathOnly) {
    return fragment ? { kind: 'fragment', fragment } : null;
  }

  const candidate = resolveRelativePathSegments(pathOnly, currentSnapshotPath);
  if (!candidate) {
    return { kind: 'not-found', targetPath: pathOnly };
  }

  const matched = matchRevisionFile(candidate, files, options?.isWikiLink);
  if (matched) {
    return { kind: 'snapshot-file', path: matched.path, fragment };
  }

  if (options?.isWikiLink) {
    const rootMatched = matchRevisionFile(decodeSafe(pathOnly), files, true);
    if (rootMatched) {
      return { kind: 'snapshot-file', path: rootMatched.path, fragment };
    }
  }

  return { kind: 'not-found', targetPath: candidate };
}
