import type { MdFile } from '../../ui/src/types';

export type WebNavigationResult =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'file'; readonly filePath: string }
  | { readonly kind: 'notFound'; readonly href: string };

function decodeNavigationHref(rawHref: string): string {
  const withoutFragment = rawHref.split('#', 1)[0].split('?', 1)[0].trim();
  if (!withoutFragment) return '';
  try {
    return decodeURIComponent(withoutFragment).replace(/\\/g, '/').trim();
  } catch {
    return withoutFragment.replace(/\\/g, '/').trim();
  }
}

export function resolveWebNavigationTarget(
  rawPath: string | null | undefined,
  currentFile: string | null | undefined,
  flatList: readonly MdFile[],
): WebNavigationResult {
  const raw = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (!raw) return { kind: 'welcome' };

  if (raw.startsWith('#') || raw.startsWith('?')) {
    return currentFile ? { kind: 'file', filePath: currentFile } : { kind: 'welcome' };
  }

  const decoded = decodeNavigationHref(raw);
  if (!decoded) {
    return currentFile ? { kind: 'file', filePath: currentFile } : { kind: 'welcome' };
  }

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(decoded)) {
    return { kind: 'notFound', href: decoded };
  }

  const normalizedCurrent = (currentFile ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = decoded.startsWith('/')
    ? []
    : normalizedCurrent.split('/').slice(0, -1).filter(Boolean);

  for (const segment of decoded.replace(/^\/+/, '').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return { kind: 'notFound', href: decoded };
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  const candidate = parts.join('/');
  if (!candidate) return { kind: 'notFound', href: decoded };

  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '');
  const exact = flatList.find(
    (file) => normalize(file.relativePath) === candidate || normalize(file.fsPath) === candidate,
  );
  if (exact) return { kind: 'file', filePath: exact.relativePath };

  const candidateLower = candidate.toLowerCase();
  const caseInsensitive = flatList.find(
    (file) =>
      normalize(file.relativePath).toLowerCase() === candidateLower ||
      normalize(file.fsPath).toLowerCase() === candidateLower,
  );
  if (caseInsensitive) return { kind: 'file', filePath: caseInsensitive.relativePath };

  return { kind: 'notFound', href: candidate };
}

export async function executeWebNavigation(
  rawPath: string | null | undefined,
  currentFile: string | null | undefined,
  flatList: readonly MdFile[],
  callbacks: {
    setCurrentFile: (path: string | null) => void;
    send: (message: unknown) => void;
    openFile: (filePath: string) => Promise<void>;
  },
): Promise<void> {
  const resolution = resolveWebNavigationTarget(rawPath, currentFile, flatList);
  if (resolution.kind === 'welcome') {
    callbacks.setCurrentFile(null);
    callbacks.send({
      command: 'renderContent',
      html: '',
      markdownSource: '',
      frontmatter: {},
      toc: [],
      filePath: '',
      relativePath: 'Welcome Page',
      title: 'Welcome',
      fileList: flatList,
      previewInfo: null,
    });
    return;
  }
  if (resolution.kind === 'notFound') {
    callbacks.send({ command: 'navNotFound', href: resolution.href });
    return;
  }
  callbacks.setCurrentFile(resolution.filePath);
  await callbacks.openFile(resolution.filePath);
}
