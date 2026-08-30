const crypto = require('node:crypto');

const DEFAULT_SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
const DEFAULT_HARD_LIMIT_BYTES = 64 * 1024 * 1024;
const SCAN_BATCH_SIZE = 200;
const HARD_EXCLUDED_SEGMENTS = new Set(['.git', '.hg', '.svn']);
const DEFAULT_EXCLUDED_SEGMENTS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.cache']);

const MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.md': 'text/markdown', '.mdx': 'text/mdx', '.txt': 'text/plain', '.pdf': 'application/pdf',
};

function normalizeRelativePath(pathApi, root, target) {
  return pathApi.relative(root, target).split(pathApi.sep).join('/');
}

function isRemoteReference(value) {
  return /^(?:https?:|data:|blob:|javascript:)/i.test(String(value || '').trim());
}

function globToRegExp(pattern) {
  let source = String(pattern || '').trim();
  if (!source || source.startsWith('#')) return null;
  const negated = source.startsWith('!');
  if (negated) source = source.slice(1);
  const directoryOnly = source.endsWith('/');
  if (directoryOnly) source = source.slice(0, -1);
  const anchored = source.startsWith('/');
  if (anchored) source = source.slice(1);
  let re = '';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '*') {
      if (source[i + 1] === '*') { re += '.*'; i += 1; }
      else re += '[^/]*';
    } else if (char === '?') re += '[^/]';
    else re += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  const prefix = anchored ? '^' : '(^|.*/)';
  const suffix = directoryOnly ? '(?:/.*)?$' : '$';
  return { negated, regex: new RegExp(prefix + re + suffix) };
}

function applyPatterns(relativePath, initialExcluded, patterns) {
  let excluded = initialExcluded;
  for (const raw of patterns || []) {
    const compiled = globToRegExp(raw);
    if (!compiled || !compiled.regex.test(relativePath)) continue;
    excluded = !compiled.negated;
  }
  return excluded;
}

function readGitignore(fs, pathApi, root) {
  try {
    return fs.readFileSync(pathApi.join(root, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

function shouldExclude(relativePath, gitignorePatterns, userPatterns) {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.some(segment => HARD_EXCLUDED_SEGMENTS.has(segment))) return true;
  let excluded = segments.some(segment => DEFAULT_EXCLUDED_SEGMENTS.has(segment));
  excluded = applyPatterns(relativePath, excluded, gitignorePatterns);
  excluded = applyPatterns(relativePath, excluded, userPatterns);
  return excluded;
}

function mimeTypeFor(pathApi, filePath) {
  return MIME_TYPES[pathApi.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function createInsightsWorkspaceHost({
  fs,
  pathApi,
  sendHostMessage,
  isSameOrInsidePath,
  getWorkspaceBaseDir,
}) {
  const cancelledScans = new Set();
  const watchDisposers = new Set();
  let watchRequestId = '';
  let watchWorkspaceOperationId;
  let watchGeneration = 0;

  function workspaceRoot() {
    const base = getWorkspaceBaseDir();
    if (!base) return null;
    try {
      return fs.realpathSync(base);
    } catch {
      return null;
    }
  }

  function containedRealPath(candidate, root) {
    try {
      const real = fs.realpathSync(candidate);
      return isSameOrInsidePath(root, real, pathApi) ? real : null;
    } catch {
      return null;
    }
  }

  function resolveResourcePath(message, root) {
    const raw = String(message.resourcePath || '').split(/[?#]/, 1)[0];
    if (!raw || isRemoteReference(raw) || /^file:\/\//i.test(raw)) return { status: 'outside-workspace' };
    let candidate;
    if (raw.startsWith('/')) candidate = pathApi.resolve(root, `.${raw}`);
    else if (pathApi.isAbsolute(raw)) candidate = pathApi.normalize(raw);
    else {
      const documentPath = String(message.documentPath || '');
      const documentAbsolute = pathApi.isAbsolute(documentPath)
        ? documentPath
        : pathApi.resolve(root, documentPath);
      candidate = pathApi.resolve(pathApi.dirname(documentAbsolute), raw);
    }
    if (!isSameOrInsidePath(root, candidate, pathApi)) return { status: 'outside-workspace' };
    return { candidate };
  }

  async function probeWorkspaceResource(message = {}) {
    const requestId = String(message.requestId || '');
    const respond = payload => sendHostMessage({ command: 'workspaceResourceProbeResult', requestId, ...payload });
    const root = workspaceRoot();
    if (!root) { respond({ status: 'missing' }); return; }
    const resolved = resolveResourcePath(message, root);
    if (!resolved.candidate) { respond({ status: resolved.status || 'outside-workspace' }); return; }
    try {
      if (!fs.existsSync(resolved.candidate)) { respond({ status: 'missing' }); return; }
      const real = containedRealPath(resolved.candidate, root);
      if (!real) { respond({ status: 'outside-workspace' }); return; }
      const stat = fs.statSync(real);
      respond({
        status: 'exists',
        relativePath: normalizeRelativePath(pathApi, root, real),
        kind: stat.isDirectory() ? 'directory' : 'file',
        sizeBytes: stat.isFile() ? stat.size : undefined,
        mimeType: stat.isFile() ? mimeTypeFor(pathApi, real) : undefined,
      });
    } catch {
      respond({ status: 'unreadable' });
    }
  }

  async function readInsightsDocumentSource(message = {}) {
    const requestId = String(message.requestId || '');
    const relativePath = String(message.relativePath || '');
    const respond = payload => sendHostMessage({ command: 'insightsDocumentSourceResult', requestId, relativePath, ...payload });
    const root = workspaceRoot();
    if (!root || !relativePath) { respond({ status: 'missing' }); return; }
    const candidate = pathApi.resolve(root, relativePath);
    if (!isSameOrInsidePath(root, candidate, pathApi)) { respond({ status: 'outside-workspace' }); return; }
    if (!/\.mdx?$/i.test(candidate)) { respond({ status: 'unsupported' }); return; }
    try {
      const real = containedRealPath(candidate, root);
      if (!real) { respond({ status: fs.existsSync(candidate) ? 'outside-workspace' : 'missing' }); return; }
      const stat = fs.statSync(real);
      if (!stat.isFile()) { respond({ status: 'missing' }); return; }
      const softLimit = Math.max(1, Number(message.softLimitBytes) || DEFAULT_SOFT_LIMIT_BYTES);
      const requestedHard = Math.max(1, Number(message.hardLimitBytes) || DEFAULT_HARD_LIMIT_BYTES);
      const hardLimit = Math.min(requestedHard, DEFAULT_HARD_LIMIT_BYTES);
      if (stat.size > hardLimit) {
        respond({ status: 'too-large', sizeBytes: stat.size, mtimeMs: stat.mtimeMs, hardLimit: true });
        return;
      }
      if (stat.size > softLimit) {
        respond({ status: 'too-large', sizeBytes: stat.size, mtimeMs: stat.mtimeMs, hardLimit: false });
        return;
      }
      const source = fs.readFileSync(real, 'utf8');
      const contentHash = crypto.createHash('sha256').update(source).digest('hex');
      respond({ status: 'ok', source, sizeBytes: stat.size, mtimeMs: stat.mtimeMs, contentHash });
    } catch {
      respond({ status: 'unreadable' });
    }
  }

  async function scanInsightsWorkspace(message = {}) {
    const requestId = String(message.requestId || '');
    cancelledScans.delete(requestId);
    const root = workspaceRoot();
    if (!root) {
      sendHostMessage({ command: 'insightsScanComplete', requestId, totalEntries: 0, excludedEntries: 0, skippedEntries: 0, truncated: false });
      return;
    }
    const gitignorePatterns = readGitignore(fs, pathApi, root);
    const userPatterns = Array.isArray(message.userPatterns) ? message.userPatterns : [];
    const batch = [];
    let totalEntries = 0;
    let excludedEntries = 0;
    let skippedEntries = 0;
    const visitedDirectories = new Set();
    const visitedFiles = new Set();

    const flush = () => {
      if (!batch.length) return;
      sendHostMessage({
        command: 'insightsScanBatch', requestId,
        entries: batch.splice(0, batch.length),
        scannedEntries: totalEntries,
        excludedEntries,
      });
    };

    const walk = absoluteDir => {
      if (cancelledScans.has(requestId)) return;
      let realDir;
      try { realDir = fs.realpathSync(absoluteDir); } catch { skippedEntries += 1; return; }
      if (!isSameOrInsidePath(root, realDir, pathApi) || visitedDirectories.has(realDir)) return;
      visitedDirectories.add(realDir);
      let entries;
      try { entries = fs.readdirSync(absoluteDir, { withFileTypes: true }); }
      catch { skippedEntries += 1; return; }
      for (const dirent of entries) {
        if (cancelledScans.has(requestId)) break;
        const absolute = pathApi.join(absoluteDir, dirent.name);
        const displayRelative = normalizeRelativePath(pathApi, root, absolute);
        if (shouldExclude(displayRelative, gitignorePatterns, userPatterns)) { excludedEntries += 1; continue; }
        let real;
        let stat;
        try {
          real = fs.realpathSync(absolute);
          if (!isSameOrInsidePath(root, real, pathApi)) { excludedEntries += 1; continue; }
          stat = fs.statSync(real);
        } catch { skippedEntries += 1; continue; }
        if (stat.isDirectory()) { walk(absolute); continue; }
        if (!stat.isFile() || visitedFiles.has(real)) continue;
        visitedFiles.add(real);
        totalEntries += 1;
        batch.push({
          relativePath: displayRelative,
          canonicalRelativePath: normalizeRelativePath(pathApi, root, real),
          kind: 'file',
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
          extension: pathApi.extname(displayRelative).toLowerCase() || undefined,
          isSymlink: dirent.isSymbolicLink ? dirent.isSymbolicLink() : false,
        });
        if (batch.length >= SCAN_BATCH_SIZE) flush();
      }
    };

    walk(root);
    flush();
    const cancelled = cancelledScans.delete(requestId);
    sendHostMessage({
      command: 'insightsScanComplete', requestId, totalEntries, excludedEntries, skippedEntries,
      truncated: false,
      ...(cancelled ? { cancelled: true } : {}),
    });
  }

  function cancelInsightsScan(message = {}) {
    const requestId = String(message.requestId || '');
    if (requestId) cancelledScans.add(requestId);
  }

  function stopWatch() {
    watchGeneration += 1;
    for (const dispose of watchDisposers) {
      try { dispose(); } catch { /* noop */ }
    }
    watchDisposers.clear();
  }

  function startWatch(root) {
    stopWatch();
    const generation = watchGeneration;
    const seen = new Set();
    const attach = dir => {
      let real;
      try { real = fs.realpathSync(dir); } catch { return; }
      if (seen.has(real) || !isSameOrInsidePath(root, real, pathApi)) return;
      seen.add(real);
      let watcher;
      try {
        watcher = fs.watch(dir, { persistent: false }, (_eventType, name) => {
          if (generation !== watchGeneration || !name) return;
          const absolute = pathApi.join(dir, String(name));
          const relativePath = normalizeRelativePath(pathApi, root, absolute);
          let delta;
          try {
            if (!fs.existsSync(absolute)) delta = { kind: 'delete', relativePath };
            else {
              const realTarget = fs.realpathSync(absolute);
              if (!isSameOrInsidePath(root, realTarget, pathApi)) return;
              const stat = fs.statSync(realTarget);
              if (stat.isDirectory()) { attach(absolute); return; }
              delta = {
                kind: 'update',
                entry: {
                  relativePath,
                  canonicalRelativePath: normalizeRelativePath(pathApi, root, realTarget),
                  kind: 'file', sizeBytes: stat.size, mtimeMs: stat.mtimeMs,
                  extension: pathApi.extname(relativePath).toLowerCase() || undefined,
                },
              };
            }
          } catch { delta = { kind: 'delete', relativePath }; }
          sendHostMessage({
            command: 'insightsFsDelta', requestId: watchRequestId,
            ...(watchWorkspaceOperationId ? { workspaceOperationId: watchWorkspaceOperationId } : {}),
            deltas: [delta],
          });
        });
        watchDisposers.add(() => watcher.close());
      } catch { return; }
      try {
        for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
          if (child.isDirectory()) attach(pathApi.join(dir, child.name));
        }
      } catch { /* noop */ }
    };
    attach(root);
  }

  function setInsightsWatchState(message = {}) {
    watchRequestId = String(message.requestId || '');
    watchWorkspaceOperationId = message.workspaceOperationId;
    const root = workspaceRoot();
    const active = message.active === true && Boolean(root);
    if (!active) stopWatch();
    else startWatch(root);
    sendHostMessage({
      command: 'insightsRuntimeCapabilities',
      requestId: watchRequestId,
      capabilities: {
        fileChanges: active && watchDisposers.size > 0 ? 'native' : 'unsupported',
        externalLinkChecking: true,
        documentPreviewReuse: true,
      },
    });
  }

  function dispose() {
    stopWatch();
    cancelledScans.clear();
  }

  return {
    capabilities: { fileChanges: 'native', externalLinkChecking: true, documentPreviewReuse: true },
    scanInsightsWorkspace,
    cancelInsightsScan,
    readInsightsDocumentSource,
    probeWorkspaceResource,
    setInsightsWatchState,
    dispose,
  };
}

module.exports = {
  DEFAULT_SOFT_LIMIT_BYTES,
  DEFAULT_HARD_LIMIT_BYTES,
  SCAN_BATCH_SIZE,
  createInsightsWorkspaceHost,
};
