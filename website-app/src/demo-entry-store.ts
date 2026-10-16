import { isProtectedSegment, validateWorkspaceEntryName } from '../../ui/src/workspace/workspaceEntryName';
import type { WorkspaceEntryFailureReason, WorkspaceEntryKind } from '../../ui/src/types';

export const DEMO_WORKSPACE_STORAGE_KEY = 'markdown-explorer.demo-workspace.v1';
export interface DemoEntry {
  path: string;
  kind: WorkspaceEntryKind;
  /** Bundled content identity survives renames without copying Markdown into storage. */
  source?: string;
}

export class DemoEntryError extends Error {
  constructor(readonly reason: WorkspaceEntryFailureReason) { super(reason); }
}
function fail(reason: WorkspaceEntryFailureReason): never { throw new DemoEntryError(reason); }
function pathParts(path: unknown, allowRoot = false): string[] {
  if (typeof path !== 'string') return fail('outside-workspace');
  if (path === '' && allowRoot) return [];
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) return fail('outside-workspace');
  if (parts.some(isProtectedSegment)) return fail('protected');
  if (parts.some(p => validateWorkspaceEntryName(p))) return fail('invalid-name');
  return parts;
}
function validName(name: unknown): string {
  if (typeof name !== 'string') return fail('invalid-name');
  const problem = validateWorkspaceEntryName(name);
  if (problem) return fail(problem === 'protected' ? 'protected' : 'invalid-name');
  return name;
}
const within = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`);

/** A simulated workspace. Every mutation persists before publishing its new in-memory state. */
export class DemoEntryStore {
  entries: readonly DemoEntry[];
  constructor(seeds: readonly DemoEntry[], private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.entries = seeds.map(e => ({ ...e }));
    try {
      const raw = storage.getItem(DEMO_WORKSPACE_STORAGE_KEY);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      const sources = new Set(seeds.map(e => e.source));
      const entries: DemoEntry[] = saved.map(e => {
        pathParts(e?.path);
        if (e.kind !== 'file' && e.kind !== 'folder') return fail('invalid-name');
        if (e.source !== undefined && (e.kind !== 'file' || !sources.has(e.source))) return fail('invalid-name');
        return { path: e.path, kind: e.kind, ...(e.source === undefined ? {} : { source: e.source }) };
      });
      if (new Set(entries.map(e => e.path)).size !== entries.length) return;
      for (const entry of entries) this.parent(entry.path, entries);
      this.entries = entries;
    } catch { /* Invalid/unavailable storage starts with the bundled demo. */ }
  }

  private parent(path: string, entries = this.entries): void {
    const parent = path.split('/').slice(0, -1).join('/');
    if (parent && !entries.some(e => e.path === parent && e.kind === 'folder')) fail('missing');
  }
  private commit(entries: DemoEntry[]): void {
    try { this.storage.setItem(DEMO_WORKSPACE_STORAGE_KEY, JSON.stringify(entries)); }
    catch { return fail('failed'); }
    this.entries = entries;
  }
  create(parentPath: unknown, name: unknown, kind: unknown): string {
    const parent = pathParts(parentPath, true).join('/');
    const leaf = validName(name);
    if (kind !== 'file' && kind !== 'folder') return fail('invalid-name');
    const path = parent ? `${parent}/${leaf}` : leaf;
    this.parent(path);
    if (this.entries.some(e => e.path === path)) return fail('exists');
    this.commit([...this.entries, { path, kind }]);
    return path;
  }
  rename(path: unknown, name: unknown, kind: unknown): string {
    const oldPath = pathParts(path).join('/');
    const leaf = validName(name);
    if (!this.entries.some(e => e.path === oldPath && e.kind === kind)) return fail('missing');
    const parts = oldPath.split('/');
    parts[parts.length - 1] = leaf;
    const newPath = parts.join('/');
    if (oldPath === newPath) return newPath;
    if (this.entries.some(e => e.path === newPath)) return fail('exists');
    this.commit(this.entries.map(e => within(e.path, oldPath) ? { ...e, path: newPath + e.path.slice(oldPath.length) } : { ...e }));
    return newPath;
  }
  delete(path: unknown): string {
    const target = pathParts(path).join('/');
    if (!this.entries.some(e => e.path === target)) return fail('missing');
    this.commit(this.entries.filter(e => !within(e.path, target)));
    return target;
  }
}
