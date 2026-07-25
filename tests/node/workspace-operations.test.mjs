import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginWorkspaceOperation,
  clearWorkspaceOperation,
  getActiveWorkspaceOperation,
  acceptsWorkspaceHostMessage,
} from '../../ui/src/desktop/workspaceOperations.ts';

test('accepts only host messages for the active workspace operation', () => {
  clearWorkspaceOperation();
  const current = beginWorkspaceOperation('tab-b');
  assert.equal(acceptsWorkspaceHostMessage({ command: 'readyAck', ...current }), true);
  assert.equal(acceptsWorkspaceHostMessage({ command: 'readyAck', workspaceOperationId: 'old', workspaceTabId: 'tab-a' }), false);
});

test('legacy host messages remain accepted when no managed tab operation is active', () => {
  clearWorkspaceOperation();
  assert.equal(acceptsWorkspaceHostMessage({ command: 'readyAck' }), true);
});

test('clearing a matching operation rejects its late messages', () => {
  clearWorkspaceOperation();
  const operation = beginWorkspaceOperation('tab-a');
  assert.deepEqual(getActiveWorkspaceOperation(), operation);
  clearWorkspaceOperation(operation.workspaceOperationId);
  assert.equal(getActiveWorkspaceOperation(), null);
  assert.equal(acceptsWorkspaceHostMessage({ command: 'workspaceScanProgress', ...operation }), false);
});

test('cancelled scan falls back to the rightmost ready workspace', async () => {
  const { resolveWorkspaceCancellationFallback } = await import('../../ui/src/desktop/workspaceOperations.ts');
  const tabs = [
    { id: 'home', kind: 'home', workspaceLoadState: 'idle' },
    { id: 'a', kind: 'workspace', workspacePath: '/a', workspaceLoadState: 'loading' },
    { id: 'b', kind: 'workspace', workspacePath: '/b', workspaceLoadState: 'ready' },
    { id: 'c', kind: 'workspace', workspacePath: '/c', workspaceLoadState: 'ready' },
  ];

  const result = resolveWorkspaceCancellationFallback(tabs, 'a');
  assert.deepEqual(result.remainingTabs.map((tab) => tab.id), ['home', 'b', 'c']);
  assert.equal(result.readyWorkspaceTabId, 'c');
  assert.equal(result.homeTabId, 'home');
});

test('cancelled scan falls back to Home when no completed workspace remains', async () => {
  const { resolveWorkspaceCancellationFallback } = await import('../../ui/src/desktop/workspaceOperations.ts');
  const tabs = [
    { id: 'a', kind: 'workspace', workspacePath: '/a', workspaceLoadState: 'loading' },
    { id: 'b', kind: 'workspace', workspacePath: '/b', workspaceLoadState: 'loading' },
  ];

  const result = resolveWorkspaceCancellationFallback(tabs, 'a');
  assert.deepEqual(result.remainingTabs.map((tab) => tab.id), ['b']);
  assert.equal(result.readyWorkspaceTabId, null);
  assert.equal(result.homeTabId, null);
});
