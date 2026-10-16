'use strict';

const fs = require('fs');
const path = require('path');
const { nameError, hasProtectedSegment, hasStreamSegment } = require('./workspace-entry-name');

function splitRelative(value) {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') return null;
  const parts = value.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\\'))) return null;
  return parts;
}

function errorReason(error) {
  switch (error && error.code) {
    case 'EEXIST': return 'exists';
    case 'EACCES':
    case 'EPERM': return 'permission-denied';
    case 'ENOENT':
    case 'ENOTDIR': return 'missing';
    default: return 'failed';
  }
}

function isWithin(base, target) {
  const relative = path.relative(base, target);
  return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative));
}

/** Segments of a resolved path below the resolved workspace base (callers check containment first). */
function relativeSegments(base, target) {
  return path.relative(base, target).split(path.sep).filter(Boolean);
}

async function resolveBase(workspacePath, fsApi) {
  if (!workspacePath) return { reason: 'unsupported' };
  try {
    const stat = await fsApi.promises.stat(workspacePath);
    if (!stat.isDirectory()) return { reason: 'unsupported' };
    return { base: await fsApi.promises.realpath(workspacePath) };
  } catch (error) {
    return { reason: errorReason(error) };
  }
}

function failure(reason, error) {
  return error ? { ok: false, reason, error: String(error.message || error) } : { ok: false, reason };
}

async function createWorkspaceEntry({ workspacePath, parentPath, name, kind, fsApi = fs }) {
  if (kind !== 'file' && kind !== 'folder') return failure('invalid-name');
  if (typeof name !== 'string') return failure('invalid-name');
  const problem = nameError(name);
  if (problem) return failure(problem === 'protected' ? 'protected' : 'invalid-name');
  const parentParts = splitRelative(parentPath);
  if (!parentParts) return failure('outside-workspace');
  if (hasProtectedSegment(parentParts)) return failure('protected');
  if (hasStreamSegment(parentParts)) return failure('invalid-name');
  const { base, reason } = await resolveBase(workspacePath, fsApi);
  if (!base) return failure(reason);
  let parentReal;
  try {
    parentReal = await fsApi.promises.realpath(path.join(base, ...parentParts));
  } catch (error) {
    return failure(errorReason(error), error);
  }
  if (!isWithin(base, parentReal)) return failure('outside-workspace');
  // The raw segments can hide .git (8.3 alias GIT~1, symlink/junction): re-check the resolved location.
  if (hasProtectedSegment(relativeSegments(base, parentReal))) return failure('protected');
  const target = path.join(parentReal, name);
  try {
    if (kind === 'folder') await fsApi.promises.mkdir(target);
    else await (await fsApi.promises.open(target, 'wx')).close();
  } catch (error) {
    return failure(errorReason(error), error);
  }
  return { ok: true, kind, path: [...parentParts, name].join('/') };
}

async function deleteOne(base, entryPath, trashItem, fsApi) {
  const parts = splitRelative(entryPath);
  if (!parts) return 'outside-workspace';
  if (parts.length === 0 || hasProtectedSegment(parts)) return 'protected';
  if (hasStreamSegment(parts)) return 'invalid-name';
  try {
    const parentReal = await fsApi.promises.realpath(path.join(base, ...parts.slice(0, -1)));
    if (!isWithin(base, parentReal)) return 'outside-workspace';
    if (hasProtectedSegment(relativeSegments(base, parentReal))) return 'protected';
    // Resolve only the parent so a symlink entry is removed as a link.
    const target = path.join(parentReal, parts[parts.length - 1]);
    const stat = await fsApi.promises.lstat(target);
    if (!stat.isSymbolicLink()) {
      // A real entry may still be .git under an alias (8.3 name): check where it truly lives.
      const targetReal = await fsApi.promises.realpath(target);
      if (!isWithin(base, targetReal)) return 'outside-workspace';
      if (hasProtectedSegment(relativeSegments(base, targetReal))) return 'protected';
    }
    await trashItem(target);
    return null;
  } catch (error) {
    return errorReason(error);
  }
}

async function deleteWorkspaceEntries({ workspacePath, paths, trashItem, fsApi = fs }) {
  const deleted = [];
  const failed = [];
  const { base, reason } = await resolveBase(workspacePath, fsApi);
  for (const entryPath of Array.isArray(paths) ? paths : []) {
    if (typeof entryPath !== 'string') {
      failed.push({ path: '', reason: 'outside-workspace' });
      continue;
    }
    const problem = base ? await deleteOne(base, entryPath, trashItem, fsApi) : reason;
    if (problem) failed.push({ path: entryPath, reason: problem });
    else deleted.push(entryPath);
  }
  return { deleted, failed };
}

async function renameWorkspaceEntry({ workspacePath, path: entryPath, name, kind, fsApi = fs }) {
  const fail = failure;
  if (typeof entryPath !== 'string') return fail('outside-workspace');
  if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
  const parts = splitRelative(entryPath);
  if (!parts) return fail('outside-workspace');
  if (!parts.length || hasProtectedSegment(parts)) return fail('protected');
  if (hasStreamSegment(parts)) return fail('invalid-name');
  if (typeof name !== 'string' || nameError(name)) return fail(nameError(typeof name === 'string' ? name : '') === 'protected' ? 'protected' : 'invalid-name');
  const { base, reason } = await resolveBase(workspacePath, fsApi);
  if (!base) return fail(reason || 'unsupported');
  try {
    const parent = await fsApi.promises.realpath(path.join(base, ...parts.slice(0, -1)));
    if (!isWithin(base, parent)) return fail('outside-workspace');
    if (hasProtectedSegment(relativeSegments(base, parent))) return fail('protected');
    const source = path.join(parent, parts[parts.length - 1]);
    const stat = await fsApi.promises.lstat(source);
    if (!stat.isSymbolicLink()) {
      const real = await fsApi.promises.realpath(source);
      if (!isWithin(base, real)) return fail('outside-workspace');
      if (hasProtectedSegment(relativeSegments(base, real))) return fail('protected');
    }
    if ((kind === 'folder') !== stat.isDirectory()) return fail('missing');
    const next = [...parts.slice(0, -1), name].join('/');
    if (entryPath === next) return { ok: true, oldPath: entryPath, path: next, kind };
    const target = path.join(parent, name);
    let sameEntry = false;
    try {
      const existing = await fsApi.promises.lstat(target);
      sameEntry = parts[parts.length - 1].toLowerCase() === name.toLowerCase()
        && existing.dev === stat.dev && existing.ino === stat.ino;
      if (!sameEntry) return fail('exists');
    } catch (error) { if (errorReason(error) !== 'missing') throw error; }
    if (sameEntry) {
      // Stage into an exclusively created directory so Windows also changes the stored casing.
      const staging = await fsApi.promises.mkdtemp(path.join(parent, '.mdx-rename-'));
      const staged = path.join(staging, 'entry');
      await fsApi.promises.rename(source, staged);
      try { await fsApi.promises.rename(staged, target); }
      catch (error) { await fsApi.promises.rename(staged, source); throw error; }
      finally { await fsApi.promises.rmdir(staging).catch(() => {}); }
    } else if (stat.isFile()) {
      // link is exclusive: a racing destination cannot be overwritten.
      try { await fsApi.promises.link(source, target); }
      catch (error) {
        if (['ENOTSUP', 'EOPNOTSUPP', 'EPERM', 'EXDEV'].includes(String((error).code))) await fsApi.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
        else throw error;
      }
      try { await fsApi.promises.unlink(source); }
      catch (error) { await fsApi.promises.unlink(target); throw error; }
    } else {
      await fsApi.promises.rename(source, target);
    }
    return { ok: true, oldPath: entryPath, path: next, kind };
  } catch (error) { return fail(errorReason(error), error); }
}

function createWorkspaceEntryHandlers({ getWorkspacePath, sendHostMessage, refresh, trashItem, onRename = () => {}, fsApi = fs }) {
  const refreshQuietly = async () => {
    try { await refresh(); } catch (error) { console.error('Workspace refresh after entry change failed:', error); }
  };
  return {
    async handleCreateWorkspaceEntry(msg) {
      const request = msg ?? {};
      let result;
      try {
        result = await createWorkspaceEntry({
          workspacePath: getWorkspacePath(), parentPath: request.parentPath, name: request.name, kind: request.kind, fsApi,
        });
      } catch (error) {
        result = failure('failed', error);
      }
      if (result.ok) await refreshQuietly();
      sendHostMessage({ command: 'createWorkspaceEntryResult', requestId: request.requestId, ...result });
    },
    async handleRenameWorkspaceEntry(msg) {
      const request = msg ?? {};
      const origin = getWorkspacePath();
      const result = await renameWorkspaceEntry({ ...request, workspacePath: origin, fsApi });
      if (result.ok && getWorkspacePath() === origin) onRename(result.oldPath, result.path);
      sendHostMessage({ command: 'renameWorkspaceEntryResult', requestId: request.requestId, ...result });
      if (result.ok) await refreshQuietly();
    },
    async handleDeleteWorkspaceEntries(msg) {
      const request = msg ?? {};
      let result;
      try {
        result = await deleteWorkspaceEntries({ workspacePath: getWorkspacePath(), paths: request.paths, trashItem: request.mode === 'permanent' ? (target) => fsApi.promises.rm(target, { recursive: true }) : trashItem, fsApi });
      } catch {
        const requested = Array.isArray(request.paths) ? request.paths : [];
        result = { deleted: [], failed: requested.map((entry) => ({ path: typeof entry === 'string' ? entry : '', reason: 'failed' })) };
      }
      if (result.deleted.length > 0) await refreshQuietly();
      sendHostMessage({ command: 'deleteWorkspaceEntriesResult', requestId: request.requestId, mode: request.mode === 'permanent' ? 'permanent' : 'trash', ...result });
    },
  };
}

module.exports = { renameWorkspaceEntry, createWorkspaceEntry, deleteWorkspaceEntries, createWorkspaceEntryHandlers };
