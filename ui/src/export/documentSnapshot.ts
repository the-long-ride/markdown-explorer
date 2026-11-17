import type { AppState } from '../contexts/appStateModel';
import { renderMarkdownClientSide } from '../contexts/contentTabState';
import type { ResolvedLink } from '../dom/linkContextMenu';
import type { PlatformBridge } from '../platform/bridge';
import type { MdFile } from '../types/files';
import type { TocEntry } from '../types';

export interface DocumentSnapshot {
  file: MdFile;
  markdownSource: string;
  html: string;
  toc?: TocEntry[];
}

const DEFAULT_SNAPSHOT_TIMEOUT_MS = 8_000;

export async function loadDocumentSnapshot(
  bridge: PlatformBridge,
  file: MdFile,
  settings: AppState['settings'],
  timeoutMs = DEFAULT_SNAPSHOT_TIMEOUT_MS,
): Promise<DocumentSnapshot> {
  const requestId = `document-snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const markdownSource = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      callback();
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'searchPreviewResult' || message.requestId !== requestId) return;
      finish(() => {
        if (message.ok && typeof message.markdownSource === 'string') {
          resolve(message.markdownSource);
          return;
        }
        reject(new Error(message.reason || 'Unable to load document snapshot'));
      });
    });
    const timer = setTimeout(() => {
      finish(() => reject(new Error('Document snapshot timed out')));
    }, timeoutMs);

    bridge.postMessage({
      command: 'loadSearchPreview',
      requestId,
      filePath: file.fsPath,
    });
  });

  const rendered = renderMarkdownClientSide(
    markdownSource,
    file.fsPath,
    file.fileName.toLowerCase().endsWith('.mdx'),
    settings,
  );

  return { file, markdownSource, html: rendered.html, toc: rendered.toc };
}

function stripQueryAndFragment(value: string): string {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function fileUrlToPath(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:') return value;
    const decoded = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(decoded)) return decoded.slice(1);
    return decoded;
  } catch {
    return value;
  }
}

function normalizeComparablePath(value: string): string {
  const raw = fileUrlToPath(stripQueryAndFragment(value)).replace(/\\/g, '/');
  const collapsed = raw.replace(/\/+/g, '/').replace(/\/$/, '');
  return /^[A-Za-z]:\//.test(collapsed) ? collapsed.toLowerCase() : collapsed;
}

function decodeLinkTarget(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeRelativeScopePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

function resolveWorkspaceScopePath(rawHref: string, files: readonly MdFile[], currentFile?: string | null): string | null {
  const cleanRaw = decodeLinkTarget(stripQueryAndFragment(rawHref)).replace(/\\/g, '/').trim();
  if (!cleanRaw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(cleanRaw)) return null;

  let parts: string[] = [];
  if (!cleanRaw.startsWith('/')) {
    const normalizedCurrent = currentFile ? normalizeComparablePath(currentFile) : '';
    const currentEntry = normalizedCurrent
      ? files.find((file) => normalizeComparablePath(file.fsPath) === normalizedCurrent)
      : undefined;
    const baseRelative = currentEntry
      ? normalizeRelativeScopePath(currentEntry.relativePath)
      : (currentFile && !/^(?:[A-Za-z]:\/|\/|file:)/i.test(currentFile.replace(/\\/g, '/'))
          ? normalizeRelativeScopePath(currentFile)
          : '');
    parts = baseRelative.split('/').slice(0, -1).filter(Boolean);
  }

  for (const segment of cleanRaw.replace(/^\/+/, '').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  const candidate = parts.join('/');
  return candidate || null;
}

export function findScopeFile(
  link: ResolvedLink,
  files: readonly MdFile[],
  currentFile?: string | null,
): MdFile | null {
  if (!link.openable || !link.resolved) return null;
  if (!['file', 'relative'].includes(link.kind)) return null;
  const target = normalizeComparablePath(link.resolved);
  if (target) {
    const exact = files.find((file) => normalizeComparablePath(file.fsPath) === target);
    if (exact) return exact;
  }

  const workspaceTarget = resolveWorkspaceScopePath(link.raw, files, currentFile);
  if (!workspaceTarget) return null;

  const exactRelative = files.find(
    (file) =>
      normalizeRelativeScopePath(file.relativePath) === workspaceTarget ||
      normalizeRelativeScopePath(file.fsPath) === workspaceTarget,
  );
  if (exactRelative) return exactRelative;

  const targetLower = workspaceTarget.toLowerCase();
  return (
    files.find(
      (file) =>
        normalizeRelativeScopePath(file.relativePath).toLowerCase() === targetLower ||
        normalizeRelativeScopePath(file.fsPath).toLowerCase() === targetLower,
    ) ?? null
  );
}
