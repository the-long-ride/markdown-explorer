import type { AppState } from '../contexts/appStateModel';
import { renderMarkdownClientSide } from '../contexts/contentTabState';
import type { ResolvedLink } from '../dom/linkContextMenu';
import type { PlatformBridge } from '../platform/bridge';
import type { MdFile } from '../types/files';

export interface DocumentSnapshot {
  file: MdFile;
  markdownSource: string;
  html: string;
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

  const html = renderMarkdownClientSide(
    markdownSource,
    file.fsPath,
    file.fileName.toLowerCase().endsWith('.mdx'),
    settings,
  ).html;

  return { file, markdownSource, html };
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

export function findScopeFile(link: ResolvedLink, files: readonly MdFile[]): MdFile | null {
  if (!link.openable || !link.resolved) return null;
  if (!['file', 'relative'].includes(link.kind)) return null;
  const target = normalizeComparablePath(link.resolved);
  if (!target) return null;
  return files.find((file) => normalizeComparablePath(file.fsPath) === target) ?? null;
}
