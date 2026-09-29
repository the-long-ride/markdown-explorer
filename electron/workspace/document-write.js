const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MARKDOWN_DOCUMENT_PATH = /\.mdx?$/i;
// Antivirus scanners, indexers and sync clients briefly lock files on Windows, which fails a rename with these codes.
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
// The directory does not allow creating files, but the document itself may still be writable in place.
const TEMP_FILE_UNAVAILABLE_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);
const DEFAULT_RENAME_RETRY_DELAYS_MS = [20, 40, 80, 160, 320];

function revisionFromStat(stat) {
  const mtimeMs = Number.isFinite(stat?.mtimeMs) ? Math.trunc(stat.mtimeMs) : 0;
  const size = Number.isFinite(stat?.size) ? stat.size : 0;
  return `${mtimeMs}:${size}`;
}

async function revisionFor(filePath, fsApi = fs) {
  const stat = await fsApi.promises.stat(filePath);
  return revisionFromStat(stat);
}

function revisionForSync(filePath, fsApi = fs) {
  return revisionFromStat(fsApi.statSync(filePath));
}

function isSameOrInsidePath(basePath, targetPath, pathApi = path) {
  const relative = pathApi.relative(pathApi.resolve(basePath), pathApi.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

// Windows ignores trailing dots and spaces in names, so ".git." still addresses ".git".
function hasGitSegment(basePath, targetPath, pathApi = path) {
  const relative = pathApi.relative(pathApi.resolve(basePath), pathApi.resolve(targetPath));
  return relative.split(/[\\/]+/).some((segment) => segment.replace(/[. ]+$/, '').toLowerCase() === '.git');
}

function isWritableDocumentTarget(basePath, targetPath, pathApi = path) {
  return MARKDOWN_DOCUMENT_PATH.test(targetPath) && !hasGitSegment(basePath, targetPath, pathApi);
}

async function workspaceBaseDir(workspacePath, fsApi = fs, pathApi = path) {
  if (!workspacePath || typeof workspacePath !== 'string') return null;
  try {
    const stat = await fsApi.promises.stat(workspacePath);
    return stat.isFile() ? pathApi.dirname(workspacePath) : workspacePath;
  } catch {
    return null;
  }
}

function documentWriteCapabilityFor(filePath, fsApi = fs) {
  if (!MARKDOWN_DOCUMENT_PATH.test(String(filePath || ''))) {
    return { supported: false, revision: null, reason: 'unsupported-document' };
  }
  try {
    return { supported: true, revision: revisionForSync(filePath, fsApi) };
  } catch {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
}

function failure(reason, error) {
  return {
    ok: false,
    reason,
    ...(error ? { error: String(error?.message || error) } : {}),
  };
}

async function canonicalExistingPath(filePath, fsApi = fs) {
  return fsApi.promises.realpath(filePath);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns false when the rename kept failing on Windows, so the caller may fall back to a direct write.
async function renameWithRetry(promises, tempPath, target, platform, retryDelaysMs) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await promises.rename(tempPath, target);
      return true;
    } catch (error) {
      if (platform !== 'win32' || !TRANSIENT_RENAME_CODES.has(error?.code)) throw error;
      if (attempt >= retryDelaysMs.length) return false;
      await delay(retryDelaysMs[attempt]);
    }
  }
}

// Replace the target with a single rename so a crash or full disk cannot leave a truncated document.
// Returns false when an atomic replace was not possible and a direct write is the only remaining option.
async function writeFileAtomically(target, source, { fsApi, pathApi, platform, retryDelaysMs, mode }) {
  const promises = fsApi.promises;
  const originalMode = Number.isFinite(mode) ? mode & 0o7777 : 0o644;
  const tempPath = pathApi.join(
    pathApi.dirname(target),
    `.${pathApi.basename(target)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );
  let handle = null;
  let replaced = false;
  try {
    try {
      handle = await promises.open(tempPath, 'wx', 0o600);
    } catch (error) {
      if (TEMP_FILE_UNAVAILABLE_CODES.has(error?.code)) return false;
      throw error;
    }
    await handle.writeFile(source, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await promises.chmod(tempPath, originalMode).catch(() => {});
    replaced = await renameWithRetry(promises, tempPath, target, platform, retryDelaysMs);
    return replaced;
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (!replaced) await promises.unlink(tempPath).catch(() => {});
  }
}

async function saveWorkspaceDocument({
  workspacePath,
  filePath,
  source,
  expectedRevision = null,
  force = false,
  fsApi = fs,
  pathApi = path,
  platform = process.platform,
  renameRetryDelaysMs = DEFAULT_RENAME_RETRY_DELAYS_MS,
} = {}) {
  if (typeof source !== 'string' || typeof filePath !== 'string' || !filePath) {
    return failure('write-failed', 'Invalid document write request');
  }

  const baseDir = await workspaceBaseDir(workspacePath, fsApi, pathApi);
  if (!baseDir) return failure('missing');

  const requestedTarget = pathApi.isAbsolute(filePath)
    ? pathApi.resolve(filePath)
    : pathApi.resolve(baseDir, filePath);
  if (!isSameOrInsidePath(baseDir, requestedTarget, pathApi)) {
    return failure('outside-workspace');
  }
  if (!isWritableDocumentTarget(baseDir, requestedTarget, pathApi)) {
    return failure('read-only', 'Only Markdown documents outside .git can be saved');
  }

  let canonicalBase;
  let target;
  try {
    [canonicalBase, target] = await Promise.all([
      canonicalExistingPath(baseDir, fsApi),
      canonicalExistingPath(requestedTarget, fsApi),
    ]);
  } catch (error) {
    if (error?.code === 'ENOENT') return failure('missing');
    return failure('write-failed', error);
  }
  if (!isSameOrInsidePath(canonicalBase, target, pathApi)) {
    return failure('outside-workspace');
  }
  // A Markdown-named link must not let a save reach a non-document or a .git file.
  if (!isWritableDocumentTarget(canonicalBase, target, pathApi)) {
    return failure('read-only', 'Only Markdown documents outside .git can be saved');
  }

  let currentRevision;
  let diskSource;
  let originalMode;
  try {
    const stat = await fsApi.promises.stat(target);
    currentRevision = revisionFromStat(stat);
    originalMode = stat.mode;
    diskSource = await fsApi.promises.readFile(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return failure('missing');
    return failure('write-failed', error);
  }

  // A missing expected revision means the caller never saw the file on disk, so it cannot know what it overwrites.
  if (!force && expectedRevision !== currentRevision) {
    return {
      ok: false,
      reason: 'conflict',
      diskSource,
      diskRevision: currentRevision,
    };
  }

  // Replacing via rename would otherwise bypass a read-only attribute that a direct write respects.
  if (Number.isFinite(originalMode) && (originalMode & 0o200) === 0) {
    return failure('permission-denied', 'The document is read-only');
  }

  try {
    const replaced = await writeFileAtomically(target, source, {
      fsApi,
      pathApi,
      platform,
      retryDelaysMs: renameRetryDelaysMs,
      mode: originalMode,
    });
    if (!replaced) await fsApi.promises.writeFile(target, source, 'utf8');
    return {
      ok: true,
      revision: await revisionFor(target, fsApi),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return failure('missing');
    return failure('write-failed', error);
  }
}

module.exports = {
  revisionFromStat,
  revisionFor,
  revisionForSync,
  documentWriteCapabilityFor,
  saveWorkspaceDocument,
};
