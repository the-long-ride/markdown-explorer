export interface WorkspaceOperationContext {
  workspaceOperationId: string;
  workspaceTabId: string;
}

let activeOperation: WorkspaceOperationContext | null = null;
let operationSequence = 0;

function createOperationId(): string {
  operationSequence += 1;
  const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${operationSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `workspace-${randomPart}`;
}

export function beginWorkspaceOperation(workspaceTabId: string): WorkspaceOperationContext {
  const operation = {
    workspaceOperationId: createOperationId(),
    workspaceTabId,
  };
  activeOperation = operation;
  return operation;
}

export function setActiveWorkspaceOperation(operation: WorkspaceOperationContext | null): void {
  activeOperation = operation;
}

export function getActiveWorkspaceOperation(): WorkspaceOperationContext | null {
  return activeOperation ? { ...activeOperation } : null;
}

export function clearWorkspaceOperation(workspaceOperationId?: string): void {
  if (!workspaceOperationId || activeOperation?.workspaceOperationId === workspaceOperationId) {
    activeOperation = null;
  }
}

export function acceptsWorkspaceHostMessage(message: unknown): boolean {
  const scopedMessage = (message && typeof message === 'object'
    ? message
    : {}) as { workspaceOperationId?: string; workspaceTabId?: string };
  const messageOperationId = scopedMessage.workspaceOperationId;
  const messageTabId = scopedMessage.workspaceTabId;

  if (!messageOperationId && !messageTabId) {
    return activeOperation === null;
  }
  if (!activeOperation) return false;
  return messageOperationId === activeOperation.workspaceOperationId
    && messageTabId === activeOperation.workspaceTabId;
}

interface WorkspaceCancellationTab {
  id: string;
  kind: 'home' | 'new' | 'workspace';
  workspacePath?: string;
  workspaceLoadState?: 'idle' | 'loading' | 'ready';
}

export function resolveWorkspaceCancellationFallback<T extends WorkspaceCancellationTab>(
  tabs: readonly T[],
  cancelledTabId: string,
): {
  remainingTabs: T[];
  readyWorkspaceTabId: string | null;
  homeTabId: string | null;
} {
  const remainingTabs = tabs.filter((tab) => tab.id !== cancelledTabId);
  const readyWorkspace = [...remainingTabs].reverse().find((tab) =>
    tab.kind === 'workspace'
      && Boolean(tab.workspacePath)
      && tab.workspaceLoadState !== 'loading',
  );
  const homeTab = remainingTabs.find((tab) => tab.kind === 'home');
  return {
    remainingTabs,
    readyWorkspaceTabId: readyWorkspace?.id ?? null,
    homeTabId: homeTab?.id ?? null,
  };
}
