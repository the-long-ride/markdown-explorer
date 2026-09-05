import { createHash } from 'node:crypto';
import type * as Fs from 'node:fs';
import type * as Path from 'node:path';

const DEFAULT_SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
const DEFAULT_HARD_LIMIT_BYTES = 64 * 1024 * 1024;
const SCAN_BATCH_SIZE = 200;
const HARD_EXCLUDED = new Set(['.git', '.hg', '.svn']);
const DEFAULT_EXCLUDED = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.cache']);

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.md': 'text/markdown', '.mdx': 'text/mdx', '.pdf': 'application/pdf',
};

interface PanelInsightsHostDeps {
  fs: typeof Fs;
  pathApi: typeof Path;
  workspaceRoot: () => string | null;
  postMessage: (message: any) => void | Promise<unknown>;
}

function normalizeRelative(pathApi: typeof Path, root: string, target: string): string {
  return pathApi.relative(root, target).split(pathApi.sep).join('/');
}

function sameOrInside(pathApi: typeof Path, root: string, target: string): boolean {
  const rel = pathApi.relative(pathApi.resolve(root), pathApi.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !pathApi.isAbsolute(rel));
}

function excluded(relativePath: string, userPatterns: readonly string[] = []): boolean {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.some(segment => HARD_EXCLUDED.has(segment))) return true;
  let result = segments.some(segment => DEFAULT_EXCLUDED.has(segment));
  for (const raw of userPatterns) {
    const value = String(raw || '').trim();
    if (!value || value.startsWith('#')) continue;
    const negated = value.startsWith('!');
    const needle = (negated ? value.slice(1) : value).replace(/^\//, '').replace(/\/$/, '');
    const matches = relativePath === needle || relativePath.startsWith(`${needle}/`)
      || (!needle.includes('/') && segments.includes(needle));
    if (matches) result = !negated;
  }
  return result;
}

export function createPanelInsightsHost(deps: PanelInsightsHostDeps) {
  const { fs, pathApi, postMessage } = deps;
  const cancelled = new Set<string>();
  const watchers = new Set<{ close(): void }>();
  let watchGeneration = 0;

  const rootReal = (): string | null => {
    const root = deps.workspaceRoot();
    if (!root) return null;
    try { return fs.realpathSync(root); } catch { return null; }
  };

  const send = async (message: any) => { await postMessage(message); };

  async function probeWorkspaceResource(message: any): Promise<void> {
    const requestId = String(message.requestId || '');
    const root = rootReal();
    const respond = (payload: any) => send({ command: 'workspaceResourceProbeResult', requestId, ...payload });
    if (!root) { await respond({ status: 'missing' }); return; }
    const raw = String(message.resourcePath || '').split(/[?#]/, 1)[0];
    if (!raw || /^(?:https?:|data:|blob:|javascript:|file:\/\/)/i.test(raw)) {
      await respond({ status: 'outside-workspace' }); return;
    }
    const documentPath = String(message.documentPath || '');
    const documentAbsolute = pathApi.isAbsolute(documentPath) ? documentPath : pathApi.resolve(root, documentPath);
    const candidate = raw.startsWith('/')
      ? pathApi.resolve(root, `.${raw}`)
      : pathApi.isAbsolute(raw) ? pathApi.normalize(raw) : pathApi.resolve(pathApi.dirname(documentAbsolute), raw);
    if (!sameOrInside(pathApi, root, candidate)) { await respond({ status: 'outside-workspace' }); return; }
    try {
      if (!fs.existsSync(candidate)) { await respond({ status: 'missing' }); return; }
      const real = fs.realpathSync(candidate);
      if (!sameOrInside(pathApi, root, real)) { await respond({ status: 'outside-workspace' }); return; }
      const stat = fs.statSync(real);
      await respond({
        status: 'exists',
        relativePath: normalizeRelative(pathApi, root, real),
        kind: stat.isDirectory() ? 'directory' : 'file',
        sizeBytes: stat.isFile() ? stat.size : undefined,
        mimeType: stat.isFile() ? (MIME_TYPES[pathApi.extname(real).toLowerCase()] || 'application/octet-stream') : undefined,
      });
    } catch {
      await respond({ status: 'unreadable' });
    }
  }

  async function readInsightsDocumentSource(message: any): Promise<void> {
    const requestId = String(message.requestId || '');
    const relativePath = String(message.relativePath || '');
    const respond = (payload: any) => send({ command: 'insightsDocumentSourceResult', requestId, relativePath, ...payload });
    const root = rootReal();
    if (!root || !relativePath) { await respond({ status: 'missing' }); return; }
    const candidate = pathApi.resolve(root, relativePath);
    if (!sameOrInside(pathApi, root, candidate)) { await respond({ status: 'outside-workspace' }); return; }
    if (!/\.mdx?$/i.test(candidate)) { await respond({ status: 'unsupported' }); return; }
    try {
      const real = fs.realpathSync(candidate);
      if (!sameOrInside(pathApi, root, real)) { await respond({ status: 'outside-workspace' }); return; }
      const stat = fs.statSync(real);
      if (!stat.isFile()) { await respond({ status: 'missing' }); return; }
      const soft = Math.max(1, Number(message.softLimitBytes) || DEFAULT_SOFT_LIMIT_BYTES);
      const hard = Math.min(Math.max(1, Number(message.hardLimitBytes) || DEFAULT_HARD_LIMIT_BYTES), DEFAULT_HARD_LIMIT_BYTES);
      if (stat.size > hard) { await respond({ status: 'too-large', sizeBytes: stat.size, mtimeMs: stat.mtimeMs, hardLimit: true }); return; }
      if (stat.size > soft) { await respond({ status: 'too-large', sizeBytes: stat.size, mtimeMs: stat.mtimeMs, hardLimit: false }); return; }
      const source = fs.readFileSync(real, 'utf8');
      await respond({
        status: 'ok', source, sizeBytes: stat.size, mtimeMs: stat.mtimeMs,
        contentHash: createHash('sha256').update(source).digest('hex'),
      });
    } catch {
      await respond({ status: 'unreadable' });
    }
  }

  async function scanInsightsWorkspace(message: any): Promise<void> {
    const requestId = String(message.requestId || '');
    cancelled.delete(requestId);
    const root = rootReal();
    if (!root) {
      await send({ command: 'insightsScanComplete', requestId, totalEntries: 0, excludedEntries: 0, skippedEntries: 0, truncated: false });
      return;
    }
    const userPatterns = Array.isArray(message.userPatterns) ? message.userPatterns : [];
    const batch: any[] = [];
    const visitedDirs = new Set<string>();
    const visitedFiles = new Set<string>();
    let totalEntries = 0;
    let excludedEntries = 0;
    let skippedEntries = 0;

    const flush = async () => {
      if (!batch.length) return;
      const entries = batch.splice(0, batch.length);
      await send({ command: 'insightsScanBatch', requestId, entries, scannedEntries: totalEntries, excludedEntries });
    };

    const walk = async (dir: string): Promise<void> => {
      if (cancelled.has(requestId)) return;
      let realDir: string;
      try { realDir = fs.realpathSync(dir); } catch { skippedEntries += 1; return; }
      if (!sameOrInside(pathApi, root, realDir) || visitedDirs.has(realDir)) return;
      visitedDirs.add(realDir);
      let children: Fs.Dirent[];
      try { children = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { skippedEntries += 1; return; }
      for (const child of children) {
        if (cancelled.has(requestId)) break;
        const absolute = pathApi.join(dir, child.name);
        const relativePath = normalizeRelative(pathApi, root, absolute);
        if (excluded(relativePath, userPatterns)) { excludedEntries += 1; continue; }
        try {
          const real = fs.realpathSync(absolute);
          if (!sameOrInside(pathApi, root, real)) { excludedEntries += 1; continue; }
          const stat = fs.statSync(real);
          if (stat.isDirectory()) { await walk(absolute); continue; }
          if (!stat.isFile() || visitedFiles.has(real)) continue;
          visitedFiles.add(real);
          totalEntries += 1;
          batch.push({
            relativePath,
            canonicalRelativePath: normalizeRelative(pathApi, root, real),
            kind: 'file', sizeBytes: stat.size, mtimeMs: stat.mtimeMs,
            extension: pathApi.extname(relativePath).toLowerCase() || undefined,
            isSymlink: child.isSymbolicLink(),
          });
          if (batch.length >= SCAN_BATCH_SIZE) await flush();
        } catch { skippedEntries += 1; }
      }
    };

    await walk(root);
    await flush();
    const wasCancelled = cancelled.delete(requestId);
    await send({
      command: 'insightsScanComplete', requestId, totalEntries, excludedEntries, skippedEntries,
      truncated: false, ...(wasCancelled ? { cancelled: true } : {}),
    });
  }

  function cancelInsightsScan(message: any): void {
    const requestId = String(message.requestId || '');
    if (requestId) cancelled.add(requestId);
  }

  function stopWatch(): void {
    watchGeneration += 1;
    for (const watcher of watchers) { try { watcher.close(); } catch { /* noop */ } }
    watchers.clear();
  }

  async function setInsightsWatchState(message: any): Promise<void> {
    stopWatch();
    const root = rootReal();
    if (message.active === true && root) {
      const generation = watchGeneration;
      const attach = (dir: string) => {
        try {
          const watcher = fs.watch(dir, { persistent: false }, (_event, fileName) => {
            if (generation !== watchGeneration || !fileName) return;
            const absolute = pathApi.join(dir, String(fileName));
            const relativePath = normalizeRelative(pathApi, root, absolute);
            let delta: any;
            try {
              if (!fs.existsSync(absolute)) delta = { kind: 'delete', relativePath };
              else {
                const real = fs.realpathSync(absolute);
                if (!sameOrInside(pathApi, root, real)) return;
                const stat = fs.statSync(real);
                if (stat.isDirectory()) { attach(absolute); return; }
                delta = { kind: 'update', entry: {
                  relativePath, canonicalRelativePath: normalizeRelative(pathApi, root, real), kind: 'file',
                  sizeBytes: stat.size, mtimeMs: stat.mtimeMs, extension: pathApi.extname(relativePath).toLowerCase() || undefined,
                } };
              }
            } catch { delta = { kind: 'delete', relativePath }; }
            void send({ command: 'insightsFsDelta', requestId: message.requestId, workspaceOperationId: message.workspaceOperationId, deltas: [delta] });
          });
          watchers.add(watcher);
          for (const child of fs.readdirSync(dir, { withFileTypes: true })) if (child.isDirectory()) attach(pathApi.join(dir, child.name));
        } catch { /* unsupported directory */ }
      };
      attach(root);
    }
    await send({
      command: 'insightsRuntimeCapabilities', requestId: message.requestId,
      capabilities: { fileChanges: watchers.size ? 'native' : 'unsupported', externalLinkChecking: true, documentPreviewReuse: true },
    });
  }

  function dispose(): void { stopWatch(); cancelled.clear(); }

  return {
    capabilities: { fileChanges: 'native' as const, externalLinkChecking: true, documentPreviewReuse: true },
    probeWorkspaceResource,
    readInsightsDocumentSource,
    scanInsightsWorkspace,
    cancelInsightsScan,
    setInsightsWatchState,
    dispose,
  };
}

export { DEFAULT_SOFT_LIMIT_BYTES, DEFAULT_HARD_LIMIT_BYTES, SCAN_BATCH_SIZE };
