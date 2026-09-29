const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { realpath: realpathCallback } = require('node:fs');
const { GIT_TIMEOUT_MS, GitHistoryError, MAX_GIT_OUTPUT_BYTES, runGit, toGitHistoryError } = require('./git-runner');

const FULL_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 500;
const REVISION_DOCUMENT_PATH = /\.(?:md|mdx|txt|doc|docx|pdf|html?|xls|xlsx|xlm|pptx|odt|odp|ods|rtf)$/i;

function normalizeHistoryLimit(limit) {
  if (!Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.trunc(limit)));
}

function normalizeHistoryOffset(offset) {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

function toGitPath(value) {
  return value.split(path.sep).join('/');
}

function isSameOrInside(basePath, targetPath) {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function workspaceDirectory(workspacePath) {
  if (typeof workspacePath !== 'string' || !workspacePath.trim()) {
    throw new GitHistoryError('A workspace path is required', 'not-repository');
  }
  const resolved = path.resolve(workspacePath);
  try {
    const info = await stat(resolved);
    return info.isFile() ? path.dirname(resolved) : resolved;
  } catch {
    return resolved;
  }
}

const REPOSITORY_PAGE_OVERLAP = 20;

const realpathNative = promisify(realpathCallback.native);

async function realpathOrSelf(value) {
  const resolved = path.resolve(value);
  try {
    return await realpathNative(resolved);
  } catch {
    return resolved;
  }
}

async function computeGitContext(workspacePath) {
  const cwd = await workspaceDirectory(workspacePath);
  const root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim();
  if (!root) throw new GitHistoryError('The workspace is not a Git repository', 'not-repository');
  // Compare real paths on both sides so junctions, symlinks, subst drives and casing agree with Git.
  const repositoryRoot = await realpathOrSelf(root);
  const workspaceRoot = await realpathOrSelf(cwd);
  if (!isSameOrInside(repositoryRoot, workspaceRoot)) {
    throw new GitHistoryError('The workspace is outside the Git repository', 'not-repository');
  }
  return { repositoryRoot, workspaceRoot };
}

const gitContextCache = new Map();

function gitContextKey(workspacePath) {
  return typeof workspacePath === 'string' ? path.resolve(workspacePath) : '';
}

function resolveGitContext(workspacePath) {
  const key = gitContextKey(workspacePath);
  const cached = gitContextCache.get(key);
  if (cached) return cached;
  const pending = computeGitContext(workspacePath);
  gitContextCache.set(key, pending);
  pending.catch(() => {
    if (gitContextCache.get(key) === pending) gitContextCache.delete(key);
  });
  return pending;
}

function clearGitContextCache() {
  gitContextCache.clear();
}

async function resolveRepository(workspacePath) {
  return (await resolveGitContext(workspacePath)).repositoryRoot;
}

function assertWorkspacePath(workspaceRoot, absolute) {
  if (!isSameOrInside(workspaceRoot, absolute)) {
    throw new GitHistoryError('Document path is outside workspace', 'outside-workspace');
  }
}

function repositoryRelativePath(repositoryRoot, filePath, workspaceRoot = repositoryRoot) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new GitHistoryError('A document path is required', 'outside-repository');
  }
  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(repositoryRoot, filePath);
  if (!isSameOrInside(repositoryRoot, absolute)) {
    throw new GitHistoryError('Document path is outside repository', 'outside-repository');
  }
  assertWorkspacePath(workspaceRoot, absolute);
  const relative = path.relative(repositoryRoot, absolute);
  if (!relative || relative === '.') {
    throw new GitHistoryError('Document path must identify a file inside the repository', 'outside-repository');
  }
  return toGitPath(relative);
}

function validateGitPath(repositoryRoot, gitPath, workspaceRoot = repositoryRoot) {
  if (typeof gitPath !== 'string' || !gitPath.trim() || path.isAbsolute(gitPath)) {
    throw new GitHistoryError('Document path is outside repository', 'outside-repository');
  }
  const normalized = gitPath.replace(/\\/g, '/');
  const absolute = path.resolve(repositoryRoot, ...normalized.split('/'));
  if (!isSameOrInside(repositoryRoot, absolute)) {
    throw new GitHistoryError('Document path is outside repository', 'outside-repository');
  }
  assertWorkspacePath(workspaceRoot, absolute);
  return toGitPath(path.relative(repositoryRoot, absolute));
}

function validateOid(oid) {
  if (typeof oid !== 'string' || !FULL_OID.test(oid)) {
    throw new GitHistoryError('Invalid revision identifier', 'invalid-revision');
  }
  return oid.toLowerCase();
}

function parseHistory(output, initialPath) {
  const records = output.split('\x1e').slice(1);
  const revisions = [];
  let trackedPath = initialPath;

  for (const rawRecord of records) {
    // With -z the header ends at the first NUL, followed by NUL-separated status and path fields.
    const headerEnd = rawRecord.indexOf('\0');
    const header = (headerEnd === -1 ? rawRecord : rawRecord.slice(0, headerEnd)).replace(/^\r?\n/, '');
    const fields = headerEnd === -1 ? [] : rawRecord.slice(headerEnd + 1).split('\0');
    if (fields.length > 0) fields[0] = fields[0].replace(/^\r?\n/, '');
    const [oid, author = '', authoredAt = '', subject = ''] = header.split('\x1f');
    if (!FULL_OID.test(oid || '')) continue;

    const snapshotPath = trackedPath;
    revisions.push({
      oid,
      shortOid: oid.slice(0, 7),
      author,
      authoredAt,
      subject,
      path: snapshotPath,
    });

    for (let index = 0; index < fields.length;) {
      const status = fields[index];
      if (!status) {
        index += 1;
        continue;
      }
      if (!/^[RC]\d*$/.test(status)) {
        index += 2;
        continue;
      }
      const oldPath = fields[index + 1];
      const newPath = fields[index + 2];
      index += 3;
      if (status.startsWith('R') && oldPath && newPath === trackedPath) {
        trackedPath = oldPath;
        break;
      }
    }
  }

  return revisions;
}

function parseRepositoryHistory(output, headOid) {
  const records = output.split('\x1e').slice(1);
  const commits = [];
  for (const rawRecord of records) {
    const header = rawRecord.replace(/^\r?\n/, '').split(/\r?\n/, 1)[0] || '';
    const [oid, parents = '', author = '', authoredAt = '', subject = '', decorations = ''] = header.split('\x1f');
    if (!FULL_OID.test(oid || '')) continue;
    commits.push({
      oid,
      shortOid: oid.slice(0, 7),
      parentOids: parents.split(/\s+/).filter((parentOid) => FULL_OID.test(parentOid)),
      author,
      authoredAt,
      subject,
      refs: decorations.split(',').map((value) => value.trim()).filter(Boolean),
      isHead: oid.toLowerCase() === headOid.toLowerCase(),
    });
  }
  return commits;
}

function workspaceRepositoryPrefix(repositoryRoot, workspaceRoot) {
  const relative = path.relative(repositoryRoot, workspaceRoot);
  return relative && relative !== '.' ? toGitPath(relative) : '';
}

function validateWorkspaceRelativePath(repositoryRoot, workspaceRoot, workspacePath) {
  if (typeof workspacePath !== 'string' || !workspacePath.trim() || path.isAbsolute(workspacePath)) {
    throw new GitHistoryError('Revision path is outside workspace', 'outside-workspace');
  }
  const normalized = workspacePath.replace(/\\/g, '/');
  const absolute = path.resolve(workspaceRoot, ...normalized.split('/'));
  assertWorkspacePath(workspaceRoot, absolute);
  if (!isSameOrInside(repositoryRoot, absolute)) {
    throw new GitHistoryError('Revision path is outside repository', 'outside-repository');
  }
  const relativeToWorkspace = toGitPath(path.relative(workspaceRoot, absolute));
  if (!relativeToWorkspace || relativeToWorkspace === '.') {
    throw new GitHistoryError('Revision path must identify a file inside the workspace', 'outside-workspace');
  }
  return {
    workspacePath: relativeToWorkspace,
    repositoryPath: toGitPath(path.relative(repositoryRoot, absolute)),
  };
}

async function listDocumentHistory({ workspacePath, filePath, limit } = {}) {
  const { repositoryRoot, workspaceRoot } = await resolveGitContext(workspacePath);
  const gitPath = repositoryRelativePath(repositoryRoot, filePath, workspaceRoot);
  const output = await runGit(repositoryRoot, [
    'log',
    '--follow',
    '--format=%x1e%H%x1f%an%x1f%aI%x1f%s',
    '--name-status',
    '-z',
    '-M',
    '-n',
    String(normalizeHistoryLimit(limit)),
    '--',
    gitPath,
  ]);
  return parseHistory(output, gitPath);
}

async function listRepositoryHistory({ workspacePath, limit, offset, before, allRefs } = {}) {
  const { repositoryRoot } = await resolveGitContext(workspacePath);
  const pageLimit = normalizeHistoryLimit(limit);
  const refs = allRefs === true ? ['--all'] : ['HEAD'];
  const format = '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D';
  const cursor = typeof before === 'string' && FULL_OID.test(before) ? before : null;
  const explicitOffset = Number.isFinite(offset);
  let logArgs;
  if (cursor) {
    const committedAt = (await runGit(repositoryRoot, ['show', '-s', '--format=%ct', cursor])).trim();
    logArgs = ['log', ...refs, format, `--until=${committedAt}`, '-n', String(pageLimit + REPOSITORY_PAGE_OVERLAP)];
  } else {
    logArgs = ['log', ...refs, format, `--skip=${normalizeHistoryOffset(offset)}`, '-n', String(pageLimit)];
  }
  const [headOutput, output] = await Promise.all([
    runGit(repositoryRoot, ['rev-parse', 'HEAD']),
    runGit(repositoryRoot, logArgs),
  ]);
  const commits = parseRepositoryHistory(output, headOutput.trim());
  if (!cursor) return commits;
  const cursorIndex = commits.findIndex((commit) => commit.oid === cursor);
  // A cursor outside the listed history must not silently restart from the first page.
  if (cursorIndex < 0) return explicitOffset ? listRepositoryHistory({ workspacePath, limit: pageLimit, offset, allRefs }) : [];
  const page = commits.slice(cursorIndex + 1, cursorIndex + 1 + pageLimit);
  const windowFull = commits.length === pageLimit + REPOSITORY_PAGE_OVERLAP;
  if (page.length === pageLimit || !windowFull) return page;
  // Too many same-second commits precede the cursor for the overlap window: page by offset instead.
  return explicitOffset ? listRepositoryHistory({ workspacePath, limit: pageLimit, offset, allRefs }) : page;
}

async function listRevisionFiles({ workspacePath, oid } = {}) {
  const validatedOid = validateOid(oid);
  const { repositoryRoot, workspaceRoot } = await resolveGitContext(workspacePath);
  const prefix = workspaceRepositoryPrefix(repositoryRoot, workspaceRoot);
  const args = ['ls-tree', '-r', '-z', '--name-only', validatedOid];
  if (prefix) args.push('--', prefix);
  const output = await runGit(repositoryRoot, args);
  const prefixWithSlash = prefix ? `${prefix}/` : '';
  return output
    .split('\0')
    .filter(Boolean)
    .flatMap((repositoryPath) => {
      if (prefixWithSlash && !repositoryPath.startsWith(prefixWithSlash)) return [];
      const workspaceRelative = prefixWithSlash ? repositoryPath.slice(prefixWithSlash.length) : repositoryPath;
      if (!workspaceRelative || !REVISION_DOCUMENT_PATH.test(workspaceRelative)) return [];
      return [{ path: workspaceRelative }];
    });
}

async function readGitRevision({ workspacePath, oid, path: revisionPath } = {}) {
  const validatedOid = validateOid(oid);
  const { repositoryRoot, workspaceRoot } = await resolveGitContext(workspacePath);
  const gitPath = validateGitPath(repositoryRoot, revisionPath, workspaceRoot);
  const source = await runGit(repositoryRoot, ['show', `${validatedOid}:${gitPath}`]);
  return { oid: validatedOid, path: gitPath, source };
}

async function readRevisionFile({ workspacePath, oid, path: revisionPath } = {}) {
  const validatedOid = validateOid(oid);
  const { repositoryRoot, workspaceRoot } = await resolveGitContext(workspacePath);
  const validatedPath = validateWorkspaceRelativePath(repositoryRoot, workspaceRoot, revisionPath);
  const source = await runGit(repositoryRoot, ['show', `${validatedOid}:${validatedPath.repositoryPath}`]);
  return { oid: validatedOid, path: validatedPath.workspacePath, source };
}

// The lexical check cannot see symlinks or junctions, so re-check the real target and cap the read.
async function readCurrentWorkspaceFile(workspaceRoot, absolutePath) {
  let realPath;
  try {
    realPath = await realpathNative(absolutePath);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new GitHistoryError('The current file does not exist', 'missing', error);
    throw toGitHistoryError(error);
  }
  assertWorkspacePath(workspaceRoot, realPath);
  const info = await stat(realPath);
  if (!info.isFile()) throw new GitHistoryError('The current path is not a file', 'missing');
  if (info.size > MAX_GIT_OUTPUT_BYTES) {
    throw new GitHistoryError('The current file exceeds the allowed size', 'output-too-large');
  }
  return readFile(realPath, 'utf8');
}

async function readCompareSide(repositoryRoot, workspaceRoot, side) {
  if (!side || typeof side !== 'object') {
    throw new GitHistoryError('Invalid comparison side', 'invalid-comparison');
  }
  if (side.kind === 'revision') {
    const oid = validateOid(side.oid);
    const gitPath = validateGitPath(repositoryRoot, side.path, workspaceRoot);
    return {
      source: await runGit(repositoryRoot, ['show', `${oid}:${gitPath}`]),
      label: `${oid.slice(0, 7)}:${gitPath}`,
    };
  }
  if (side.kind === 'current') {
    const gitPath = repositoryRelativePath(repositoryRoot, side.path, workspaceRoot);
    return {
      source: await readCurrentWorkspaceFile(workspaceRoot, path.resolve(repositoryRoot, ...gitPath.split('/'))),
      label: `Current:${gitPath}`,
    };
  }
  throw new GitHistoryError('Invalid comparison side', 'invalid-comparison');
}

async function compareGitSources({ workspacePath, left, right } = {}) {
  const { repositoryRoot, workspaceRoot } = await resolveGitContext(workspacePath);
  const [leftResult, rightResult] = await Promise.all([
    readCompareSide(repositoryRoot, workspaceRoot, left),
    readCompareSide(repositoryRoot, workspaceRoot, right),
  ]);
  return {
    leftSource: leftResult.source,
    rightSource: rightResult.source,
    leftLabel: leftResult.label,
    rightLabel: rightResult.label,
  };
}

function createGitHistoryMessageHandlers(options) {
  return require('./git-history-handlers').createGitHistoryMessageHandlers(options);
}

module.exports = {
  FULL_OID,
  GIT_TIMEOUT_MS,
  clearGitContextCache,
  resolveGitContext,
  toGitHistoryError,
  GitHistoryError,
  MAX_GIT_OUTPUT_BYTES,
  compareGitSources,
  createGitHistoryMessageHandlers,
  listDocumentHistory,
  listRepositoryHistory,
  listRevisionFiles,
  parseHistory,
  parseRepositoryHistory,
  readGitRevision,
  readRevisionFile,
  resolveRepository,
};
