import { DemoEntryError } from './demo-entry-store';
import { demoEntryStore, refreshVirtualWorkspace } from './virtual-workspace';
import type { WorkspaceEntryFailureReason } from '../../ui/src/types';

interface DemoEntryDeps {
  send: (message: unknown) => void;
  refreshTestWorkspace: () => Promise<void>;
  getCurrentFile: () => string | null;
  setCurrentFile: (path: string | null) => void;
}
const failure = (error: unknown): WorkspaceEntryFailureReason => error instanceof DemoEntryError ? error.reason : 'failed';
const within = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`);

export async function handleWebDemoEntryMessage(msg: any, deps: DemoEntryDeps): Promise<boolean> {
  if (!['createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries'].includes(msg.command)) return false;
  let result: Record<string, unknown>;
  let changed = false;
  if (msg.command === 'deleteWorkspaceEntries') {
    const deleted: string[] = [];
    const failed: { path: string; reason: WorkspaceEntryFailureReason }[] = [];
    for (const path of Array.isArray(msg.paths) ? msg.paths : []) {
      try {
        deleted.push(demoEntryStore.delete(path));
        const current = deps.getCurrentFile();
        if (current && within(current, path)) deps.setCurrentFile(null);
      } catch (error) { failed.push({ path: String(path), reason: failure(error) }); }
    }
    changed = deleted.length > 0;
    result = { mode: 'permanent', deleted, failed };
  } else {
    try {
      const path = msg.command === 'createWorkspaceEntry'
        ? demoEntryStore.create(msg.parentPath, msg.name, msg.kind)
        : demoEntryStore.rename(msg.path, msg.name, msg.kind);
      result = { ok: true, path, kind: msg.kind, ...(msg.command === 'renameWorkspaceEntry' ? { oldPath: msg.path } : {}) };
      if (msg.command === 'renameWorkspaceEntry') {
        const current = deps.getCurrentFile();
        if (current && within(current, msg.path)) deps.setCurrentFile(path + current.slice(msg.path.length));
      }
      changed = true;
    } catch (error) { result = { ok: false, reason: failure(error) }; }
  }
  if (changed) {
    refreshVirtualWorkspace();
    await deps.refreshTestWorkspace();
  }
  deps.send({ command: `${msg.command}Result`, requestId: msg.requestId, ...result });
  return true;
}
