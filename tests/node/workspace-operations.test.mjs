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

test('cancelled scan resets the same tab to a new idle workspace selection tab', async () => {
  const { resetCancelledWorkspaceTab } = await import('../../ui/src/desktop/workspaceOperations.ts');
  const tabs = [
    { id: 'home', kind: 'home', workspaceLoadState: 'idle' },
    { id: 'a', kind: 'workspace', workspacePath: '/a', workspaceLoadState: 'loading', contentHtml: '<h1>A</h1>' },
    { id: 'b', kind: 'workspace', workspacePath: '/b', workspaceLoadState: 'ready' },
  ];

  const result = resetCancelledWorkspaceTab(
    tabs,
    'a',
    (id) => ({ id, kind: 'new', workspaceLoadState: 'idle' }),
  );

  assert.deepEqual(result.map((tab) => tab.id), ['home', 'a', 'b']);
  assert.deepEqual(result[1], { id: 'a', kind: 'new', workspaceLoadState: 'idle' });
  assert.equal(result[2], tabs[2]);
});

test('cancelled scan reset leaves other tabs untouched when the target is missing', async () => {
  const { resetCancelledWorkspaceTab } = await import('../../ui/src/desktop/workspaceOperations.ts');
  const tabs = [{ id: 'home', kind: 'home', workspaceLoadState: 'idle' }];
  const result = resetCancelledWorkspaceTab(tabs, 'missing', (id) => ({ id, kind: 'new' }));
  assert.deepEqual(result, tabs);
});
