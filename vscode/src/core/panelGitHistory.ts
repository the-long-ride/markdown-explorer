import { execFile as nodeExecFile } from 'node:child_process';
import { readFile as nodeReadFile, stat } from 'node:fs/promises';
import * as path from 'node:path';

const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const FULL_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
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

export function parsePanelGitHistory(output: string, initialPath: string) {
  const revisions: Array<{ oid: string; shortOid: string; author: string; authoredAt: string; subject: string; path: string }> = [];
  let trackedPath = initialPath;
  for (const rawRecord of output.split('\x1e').slice(1)) {
    const lines = rawRecord.replace(/^\r?\n/, '').split(/\r?\n/);
    const [oid, author = '', authoredAt = '', subject = ''] = (lines.shift() || '').split('\x1f');
    if (!FULL_OID.test(oid || '')) continue;
    revisions.push({ oid, shortOid: oid.slice(0, 7), author, authoredAt, subject, path: trackedPath });
    for (const line of lines) {
      const fields = line.split('\t');
      if (/^R\d+$/.test(fields[0] || '') && fields.length >= 3 && fields[2] === trackedPath) {
        trackedPath = fields[1];
        break;
      }
    }
  }
  return revisions;
}

export function createPanelGitHistoryAdapter({
  execFileImpl = nodeExecFile as unknown as ExecFileImpl,
  readFileImpl = nodeReadFile as unknown as ReadFileImpl,
}: { execFileImpl?: ExecFileImpl; readFileImpl?: ReadFileImpl } = {}) {
  async function runGit(cwd: string, args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFileImpl('git', args, { cwd, windowsHide: true, maxBuffer: MAX_GIT_OUTPUT_BYTES, encoding: 'utf8' }, (error, stdout = '', stderr = '') => {
        if (!error) { resolve(stdout); return; }
        if (error.code === 'ENOENT') { reject(new PanelGitHistoryError('Git executable is unavailable', 'git-unavailable', error)); return; }
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
    const repositoryRoot = path.resolve(root);
    if (!isSameOrInside(repositoryRoot, workspaceRoot)) {
      throw new PanelGitHistoryError('The workspace is outside the Git repository', 'not-repository');
    }
    return { repositoryRoot, workspaceRoot: path.resolve(workspaceRoot) };
  }

  async function detectGitCapability(workspacePath: string) {
    try { return { supported: true as const, repositoryRoot: (await resolveContext(workspacePath)).repositoryRoot }; }
    catch (error) {
      return { supported: false as const, reason: error instanceof PanelGitHistoryError && error.reason === 'git-unavailable' ? 'git-unavailable' as const : 'not-repository' as const };
    }
  }

  async function listDocumentHistory({ workspacePath, filePath, limit }: { workspacePath: string; filePath: string; limit?: number }) {
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const gitPath = repositoryRelativePath(repositoryRoot, workspaceRoot, filePath);
    const output = await runGit(repositoryRoot, ['log', '--follow', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--name-status', '-M', '-n', String(normalizeLimit(limit)), '--', gitPath]);
    return parsePanelGitHistory(output, gitPath);
  }

  async function readGitRevision({ workspacePath, oid, path: revisionPath }: { workspacePath: string; oid: string; path: string }) {
    const validatedOid = validateOid(oid);
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const gitPath = validateGitPath(repositoryRoot, workspaceRoot, revisionPath);
    return { oid: validatedOid, path: gitPath, source: await runGit(repositoryRoot, ['show', `${validatedOid}:${gitPath}`]) };
  }

  async function readSide(repositoryRoot: string, workspaceRoot: string, side: GitCompareSide) {
    if (side.kind === 'revision') {
      const oid = validateOid(side.oid);
      const gitPath = validateGitPath(repositoryRoot, workspaceRoot, side.path);
      return { source: await runGit(repositoryRoot, ['show', `${oid}:${gitPath}`]), label: `${oid.slice(0, 7)}:${gitPath}` };
    }
    const gitPath = repositoryRelativePath(repositoryRoot, workspaceRoot, side.path);
    return { source: await readFileImpl(path.resolve(repositoryRoot, ...gitPath.split('/')), 'utf8'), label: `Current:${gitPath}` };
  }

  async function compareGitSources({ workspacePath, left, right }: { workspacePath: string; left: GitCompareSide; right: GitCompareSide }) {
    const { repositoryRoot, workspaceRoot } = await resolveContext(workspacePath);
    const [leftResult, rightResult] = await Promise.all([readSide(repositoryRoot, workspaceRoot, left), readSide(repositoryRoot, workspaceRoot, right)]);
    return { leftSource: leftResult.source, rightSource: rightResult.source, leftLabel: leftResult.label, rightLabel: rightResult.label };
  }

  return { detectGitCapability, listDocumentHistory, readGitRevision, compareGitSources };
}

const defaultAdapter = createPanelGitHistoryAdapter();

export async function handlePanelGitHistoryMessage(
  msg: any,
  workspacePath: string | undefined,
  postMessage: (message: Record<string, unknown>) => PromiseLike<unknown> | unknown,
): Promise<boolean> {
  if (!['getGitCapability', 'listDocumentHistory', 'readGitRevision', 'compareGitRevisions'].includes(msg?.command)) return false;
  const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';
  const root = workspacePath || '';
  try {
    if (msg.command === 'getGitCapability') {
      await postMessage({ command: 'gitCapabilityResult', requestId, capability: await defaultAdapter.detectGitCapability(root) });
    } else if (msg.command === 'listDocumentHistory') {
      const revisions = await defaultAdapter.listDocumentHistory({ workspacePath: root, filePath: msg.filePath, limit: msg.limit });
      await postMessage({ command: 'documentHistoryResult', requestId, ok: true, revisions });
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
    else if (msg.command === 'readGitRevision') await postMessage({ command: 'gitRevisionResult', requestId, ok: false, reason });
    else if (msg.command === 'compareGitRevisions') await postMessage({ command: 'gitComparisonResult', requestId, ok: false, reason });
    else await postMessage({ command: 'gitCapabilityResult', requestId, capability: { supported: false, reason: reason === 'git-unavailable' ? 'git-unavailable' : 'not-repository' } });
  }
  return true;
}
