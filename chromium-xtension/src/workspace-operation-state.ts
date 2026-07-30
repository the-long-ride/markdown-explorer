export type WorkspaceOperationMetadata = { workspaceOperationId?: string; workspaceTabId?: string };

export function createWorkspaceOperationState() {
  let operationId: string | null = null;
  let tabId: string | null = null;
  return {
    current(): WorkspaceOperationMetadata {
      return operationId && tabId ? { workspaceOperationId: operationId, workspaceTabId: tabId } : {};
    },
    apply(message: any): void {
      operationId = typeof message?.workspaceOperationId === 'string' ? message.workspaceOperationId : null;
      tabId = typeof message?.workspaceTabId === 'string' ? message.workspaceTabId : null;
    },
    isCurrent(operation: WorkspaceOperationMetadata): boolean {
      return operationId === (operation.workspaceOperationId || null) && tabId === (operation.workspaceTabId || null);
    },
    matches(workspaceOperationId: unknown): boolean {
      return Boolean(operationId && workspaceOperationId === operationId);
    },
    clear(): void { operationId = null; tabId = null; },
  };
}
