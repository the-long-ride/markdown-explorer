import type { WorkspaceEntryFailureReason } from '../../ui/src/types';
import { isProtectedSegment, validateWorkspaceEntryName } from '../../ui/src/workspace/workspaceEntryName';
import { verifyPermission } from './file-access';

type CreateResult =
  | { ok: true; kind: 'file' | 'folder'; path: string }
  | { ok: false; reason: WorkspaceEntryFailureReason; error?: string };
type DeleteResult = { deleted: string[]; failed: { path: string; reason: WorkspaceEntryFailureReason }[] };

interface BrowserWorkspaceEntryContext {
  readonly activeHandle: FileSystemDirectoryHandle | null;
  readonly send: (message: unknown) => void;
  readonly onRename?: (oldPath: string, newPath: string, origin: FileSystemDirectoryHandle | null) => void;
  readonly refreshWorkspace: () => Promise<void>;
}

function splitRelative(value: unknown): string[] | null {
  const text = String(value ?? '');
  if (text === '') return [];
  const parts = text.split('/');
  return parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\\')) ? null : parts;
}

function domReason(error: unknown): WorkspaceEntryFailureReason {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotFoundError' || name === 'TypeMismatchError') return 'missing';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission-denied';
  return 'failed';
}

/** A revoked or detached handle can make the permission query itself throw; treat that as denied. */
async function canWrite(root: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return await verifyPermission(root, true);
  } catch {
    return false;
  }
}

/** Walks directory handles one segment at a time, so no `..` or absolute path can ever be resolved. */
async function resolveDirectory(root: FileSystemDirectoryHandle, parts: readonly string[]): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  return dir;
}

/** The File System Access API has no exclusive create, so probe both kinds before creating. */
async function hasEntry(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  for (const probe of [() => dir.getFileHandle(name), () => dir.getDirectoryHandle(name)]) {
    try {
      await probe();
      return true;
    } catch (error) {
      if (domReason(error) !== 'missing') throw error;
    }
  }
  return false;
}

export async function createBrowserWorkspaceEntry(
  root: FileSystemDirectoryHandle | null,
  input: { parentPath?: unknown; name?: unknown; kind?: unknown },
): Promise<CreateResult> {
  const fail = (reason: WorkspaceEntryFailureReason, error?: unknown): CreateResult =>
    (error ? { ok: false, reason, error: String((error as Error).message ?? error) } : { ok: false, reason });
  if (!root) return fail('unsupported');
  const kind = input.kind;
  if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
  if (typeof input.name !== 'string') return fail('invalid-name');
  const name = input.name;
  const problem = validateWorkspaceEntryName(name);
  if (problem) return fail(problem === 'protected' ? 'protected' : 'invalid-name');
  const parts = splitRelative(input.parentPath);
  if (!parts) return fail('outside-workspace');
  if (parts.some(isProtectedSegment)) return fail('protected');
  if (!(await canWrite(root))) return fail('permission-denied');
  try {
    const parent = await resolveDirectory(root, parts);
    if (await hasEntry(parent, name)) return fail('exists');
    if (kind === 'folder') await parent.getDirectoryHandle(name, { create: true });
    else await parent.getFileHandle(name, { create: true });
    return { ok: true, kind, path: [...parts, name].join('/') };
  } catch (error) {
    return fail(domReason(error), error);
  }
}

async function deleteOne(root: FileSystemDirectoryHandle, parts: readonly string[]): Promise<WorkspaceEntryFailureReason | null> {
  try {
    const parent = await resolveDirectory(root, parts.slice(0, -1));
    const name = parts[parts.length - 1];
    if (!(await hasEntry(parent, name))) return 'missing';
    await parent.removeEntry(name, { recursive: true });
    return null;
  } catch (error) {
    return domReason(error);
  }
}

/** Permanent: the browser API has no trash, so every removal is final. */
export async function deleteBrowserWorkspaceEntries(root: FileSystemDirectoryHandle | null, paths: unknown): Promise<DeleteResult> {
  const result: DeleteResult = { deleted: [], failed: [] };
  const list = Array.isArray(paths) ? paths.map(String) : [];
  let permitted: boolean | null = null;
  for (const entryPath of list) {
    const parts = splitRelative(entryPath);
    let reason: WorkspaceEntryFailureReason | null = null;
    if (!root) reason = 'unsupported';
    else if (!parts) reason = 'outside-workspace';
    else if (parts.length === 0 || parts.some(isProtectedSegment)) reason = 'protected';
    else {
      permitted ??= await canWrite(root);
      reason = permitted ? await deleteOne(root, parts) : 'permission-denied';
    }
    if (reason) result.failed.push({ path: entryPath, reason });
    else result.deleted.push(entryPath);
  }
  return result;
}


async function copyEntry(source: FileSystemHandle, parent: FileSystemDirectoryHandle, name: string): Promise<void> {
  if (source.kind === 'file') {
    const target = await parent.getFileHandle(name, { create: true });
    const writer = await target.createWritable();
    try { await writer.write(await (source as FileSystemFileHandle).getFile()); await writer.close(); }
    catch (error) { await writer.abort().catch(() => {}); throw error; }
  } else {
    const target = await parent.getDirectoryHandle(name, { create: true });
    for await (const [childName, child] of (source as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)) {
      await copyEntry(child, target, childName);
    }
  }
}

export async function renameBrowserWorkspaceEntry(root: FileSystemDirectoryHandle | null, input: { path?: unknown; name?: unknown; kind?: unknown }) {
  const fail = (reason: WorkspaceEntryFailureReason, error?: string) => ({ ok: false as const, reason, error });
  if (!root) return fail('unsupported');
  const parts = splitRelative(input.path);
  if (!parts) return fail('outside-workspace');
  if (!parts.length || parts.some(isProtectedSegment)) return fail('protected');
  if (typeof input.name !== 'string' || validateWorkspaceEntryName(input.name)) return fail('invalid-name');
  const name = input.name;
  const kind = input.kind;
  if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
  if (!(await canWrite(root))) return fail('permission-denied');
  try {
    const parent = await resolveDirectory(root, parts.slice(0, -1));
    const oldName = parts[parts.length - 1];
    const source = kind === 'file' ? await parent.getFileHandle(oldName) : await parent.getDirectoryHandle(oldName);
    const oldPath = parts.join('/'); const nextPath = [...parts.slice(0, -1), name].join('/');
    if (oldName === name) return { ok: true as const, oldPath, path: nextPath, kind };
    const move = (source as FileSystemHandle & { move?: (parent: FileSystemDirectoryHandle, name: string) => Promise<void> }).move;
    if (await hasEntry(parent, name)) {
      const target = kind === 'file' ? await parent.getFileHandle(name) : await parent.getDirectoryHandle(name);
      if (!move || oldName.toLowerCase() !== name.toLowerCase() || !await source.isSameEntry(target)) return fail('exists');
    }
    if (move) await move.call(source, parent, name);
    else {
      // FSA lacks rename on picked handles. Copy completely before removing the source;
      // failed copies are rolled back while the source remains intact.
      try { await copyEntry(source, parent, name); }
      catch (error) { await parent.removeEntry(name, { recursive: true }).catch(() => {}); throw error; }
      try { await parent.removeEntry(oldName, { recursive: true }); }
      catch (error) { return fail(domReason(error), 'Could not remove the original entry. The complete copy remains at ' + nextPath + '.'); }
    }
    return { ok: true as const, oldPath, path: nextPath, kind };
  } catch (error) { return fail(domReason(error)); }
}

async function refreshQuietly(context: BrowserWorkspaceEntryContext): Promise<void> {
  try {
    await context.refreshWorkspace();
  } catch (error) {
    console.error('Workspace refresh after entry change failed:', error);
  }
}

/** Shared by the Chromium extension and the website app. Refreshes before a successful reply. */
export async function handleBrowserWorkspaceEntryCommand(message: any, context: BrowserWorkspaceEntryContext): Promise<boolean> {
  if (message?.command === 'createWorkspaceEntry') {
    const result = await createBrowserWorkspaceEntry(context.activeHandle, message);
    if (result.ok) await refreshQuietly(context);
    context.send({ command: 'createWorkspaceEntryResult', requestId: message.requestId, ...result });
    return true;
  }
  if (message?.command === 'renameWorkspaceEntry') {
    const result = await renameBrowserWorkspaceEntry(context.activeHandle, message);
    if (result.ok) context.onRename?.(result.oldPath, result.path, context.activeHandle);
    context.send({ command: 'renameWorkspaceEntryResult', requestId: message.requestId, ...result });
    if (result.ok || result.error) await refreshQuietly(context);
    return true;
  }
  if (message?.command === 'deleteWorkspaceEntries') {
    const result = await deleteBrowserWorkspaceEntries(context.activeHandle, message.paths);
    if (result.deleted.length > 0) await refreshQuietly(context);
    context.send({ command: 'deleteWorkspaceEntriesResult', requestId: message.requestId, mode: 'permanent', ...result });
    return true;
  }
  return false;
}
