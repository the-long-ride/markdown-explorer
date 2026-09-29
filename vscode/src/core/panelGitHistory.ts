import { execFile as nodeExecFile } from 'node:child_process';
import { realpath as realpathCallback } from 'node:fs';
import { readFile as nodeReadFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const FULL_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const GIT_TIMEOUT_MS = 20000;
const REPOSITORY_PAGE_OVERLAP = 20;
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 500;

type GitCompareSide =
  | { readonly kind: 'revision'; readonly oid: string; readonly path: string }
  | { readonly kind: 'current'; readonly path: string };

type ExecFileImpl = (
  file: string,
  args: readonly string[],
  options: Record<string, unknown>,
  callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void,
) => unknown;

type ReadFileImpl = (filePath: string, encoding: 'utf8') => Promise<string>;
type RealpathImpl = (value: string) => Promise<string>;
type StatImpl = (value: string) => Promise<{ size: number; isFile(): boolean }>;

// Mirrors ui/src/history/revisionWorkspace.ts `isRevisionDocumentPath` with document conversion on.
const REVISION_DOCUMENT_PATH = /\.(?:md|mdx|txt|doc|docx|pdf|html?|xls|xlsx|xlm|pptx|odt|odp|ods|rtf)$/i;
// Git quotes non-ASCII paths unless told otherwise; every call opts out.
const GIT_BASE_ARGS = ['-c', 'core.quotePath=false'] as const;

const realpathNative = promisify(realpathCallback.native) as RealpathImpl;

export class PanelGitHistoryError extends Error {
  readonly originalError?: unknown;

  constructor(message: string, readonly reason = 'git-error', originalError?: unknown) {
    super(message);
    this.name = 'PanelGitHistoryError';
    this.originalError = originalError;
  }
}

function isSameOrInside(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toGitPath(value: string): string {
  return value.split(path.sep).join('/');
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.trunc(limit!)));
}

function normalizeOffset(offset?: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset!));
}

function validateOid(oid: string): string {
  if (!FULL_OID.test(oid || '')) throw new PanelGitHistoryError('Invalid revision identifier', 'invalid-revision');
  return oid.toLowerCase();
}

function assertWorkspacePath(workspaceRoot: string, absolute: string): void {
  if (!isSameOrInside(workspaceRoot, absolute)) {
    throw new PanelGitHistoryError('Document path is outside workspace', 'outside-workspace');
  }
}

function validateGitPath(repositoryRoot: string, workspaceRoot: string, gitPath: string): string {
  if (!gitPath || path.isAbsolute(gitPath)) throw new PanelGitHistoryError('Document path is outside repository', 'outside-repository');
  const absolute = path.resolve(repositoryRoot, ...gitPath.replace(/\\/g, '/').split('/'));
  if (!isSameOrInside(repositoryRoot, absolute)) throw new PanelGitHistoryError('Document path is outside repository', 'outside-repository');
  assertWorkspacePath(workspaceRoot, absolute);
  return toGitPath(path.relative(repositoryRoot, absolute));
}

function repositoryRelativePath(repositoryRoot: string, workspaceRoot: string, filePath: string): string {
  if (!filePath) throw new PanelGitHistoryError('A document path is required', 'outside-repository');
  const absolute = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(repositoryRoot, filePath);
  if (!isSameOrInside(repositoryRoot, absolute)) throw new PanelGitHistoryError('Document path is outside repository', 'outside-repository');
  assertWorkspacePath(workspaceRoot, absolute);
  const relative = path.relative(repositoryRoot, absolute);
  if (!relative) throw new PanelGitHistoryError('Document path must identify a file', 'outside-repository');
  return toGitPath(relative);
}

function workspaceRepositoryPrefix(repositoryRoot: string, workspaceRoot: string): string {
  const relative = path.relative(repositoryRoot, workspaceRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PanelGitHistoryError('Workspace is outside repository', 'outside-workspace');
  }
  return relative && relative !== '.' ? toGitPath(relative) : '';
}

function validateWorkspaceRelativePath(repositoryRoot: string, workspaceRoot: string, filePath: string): { workspacePath: string; repositoryPath: string } {
  if (!filePath || path.isAbsolute(filePath)) throw new PanelGitHistoryError('Revision path is outside workspace', 'outside-workspace');
  const normalized = filePath.replace(/\\/g, '/');
  const absolute = path.resolve(workspaceRoot, ...normalized.split('/'));
  assertWorkspacePath(workspaceRoot, absolute);
  if (!isSameOrInside(repositoryRoot, absolute)) throw new PanelGitHistoryError('Revision path is outside repository', 'outside-repository');
  const workspacePath = toGitPath(path.relative(workspaceRoot, absolute));
  if (!workspacePath || workspacePath === '.') throw new PanelGitHistoryError('Revision path must identify a file', 'outside-workspace');
  return { workspacePath, repositoryPath: toGitPath(path.relative(repositoryRoot, absolute)) };
}

export function parsePanelGitHistory(output: string, initialPath: string) {
  const revisions: Array<{ oid: string; shortOid: string; author: string; authoredAt: string; subject: string; path: string }> = [];
  let trackedPath = initialPath;
  // Expects `git log -z --name-status`: the header ends at the first NUL, then status/path fields are NUL-separated.
  for (const rawRecord of output.split('\x1e').slice(1)) {
    const headerEnd = rawRecord.indexOf('\0');
    const header = headerEnd >= 0 ? rawRecord.slice(0, headerEnd) : rawRecord.split(/\r?\n/, 1)[0];
    const fields = headerEnd >= 0 ? rawRecord.slice(headerEnd + 1).replace(/^\r?\n/, '').split('\0') : [];
    const [oid, author = '', authoredAt = '', subject = ''] = header.split('\x1f');
    if (!FULL_OID.test(oid || '')) continue;
    revisions.push({ oid, shortOid: oid.slice(0, 7), author, authoredAt, subject, path: trackedPath });
    for (let index = 0; index < fields.length; index += 1) {
      const status = fields[index];
      if (/^[RC]\d*$/.test(status)) {
        const [from, to] = [fields[index + 1], fields[index + 2]];
        if (status.startsWith('R') && to === trackedPath && from) {
          trackedPath = from;
          break;
        }
        index += 2;
      } else if (status) {
        index += 1;
      }
    }
  }
  return revisions;
}

export function parsePanelRepositoryHistory(output: string, headOid: string) {
  return output.split('\x1e').slice(1).flatMap((rawRecord) => {
    const header = rawRecord.replace(/^\r?\n/, '').split(/\r?\n/, 1)[0] || '';
    const [oid, parents = '', author = '', authoredAt = '', subject = '', decorations = ''] = header.split('\x1f');
    if (!FULL_OID.test(oid || '')) return [];
    return [{
      oid,
      shortOid: oid.slice(0, 7),
      parentOids: parents.split(/\s+/).filter((parentOid) => FULL_OID.test(parentOid)),
      author,
      authoredAt,
      subject,
      refs: decorations.split(',').map((value) => value.trim()).filter(Boolean),
      isHead: oid.toLowerCase() === headOid.toLowerCase(),
    }];
  });
}

export function createPanelGitHistoryAdapter({
  execFileImpl = nodeExecFile as unknown as ExecFileImpl,
  readFileImpl = nodeReadFile as unknown as ReadFileImpl,
  realpathImpl = realpathNative,
  statImpl = stat as unknown as StatImpl,
}: {
  execFileImpl?: ExecFileImpl;
  readFileImpl?: ReadFileImpl;
  realpathImpl?: RealpathImpl;
  statImpl?: StatImpl;
} = {}) {
  async function isDirectory(value: string): Promise<boolean> {
    try { return (await stat(value)).isDirectory(); } catch { return false; }
  }

  async function runGit(cwd: string, args: readonly string[]): Promise<string> {
    try {
      return await execGit(cwd, args);
    } catch (error) {
      // spawn reports ENOENT for a missing cwd too; do not blame Git for a deleted folder.
      if (error instanceof PanelGitHistoryError && error.reason === 'git-unavailable' && !(await isDirectory(cwd))) {
        throw new PanelGitHistoryError('The workspace folder does not exist', 'not-repository', error);
      }
      throw error;
    }
  }

  async function execGit(cwd: string, args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFileImpl('git', [...GIT_BASE_ARGS, ...args], { cwd, windowsHide: true, maxBuffer: MAX_GIT_OUTPUT_BYTES, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }, (error, stdout = '', stderr = '') => {
        if (!error) { resolve(stdout); return; }
        if (error.code === 'ENOENT') { reject(new PanelGitHistoryError('Git executable is unavailable', 'git-unavailable', error)); return; }
        // Node kills the child on overflow, so test the buffer error before the generic killed flag.
        if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || /maxBuffer/i.test(String(error.message || ''))) { reject(new PanelGitHistoryError('Git output exceeded the allowed size', 'output-too-large', error)); return; }
        if ((error as { killed?: boolean }).killed) { reject(new PanelGitHistoryError('Git command timed out', 'git-timeout', error)); return; }
        reject(new PanelGitHistoryError((stderr || error.message || 'Git command failed').trim(), 'git-command-failed', error));
      });
    });
  }

  async function workspaceDirectory(workspacePath: string): Promise<string> {
    const resolved = path.resolve(workspacePath);
    try { return (await stat(resolved)).isFile() ? path.dirname(resolved) : resolved; } catch { return resolved; }
  }

  async function resolveContext(workspacePath: string): Promise<{ repositoryRoot: string; workspaceRoot: string }> {
    if (!workspacePath) throw new PanelGitHistoryError('A workspace path is required', 'not-repository');
    const workspaceRoot = await workspaceDirectory(workspacePath);
    const root = (await runGit(workspaceRoot, ['rev-parse', '--show-toplevel'])).trim();
    if (!root) throw new PanelGitHistoryError('The workspace is not a Git repository', 'not-repository');
    // Compare real paths on both sides so junctions, symlinks, subst drives and casing agree with Git.
    const repositoryRoot = await realpathOrSelf(root);
    const realWorkspaceRoot = await realpathOrSelf(workspaceRoot);
    if (!isSameOrInside(repositoryRoot, realWorkspaceRoot)) {
      throw new PanelGitHistoryError('The workspace is outside the Git repository', 'not-repository');
    }
    return { repositoryRoot, workspaceRoot: realWorkspaceRoot };
  }

  async function realpathOrSelf(value: string): Promise<string> {
    const resolved = path.resolve(value);
    try { return await realpathImpl(resolved); } catch { return resolved; }
  }

  async function listDocumentHistory({ workspacePath, filePath, limit }: { workspacePath: string; filePath: string; limit?: number }) {
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const gitPath = repositoryRelativePath(repositoryRoot, workspaceRoot, filePath);
    const output = await runGit(repositoryRoot, ['log', '--follow', '-z', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--name-status', '-M', '-n', String(normalizeLimit(limit)), '--', gitPath]);
    return parsePanelGitHistory(output, gitPath);
  }

  async function listRepositoryHistory({ workspacePath, limit, offset, before, allRefs }: { workspacePath: string; limit?: number; offset?: number; before?: string; allRefs?: boolean }) {
    const { repositoryRoot } = await resolveContext(workspacePath);
    const headOid = (await runGit(repositoryRoot, ['rev-parse', 'HEAD'])).trim();
    const pageLimit = normalizeLimit(limit);
    const refs = allRefs === true ? '--all' : 'HEAD';
    const format = '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D';
    const cursor = typeof before === 'string' && FULL_OID.test(before) ? before : null;
    if (!cursor) {
      const output = await runGit(repositoryRoot, ['log', refs, format, `--skip=${normalizeOffset(offset)}`, '-n', String(pageLimit)]);
      return parsePanelRepositoryHistory(output, headOid);
    }
    const committedAt = (await runGit(repositoryRoot, ['show', '-s', '--format=%ct', cursor])).trim();
    const output = await runGit(repositoryRoot, ['log', refs, format, `--until=${committedAt}`, '-n', String(pageLimit + REPOSITORY_PAGE_OVERLAP)]);
    const commits = parsePanelRepositoryHistory(output, headOid);
    const cursorIndex = commits.findIndex((commit) => commit.oid === cursor);
    const page = cursorIndex >= 0 ? commits.slice(cursorIndex + 1, cursorIndex + 1 + pageLimit) : [];
    const windowFull = commits.length === pageLimit + REPOSITORY_PAGE_OVERLAP;
    if (cursorIndex >= 0 && (page.length === pageLimit || !windowFull)) return page;
    // Too many same-second commits precede the cursor for the overlap window: page by offset when the caller gave one.
    // Without an offset, restarting would repeat page one, so end the listing instead.
    if (Number.isFinite(offset)) return listRepositoryHistory({ workspacePath, limit: pageLimit, offset, allRefs });
    return page;
  }

  async function listRevisionFiles({ workspacePath, oid }: { workspacePath: string; oid: string }) {
    const validatedOid = validateOid(oid);
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const prefix = workspaceRepositoryPrefix(repositoryRoot, workspaceRoot);
    const args = ['ls-tree', '-r', '-z', '--name-only', validatedOid];
    if (prefix) args.push('--', prefix);
    const output = await runGit(repositoryRoot, args);
    const prefixWithSlash = prefix ? `${prefix}/` : '';
    return output.split('\0').filter(Boolean).flatMap((repositoryPath) => {
      if (prefixWithSlash && !repositoryPath.startsWith(prefixWithSlash)) return [];
      const workspacePath = prefixWithSlash ? repositoryPath.slice(prefixWithSlash.length) : repositoryPath;
      return workspacePath && REVISION_DOCUMENT_PATH.test(workspacePath) ? [{ path: workspacePath }] : [];
    });
  }

  async function readGitRevision({ workspacePath, oid, path: revisionPath }: { workspacePath: string; oid: string; path: string }) {
    const validatedOid = validateOid(oid);
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const gitPath = validateGitPath(repositoryRoot, workspaceRoot, revisionPath);
    return { oid: validatedOid, path: gitPath, source: await runGit(repositoryRoot, ['show', `${validatedOid}:${gitPath}`]) };
  }

  async function readRevisionFile({ workspacePath, oid, path: revisionPath }: { workspacePath: string; oid: string; path: string }) {
    const validatedOid = validateOid(oid);
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const validatedPath = validateWorkspaceRelativePath(repositoryRoot, workspaceRoot, revisionPath);
    return {
      oid: validatedOid,
      path: validatedPath.workspacePath,
      source: await runGit(repositoryRoot, ['show', `${validatedOid}:${validatedPath.repositoryPath}`]),
    };
  }

  async function readSide(repositoryRoot: string, workspaceRoot: string, side: GitCompareSide) {
    if (side.kind === 'revision') {
      const oid = validateOid(side.oid);
      const gitPath = validateGitPath(repositoryRoot, workspaceRoot, side.path);
      return { source: await runGit(repositoryRoot, ['show', `${oid}:${gitPath}`]), label: `${oid.slice(0, 7)}:${gitPath}` };
    }
    const gitPath = repositoryRelativePath(repositoryRoot, workspaceRoot, side.path);
    const absolute = path.resolve(repositoryRoot, ...gitPath.split('/'));
    // The lexical check above cannot see symlinks or junctions: verify where the file really lives.
    let realPath: string;
    let size: number;
    try {
      realPath = await realpathImpl(absolute);
      const info = await statImpl(realPath);
      if (!info.isFile()) throw new PanelGitHistoryError('Current document is not a file', 'missing');
      size = info.size;
    } catch (error) {
      if (error instanceof PanelGitHistoryError) throw error;
      throw new PanelGitHistoryError('Current document is unavailable', 'missing', error);
    }
    if (!isSameOrInside(repositoryRoot, realPath) || !isSameOrInside(workspaceRoot, realPath)) {
      throw new PanelGitHistoryError('Document path is outside workspace', 'outside-workspace');
    }
    if (size > MAX_GIT_OUTPUT_BYTES) throw new PanelGitHistoryError('Current document exceeded the allowed size', 'output-too-large');
    return { source: await readFileImpl(realPath, 'utf8'), label: `Current:${gitPath}` };
  }

  async function compareGitSources({ workspacePath, left, right }: { workspacePath: string; left: GitCompareSide; right: GitCompareSide }) {
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const [leftResult, rightResult] = await Promise.all([readSide(repositoryRoot, workspaceRoot, left), readSide(repositoryRoot, workspaceRoot, right)]);
    return { leftSource: leftResult.source, rightSource: rightResult.source, leftLabel: leftResult.label, rightLabel: rightResult.label };
  }

  return {
    listDocumentHistory,
    listRepositoryHistory,
    listRevisionFiles,
    readGitRevision,
    readRevisionFile,
    compareGitSources,
  };
}

const defaultAdapter = createPanelGitHistoryAdapter();

export async function handlePanelGitHistoryMessage(
  msg: any,
  workspacePath: string | undefined,
  postMessage: (message: Record<string, unknown>) => PromiseLike<unknown> | unknown,
): Promise<boolean> {
  if (![
    'listDocumentHistory',
    'readGitRevision',
    'compareGitRevisions',
    'listRepositoryHistory',
    'listRevisionFiles',
    'readRevisionFile',
  ].includes(msg?.command)) return false;
  const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';
  const root = workspacePath || '';
  try {
    if (msg.command === 'listDocumentHistory') {
      const revisions = await defaultAdapter.listDocumentHistory({ workspacePath: root, filePath: msg.filePath, limit: msg.limit });
      await postMessage({ command: 'documentHistoryResult', requestId, ok: true, revisions });
    } else if (msg.command === 'listRepositoryHistory') {
      const commits = await defaultAdapter.listRepositoryHistory({ workspacePath: root, limit: msg.limit, offset: msg.offset, before: msg.before, allRefs: msg.allRefs === true });
      await postMessage({ command: 'repositoryHistoryResult', requestId, ok: true, commits });
    } else if (msg.command === 'listRevisionFiles') {
      const files = await defaultAdapter.listRevisionFiles({ workspacePath: root, oid: msg.oid });
      await postMessage({ command: 'revisionFilesResult', requestId, ok: true, files });
    } else if (msg.command === 'readRevisionFile') {
      const snapshot = await defaultAdapter.readRevisionFile({ workspacePath: root, oid: msg.oid, path: msg.path });
      await postMessage({ command: 'revisionFileResult', requestId, ok: true, snapshot });
    } else if (msg.command === 'readGitRevision') {
      const snapshot = await defaultAdapter.readGitRevision({ workspacePath: root, oid: msg.oid, path: msg.path });
      await postMessage({ command: 'gitRevisionResult', requestId, ok: true, snapshot });
    } else {
      const result = await defaultAdapter.compareGitSources({ workspacePath: root, left: msg.left, right: msg.right });
      await postMessage({ command: 'gitComparisonResult', requestId, ok: true, ...result });
    }
  } catch (error) {
    const reason = error instanceof PanelGitHistoryError ? error.reason : String(error instanceof Error ? error.message : error);
    if (msg.command === 'listDocumentHistory') await postMessage({ command: 'documentHistoryResult', requestId, ok: false, revisions: [], reason });
    else if (msg.command === 'listRepositoryHistory') await postMessage({ command: 'repositoryHistoryResult', requestId, ok: false, commits: [], reason });
    else if (msg.command === 'listRevisionFiles') await postMessage({ command: 'revisionFilesResult', requestId, ok: false, files: [], reason });
    else if (msg.command === 'readRevisionFile') await postMessage({ command: 'revisionFileResult', requestId, ok: false, reason });
    else if (msg.command === 'readGitRevision') await postMessage({ command: 'gitRevisionResult', requestId, ok: false, reason });
    else await postMessage({ command: 'gitComparisonResult', requestId, ok: false, reason });
  }
  return true;
}
