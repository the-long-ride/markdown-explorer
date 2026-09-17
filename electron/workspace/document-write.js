const fs = require('node:fs');
const path = require('node:path');

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
  if (!/\.mdx?$/i.test(String(filePath || ''))) {
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

async function saveWorkspaceDocument({
  workspacePath,
  filePath,
  source,
  expectedRevision = null,
  force = false,
  fsApi = fs,
  pathApi = path,
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

  let currentRevision;
  let diskSource;
  try {
    currentRevision = await revisionFor(target, fsApi);
    diskSource = await fsApi.promises.readFile(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return failure('missing');
    return failure('write-failed', error);
  }

  if (!force && expectedRevision !== null && expectedRevision !== currentRevision) {
    return {
      ok: false,
      reason: 'conflict',
      diskSource,
      diskRevision: currentRevision,
    };
  }

  try {
    await fsApi.promises.writeFile(target, source, 'utf8');
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
