import * as fs from 'fs';
import * as path from 'path';
import { hasProtectedSegment, hasStreamSegment, nameError } from './workspaceEntryName';

type FailureReason = 'exists' | 'invalid-name' | 'outside-workspace' | 'protected' | 'missing' | 'permission-denied' | 'unsupported' | 'failed';

/** The slice of the VS Code API this module needs; the panel passes the real (or test-overridden) module. */
export interface PanelWorkspaceEntryVscodeApi {
  readonly workspace: {
    readonly workspaceFolders?: readonly { readonly uri: { readonly fsPath: string } }[];
    readonly fs: { delete(uri: any, options: { recursive: boolean; useTrash: boolean }): PromiseLike<void> };
  };
  readonly Uri: { file(path: string): any };
}

export interface PanelWorkspaceEntryDeps {
  readonly onRename?: (oldPath: string, newPath: string) => void;
  readonly refresh: () => Promise<void> | void;
  readonly post: (message: unknown) => unknown;
  /** Defaults to the first workspace folder of `vscodeApi`; `null` means no folder workspace. */
  readonly workspacePath?: string | null;
  /** Defaults to workspace.fs.delete with useTrash via `vscodeApi`. */
  readonly permanentEntry?: (absolutePath: string) => Promise<void>;
  readonly trashEntry?: (absolutePath: string) => Promise<void>;
  readonly vscodeApi?: PanelWorkspaceEntryVscodeApi;
  readonly fsApi?: typeof fs;
}

function workspacePathOf(deps: PanelWorkspaceEntryDeps): string | null {
  if (deps.workspacePath !== undefined) return deps.workspacePath;
  return deps.vscodeApi?.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

async function trashWithVscode(deps: PanelWorkspaceEntryDeps, absolutePath: string, permanent = false): Promise<void> {
  const api = deps.vscodeApi;
  if (!api) throw Object.assign(new Error('VS Code API unavailable'), { code: 'UNSUPPORTED' });
  await api.workspace.fs.delete(api.Uri.file(absolutePath), { recursive: true, useTrash: !permanent });
}

function splitRelative(value: unknown): string[] | null {
  const text = String(value ?? '');
  if (text === '') return [];
  const parts = text.split('/');
  return parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\\')) ? null : parts;
}

/** Segments of a resolved path below the resolved workspace base (callers check containment first). */
function relativeSegments(base: string, target: string): string[] {
  return path.relative(base, target).split(path.sep).filter(Boolean);
}

function errorReason(error: unknown): FailureReason {
  const code = (error as { code?: string; name?: string } | null)?.code ?? (error as { name?: string } | null)?.name;
  if (code === 'EEXIST' || code === 'FileExists') return 'exists';
  if (code === 'EACCES' || code === 'EPERM' || code === 'NoPermissions') return 'permission-denied';
  if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'FileNotFound') return 'missing';
  if (code === 'UNSUPPORTED') return 'unsupported';
  return 'failed';
}

function isWithin(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative));
}

async function resolveBase(workspacePath: string | null, fsApi: typeof fs): Promise<{ base?: string; reason?: FailureReason }> {
  if (!workspacePath) return { reason: 'unsupported' };
  try {
    if (!(await fsApi.promises.stat(workspacePath)).isDirectory()) return { reason: 'unsupported' };
    return { base: await fsApi.promises.realpath(workspacePath) };
  } catch (error) {
    return { reason: errorReason(error) };
  }
}

export async function createPanelWorkspaceEntry(msg: Record<string, unknown>, deps: PanelWorkspaceEntryDeps) {
  const fsApi = deps.fsApi ?? fs;
  const fail = (reason: FailureReason, error?: unknown) => ({ ok: false as const, reason, ...(error ? { error: String((error as Error).message ?? error) } : {}) });
  const kind = msg.kind;
  const name = typeof msg.name === 'string' ? msg.name : '';
  if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
  const problem = nameError(name);
  if (problem) return fail(problem === 'protected' ? 'protected' : 'invalid-name');
  const parentParts = splitRelative(msg.parentPath);
  if (!parentParts) return fail('outside-workspace');
  if (hasProtectedSegment(parentParts)) return fail('protected');
  if (hasStreamSegment(parentParts)) return fail('invalid-name');
  const { base, reason } = await resolveBase(workspacePathOf(deps), fsApi);
  if (!base) return fail(reason ?? 'unsupported');
  let parentReal: string;
  try {
    parentReal = await fsApi.promises.realpath(path.join(base, ...parentParts));
  } catch (error) {
    return fail(errorReason(error), error);
  }
  if (!isWithin(base, parentReal)) return fail('outside-workspace');
  // The raw segments can hide .git (8.3 alias GIT~1, symlink/junction): re-check the resolved location.
  if (hasProtectedSegment(relativeSegments(base, parentReal))) return fail('protected');
  const target = path.join(parentReal, name);
  try {
    if (kind === 'folder') await fsApi.promises.mkdir(target);
    else await (await fsApi.promises.open(target, 'wx')).close();
  } catch (error) {
    return fail(errorReason(error), error);
  }
  return { ok: true as const, kind, path: [...parentParts, name].join('/') };
}

async function deleteOne(base: string, entryPath: string, deps: PanelWorkspaceEntryDeps, fsApi: typeof fs, permanent = false): Promise<FailureReason | null> {
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
    const remove = permanent ? deps.permanentEntry : deps.trashEntry;
    await (remove ?? ((absolutePath: string) => trashWithVscode(deps, absolutePath, permanent)))(target);
    return null;
  } catch (error) {
    return errorReason(error);
  }
}

export async function deletePanelWorkspaceEntries(msg: Record<string, unknown>, deps: PanelWorkspaceEntryDeps) {
  const fsApi = deps.fsApi ?? fs;
  const deleted: string[] = [];
  const failed: { path: string; reason: FailureReason }[] = [];
  const { base, reason } = await resolveBase(workspacePathOf(deps), fsApi);
  for (const entryPath of Array.isArray(msg.paths) ? msg.paths.map(String) : []) {
    const problem = base ? await deleteOne(base, entryPath, deps, fsApi, msg.mode === 'permanent') : reason ?? 'unsupported';
    if (problem) failed.push({ path: entryPath, reason: problem });
    else deleted.push(entryPath);
  }
  return { deleted, failed };
}

export async function renamePanelWorkspaceEntry(msg: Record<string, unknown>, deps: PanelWorkspaceEntryDeps) {
  const fsApi = deps.fsApi ?? fs;
  const workspacePath = workspacePathOf(deps);
  const entryPath = msg.path; const name = msg.name; const kind = msg.kind;
  const fail = (reason: FailureReason, error?: unknown) => ({ ok: false as const, reason, ...(error ? { error: String((error as Error).message ?? error) } : {}) });
  if (typeof entryPath !== 'string') return fail('outside-workspace');
  if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
  const parts = splitRelative(entryPath);
  if (!parts) return fail('outside-workspace');
  if (!parts.length || hasProtectedSegment(parts)) return fail('protected');
  if (hasStreamSegment(parts)) return fail('invalid-name');
  if (typeof name !== 'string' || nameError(name)) return fail(nameError(typeof name === 'string' ? name : '') === 'protected' ? 'protected' : 'invalid-name');
  const { base, reason } = await resolveBase(workspacePath, fsApi);
  if (!base) return fail(reason ?? 'unsupported');
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
        if (['ENOTSUP', 'EOPNOTSUPP', 'EPERM', 'EXDEV'].includes(String((error as { code?: string }).code))) await fsApi.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
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

async function refreshQuietly(deps: PanelWorkspaceEntryDeps): Promise<void> {
  try { await deps.refresh(); } catch (error) { console.error('Workspace refresh after entry change failed:', error); }
}

/** Returns true when the message was a workspace-entry command. Refreshes before posting a successful result. */
export async function handlePanelWorkspaceEntryMessage(message: unknown, deps: PanelWorkspaceEntryDeps): Promise<boolean> {
  const msg = (message ?? {}) as Record<string, unknown>;
  if (msg.command === 'createWorkspaceEntry') {
    const result = await createPanelWorkspaceEntry(msg, deps);
    if (result.ok) await refreshQuietly(deps);
    await deps.post({ command: 'createWorkspaceEntryResult', requestId: msg.requestId, ...result });
    return true;
  }
  if (msg.command === 'renameWorkspaceEntry') {
    const origin = workspacePathOf(deps);
    const result = await renamePanelWorkspaceEntry(msg, deps);
    if (result.ok && workspacePathOf(deps) === origin && result.oldPath && result.path) deps.onRename?.(result.oldPath, result.path);
    await deps.post({ command: 'renameWorkspaceEntryResult', requestId: msg.requestId, ...result });
    if (result.ok) await refreshQuietly(deps);
    return true;
  }
  if (msg.command === 'deleteWorkspaceEntries') {
    const result = await deletePanelWorkspaceEntries(msg, deps);
    if (result.deleted.length > 0) await refreshQuietly(deps);
    await deps.post({ command: 'deleteWorkspaceEntriesResult', requestId: msg.requestId, mode: msg.mode === 'permanent' ? 'permanent' : 'trash', ...result });
    return true;
  }
  return false;
}
