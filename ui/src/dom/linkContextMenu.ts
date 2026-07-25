export type ResolvedLinkKind = 'web' | 'file' | 'fragment' | 'relative' | 'unsupported';

export interface ResolvedLink {
  raw: string;
  resolved: string;
  kind: ResolvedLinkKind;
  openable: boolean;
  copyable: boolean;
}

function pathToFileUrl(path: string): string | null {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return `file:///${encodeURI(path.replace(/\\/g, '/'))}`;
  if (path.startsWith('/')) return `file://${encodeURI(path)}`;
  return null;
}

function currentDocumentUrl(currentFile: string, pageUrl: string): string | null {
  if (!currentFile) return null;
  if (/^(https?|file):/i.test(currentFile)) return currentFile;
  const fileUrl = pathToFileUrl(currentFile);
  if (fileUrl) return fileUrl;
  try {
    return new URL(currentFile.replace(/\\/g, '/'), pageUrl).href;
  } catch {
    return null;
  }
}

function hasDangerousScheme(value: string): boolean {
  return /^(?:javascript|data|vbscript):/i.test(value.trim());
}

export function resolveRenderedLink(
  anchor: HTMLAnchorElement,
  currentFile: string,
  pageUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost/',
): ResolvedLink {
  const raw = (anchor.dataset.mdnTarget || anchor.getAttribute('href') || '').trim();
  if (!raw || hasDangerousScheme(raw)) {
    return { raw, resolved: '', kind: 'unsupported', openable: false, copyable: false };
  }

  if (raw.startsWith('#')) {
    const base = currentDocumentUrl(currentFile, pageUrl) || pageUrl.split('#')[0];
    return {
      raw,
      resolved: `${base.split('#')[0]}${raw}`,
      kind: 'fragment',
      openable: true,
      copyable: true,
    };
  }

  if (/^https?:/i.test(raw)) {
    try {
      const resolved = new URL(raw).href;
      return { raw, resolved, kind: 'web', openable: true, copyable: true };
    } catch {
      return { raw, resolved: raw, kind: 'unsupported', openable: false, copyable: true };
    }
  }

  if (/^file:/i.test(raw)) {
    return { raw, resolved: raw, kind: 'file', openable: true, copyable: true };
  }

  const absoluteFile = pathToFileUrl(raw);
  if (absoluteFile) {
    return { raw, resolved: absoluteFile, kind: 'file', openable: true, copyable: true };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return { raw, resolved: raw, kind: 'unsupported', openable: false, copyable: true };
  }

  const currentUrl = currentDocumentUrl(currentFile, pageUrl);
  try {
    const base = currentUrl ? new URL('.', currentUrl).href : pageUrl;
    const resolved = new URL(raw, base).href;
    const kind: ResolvedLinkKind = resolved.startsWith('file:') ? 'file' : 'relative';
    return { raw, resolved, kind, openable: true, copyable: true };
  } catch {
    return { raw, resolved: raw, kind: 'unsupported', openable: false, copyable: Boolean(raw) };
  }
}
