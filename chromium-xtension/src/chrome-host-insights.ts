const DEFAULT_SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
const DEFAULT_HARD_LIMIT_BYTES = 64 * 1024 * 1024;
const SCAN_BATCH_SIZE = 200;
const POLL_INTERVAL_MS = 2500;
const HARD_EXCLUDED = new Set(['.git', '.hg', '.svn']);
const DEFAULT_EXCLUDED = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.cache']);

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.md': 'text/markdown', '.mdx': 'text/mdx', '.pdf': 'application/pdf',
};

interface ChromeInsightsHostDeps {
  getActiveHandle: () => FileSystemDirectoryHandle | null;
  send: (message: any) => void;
  setInterval?: typeof window.setInterval;
  clearInterval?: typeof window.clearInterval;
  pollIntervalMs?: number;
}

function normalizePath(value: string): string | null {
  const parts: string[] = [];
  for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

function resolveReference(documentPath: string, resourcePath: string): string | null {
  const raw = String(resourcePath || '').split(/[?#]/, 1)[0];
  if (!raw || /^(?:https?:|data:|blob:|javascript:|file:\/\/)/i.test(raw)) return null;
  if (raw.startsWith('/')) return normalizePath(raw.slice(1));
  const base = String(documentPath || '').replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  return normalizePath(`${base}/${raw}`);
}

function extension(path: string): string {
  const file = path.split('/').pop() || '';
  const index = file.lastIndexOf('.');
  return index > 0 ? file.slice(index).toLowerCase() : '';
}

function isExcluded(relativePath: string, userPatterns: readonly string[] = []): boolean {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.some(segment => HARD_EXCLUDED.has(segment))) return true;
  let result = segments.some(segment => DEFAULT_EXCLUDED.has(segment));
  for (const raw of userPatterns) {
    const value = String(raw || '').trim();
    if (!value || value.startsWith('#')) continue;
    const negated = value.startsWith('!');
    const needle = (negated ? value.slice(1) : value).replace(/^\//, '').replace(/\/$/, '');
    if (relativePath === needle || relativePath.startsWith(`${needle}/`) || (!needle.includes('/') && segments.includes(needle))) {
      result = !negated;
    }
  }
  return result;
}

async function getFileHandle(root: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemFileHandle | null> {
  const normalized = normalizePath(relativePath);
  if (!normalized) return null;
  const parts = normalized.split('/');
  let directory = root;
  try {
    for (let index = 0; index < parts.length - 1; index += 1) {
      directory = await directory.getDirectoryHandle(parts[index]);
    }
    return await directory.getFileHandle(parts.at(-1)!);
  } catch {
    return null;
  }
}

async function getAnyHandle(root: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemHandle | null> {
  const normalized = normalizePath(relativePath);
  if (!normalized) return null;
  const parts = normalized.split('/');
  let directory = root;
  try {
    for (let index = 0; index < parts.length - 1; index += 1) directory = await directory.getDirectoryHandle(parts[index]);
    const name = parts.at(-1)!;
    try { return await directory.getFileHandle(name); }
    catch { return await directory.getDirectoryHandle(name); }
  } catch {
    return null;
  }
}

async function sha256(text: string): Promise<string | undefined> {
  try {
    if (!globalThis.crypto?.subtle) return undefined;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

export function createChromeInsightsHost(deps: ChromeInsightsHostDeps) {
  const cancelled = new Set<string>();
  const setIntervalImpl = deps.setInterval ?? window.setInterval.bind(window);
  const clearIntervalImpl = deps.clearInterval ?? window.clearInterval.bind(window);
  let pollTimer: number | null = null;
  let pollGeneration = 0;
  let previousPoll = new Map<string, { sizeBytes: number; mtimeMs: number; extension?: string }>();

  async function collectEntries(root: FileSystemDirectoryHandle, userPatterns: readonly string[] = [], requestId?: string) {
    const results: any[] = [];
    let excludedEntries = 0;
    let skippedEntries = 0;
    const walk = async (directory: FileSystemDirectoryHandle, prefix = ''): Promise<void> => {
      try {
        for await (const [name, handle] of (directory as any).entries()) {
          if (requestId && cancelled.has(requestId)) break;
          const relativePath = prefix ? `${prefix}/${name}` : name;
          if (isExcluded(relativePath, userPatterns)) { excludedEntries += 1; continue; }
          if (handle.kind === 'directory') {
            await walk(handle as FileSystemDirectoryHandle, relativePath);
            continue;
          }
          if (handle.kind !== 'file') continue;
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            results.push({
              relativePath,
              canonicalRelativePath: relativePath,
              kind: 'file',
              sizeBytes: file.size,
              mtimeMs: file.lastModified || 0,
              extension: extension(relativePath) || undefined,
              isSymlink: false,
            });
          } catch { skippedEntries += 1; }
        }
      } catch { skippedEntries += 1; }
    };
    await walk(root);
    return { entries: results, excludedEntries, skippedEntries };
  }

  async function probeWorkspaceResource(message: any): Promise<void> {
    const root = deps.getActiveHandle();
    const requestId = String(message.requestId || '');
    if (!root) { deps.send({ command: 'workspaceResourceProbeResult', requestId, status: 'missing' }); return; }
    const relativePath = resolveReference(String(message.documentPath || ''), String(message.resourcePath || ''));
    if (!relativePath) { deps.send({ command: 'workspaceResourceProbeResult', requestId, status: 'outside-workspace' }); return; }
    const handle = await getAnyHandle(root, relativePath);
    if (!handle) { deps.send({ command: 'workspaceResourceProbeResult', requestId, status: 'missing' }); return; }
    if (handle.kind === 'directory') {
      deps.send({ command: 'workspaceResourceProbeResult', requestId, status: 'exists', relativePath, kind: 'directory' });
      return;
    }
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      deps.send({
        command: 'workspaceResourceProbeResult', requestId, status: 'exists', relativePath, kind: 'file',
        sizeBytes: file.size, mimeType: file.type || MIME_TYPES[extension(relativePath)] || 'application/octet-stream',
      });
    } catch {
      deps.send({ command: 'workspaceResourceProbeResult', requestId, status: 'unreadable' });
    }
  }

  async function readInsightsDocumentSource(message: any): Promise<void> {
    const root = deps.getActiveHandle();
    const requestId = String(message.requestId || '');
    const relativePath = normalizePath(String(message.relativePath || '')) || '';
    const respond = (payload: any) => deps.send({ command: 'insightsDocumentSourceResult', requestId, relativePath, ...payload });
    if (!root || !relativePath) { respond({ status: 'missing' }); return; }
    if (!/\.mdx?$/i.test(relativePath)) { respond({ status: 'unsupported' }); return; }
    const handle = await getFileHandle(root, relativePath);
    if (!handle) { respond({ status: 'missing' }); return; }
    try {
      const file = await handle.getFile();
      const soft = Math.max(1, Number(message.softLimitBytes) || DEFAULT_SOFT_LIMIT_BYTES);
      const hard = Math.min(Math.max(1, Number(message.hardLimitBytes) || DEFAULT_HARD_LIMIT_BYTES), DEFAULT_HARD_LIMIT_BYTES);
      if (file.size > hard) { respond({ status: 'too-large', sizeBytes: file.size, mtimeMs: file.lastModified || 0, hardLimit: true }); return; }
      if (file.size > soft) { respond({ status: 'too-large', sizeBytes: file.size, mtimeMs: file.lastModified || 0, hardLimit: false }); return; }
      const source = await file.text();
      respond({ status: 'ok', source, sizeBytes: file.size, mtimeMs: file.lastModified || 0, contentHash: await sha256(source) });
    } catch {
      respond({ status: 'unreadable' });
    }
  }

  async function scanInsightsWorkspace(message: any): Promise<void> {
    const root = deps.getActiveHandle();
    const requestId = String(message.requestId || '');
    cancelled.delete(requestId);
    if (!root) {
      deps.send({ command: 'insightsScanComplete', requestId, totalEntries: 0, excludedEntries: 0, skippedEntries: 0, truncated: false });
      return;
    }
    const { entries, excludedEntries, skippedEntries } = await collectEntries(root, Array.isArray(message.userPatterns) ? message.userPatterns : [], requestId);
    for (let index = 0; index < entries.length; index += SCAN_BATCH_SIZE) {
      if (cancelled.has(requestId)) break;
      const batch = entries.slice(index, index + SCAN_BATCH_SIZE);
      deps.send({ command: 'insightsScanBatch', requestId, entries: batch, scannedEntries: Math.min(index + batch.length, entries.length), excludedEntries });
    }
    const wasCancelled = cancelled.delete(requestId);
    deps.send({
      command: 'insightsScanComplete', requestId, totalEntries: entries.length, excludedEntries, skippedEntries,
      truncated: false, ...(wasCancelled ? { cancelled: true } : {}),
    });
  }

  function cancelInsightsScan(message: any): void {
    const requestId = String(message.requestId || '');
    if (requestId) cancelled.add(requestId);
  }

  function stopPolling(): void {
    pollGeneration += 1;
    if (pollTimer !== null) clearIntervalImpl(pollTimer);
    pollTimer = null;
    previousPoll = new Map();
  }

  async function pollOnce(message: any, generation: number): Promise<void> {
    const root = deps.getActiveHandle();
    if (!root || generation !== pollGeneration) return;
    const { entries } = await collectEntries(root);
    if (generation !== pollGeneration) return;
    const next = new Map(entries.map(entry => [entry.relativePath, entry]));
    const deltas: any[] = [];
    for (const [relativePath, entry] of next) {
      const previous = previousPoll.get(relativePath);
      if (!previous || previous.sizeBytes !== entry.sizeBytes || previous.mtimeMs !== entry.mtimeMs) {
        deltas.push({ kind: previous ? 'update' : 'add', entry });
      }
    }
    for (const relativePath of previousPoll.keys()) if (!next.has(relativePath)) deltas.push({ kind: 'delete', relativePath });
    previousPoll = next;
    if (deltas.length) deps.send({ command: 'insightsFsDelta', requestId: message.requestId, workspaceOperationId: message.workspaceOperationId, deltas });
  }

  function setInsightsWatchState(message: any): void {
    stopPolling();
    deps.send({
      command: 'insightsRuntimeCapabilities', requestId: message.requestId,
      capabilities: { fileChanges: 'polling', externalLinkChecking: false, documentPreviewReuse: true },
    });
    if (message.active !== true || message.visible !== true || !deps.getActiveHandle()) return;
    const generation = pollGeneration;
    void pollOnce(message, generation);
    pollTimer = setIntervalImpl(() => { void pollOnce(message, generation); }, deps.pollIntervalMs ?? POLL_INTERVAL_MS);
  }

  function dispose(): void { stopPolling(); cancelled.clear(); }

  return {
    capabilities: { fileChanges: 'polling' as const, externalLinkChecking: false, documentPreviewReuse: true },
    probeWorkspaceResource,
    readInsightsDocumentSource,
    scanInsightsWorkspace,
    cancelInsightsScan,
    setInsightsWatchState,
    dispose,
  };
}

export { DEFAULT_SOFT_LIMIT_BYTES, DEFAULT_HARD_LIMIT_BYTES, SCAN_BATCH_SIZE, POLL_INTERVAL_MS, resolveReference };
