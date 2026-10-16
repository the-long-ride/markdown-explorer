import type { PlatformBridge } from '../platform/bridge';
import type {
  CreateWorkspaceEntryResultMessage,
  RenameWorkspaceEntryResultMessage,
  DeleteWorkspaceEntriesResultMessage,
  HostMessage,
  WorkspaceEntryDeleteMode,
  WorkspaceEntryKind,
} from '../types';

/** Trash moves and network drives can be slow; the host still refreshes before replying. */
export const WORKSPACE_ENTRY_TIMEOUT_MS = 15_000;

type EntryBridge = Pick<PlatformBridge, 'postMessage' | 'onMessage'>;

interface RequestOptions {
  readonly timeoutMs?: number;
  readonly requestId?: string;
}

function newRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function awaitHostReply<T extends HostMessage>(
  bridge: EntryBridge,
  matches: (message: HostMessage) => message is T,
  timeoutMs: number,
  onTimeout: () => T,
  send: () => void,
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const finish = (result: T) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => { if (matches(message)) finish(message); });
    timer = globalThis.setTimeout(() => finish(onTimeout()), timeoutMs);
    try {
      send();
    } catch {
      // A synchronous send failure must not leave the listener and timer behind or reject the promise.
      finish(onTimeout());
    }
  });
}

export function requestCreateWorkspaceEntry(
  bridge: EntryBridge,
  input: { readonly parentPath: string; readonly name: string; readonly kind: WorkspaceEntryKind },
  options: RequestOptions = {},
): Promise<CreateWorkspaceEntryResultMessage> {
  const requestId = options.requestId ?? newRequestId('create-entry');
  return awaitHostReply<CreateWorkspaceEntryResultMessage>(
    bridge,
    (message): message is CreateWorkspaceEntryResultMessage =>
      message.command === 'createWorkspaceEntryResult' && message.requestId === requestId,
    options.timeoutMs ?? WORKSPACE_ENTRY_TIMEOUT_MS,
    () => ({ command: 'createWorkspaceEntryResult', requestId, ok: false, reason: 'failed', error: 'Timed out waiting for the host.' }),
    () => bridge.postMessage({ command: 'createWorkspaceEntry', requestId, ...input }),
  );
}

export function requestDeleteWorkspaceEntries(
  bridge: EntryBridge,
  paths: readonly string[],
  mode: WorkspaceEntryDeleteMode,
  options: RequestOptions = {},
): Promise<DeleteWorkspaceEntriesResultMessage> {
  const requestId = options.requestId ?? newRequestId('delete-entries');
  return awaitHostReply<DeleteWorkspaceEntriesResultMessage>(
    bridge,
    (message): message is DeleteWorkspaceEntriesResultMessage =>
      message.command === 'deleteWorkspaceEntriesResult' && message.requestId === requestId,
    options.timeoutMs ?? WORKSPACE_ENTRY_TIMEOUT_MS,
    () => ({
      command: 'deleteWorkspaceEntriesResult', requestId, mode, deleted: [],
      failed: paths.map((path) => ({ path, reason: 'failed' as const })),
    }),
    () => bridge.postMessage({ command: 'deleteWorkspaceEntries', requestId, mode, paths: [...paths] }),
  );
}

export function requestRenameWorkspaceEntry(
  bridge: EntryBridge,
  input: { path: string; name: string; kind: WorkspaceEntryKind },
  options: RequestOptions & { onLateResult?: (result: RenameWorkspaceEntryResultMessage) => void } = {},
): Promise<RenameWorkspaceEntryResultMessage> {
  const requestId = options.requestId ?? newRequestId('rename-entry');
  return new Promise(resolve => {
    let timedOut = false;
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let unsubscribe = () => {};
    const finish = (result: RenameWorkspaceEntryResultMessage) => {
      if (settled) return;
      settled = true; globalThis.clearTimeout(timer); unsubscribe();
      if (timedOut) options.onLateResult?.(result); else resolve(result);
    };
    unsubscribe = bridge.onMessage(message => {
      if (message.command === 'renameWorkspaceEntryResult' && message.requestId === requestId) finish(message);
    });
    timer = globalThis.setTimeout(() => {
      timedOut = Boolean(options.onLateResult);
      const result: RenameWorkspaceEntryResultMessage = { command: 'renameWorkspaceEntryResult', requestId, ok: false, reason: 'failed', pending: timedOut };
      if (timedOut) resolve(result); else finish(result);
    }, options.timeoutMs ?? WORKSPACE_ENTRY_TIMEOUT_MS);
    try { bridge.postMessage({ command: 'renameWorkspaceEntry', requestId, ...input }); }
    catch { finish({ command: 'renameWorkspaceEntryResult', requestId, ok: false, reason: 'failed' }); }
  });
}
