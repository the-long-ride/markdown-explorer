import { describe, expect, it, vi } from 'vitest';
import { handleWebFileUtilityMessage } from '../../../website-app/src/web-file-utility-router';

function deps(overrides: Record<string, unknown> = {}) {
  return {
    getSearchIndex: () => null, getSingleFileHandle: () => null, getFlatList: () => [], getActiveWorkspacePath: () => '',
    getWorkspaceTree: () => null, getActiveHandle: () => null, send: vi.fn(), refreshWorkspace: vi.fn(async () => {}),
    ...overrides,
  } as any;
}

describe('website router workspace entries', () => {
  it('answers unsupported in single-file mode', async () => {
    const context = deps();
    const handled = await handleWebFileUtilityMessage(
      { command: 'createWorkspaceEntry', requestId: 'r', parentPath: '', name: 'a.md', kind: 'file' },
      context,
    );
    expect(handled).toBe(true);
    expect(context.send).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'r', ok: false, reason: 'unsupported' });
  });
  it('creates through the active handle and refreshes before replying', async () => {
    const calls: string[] = [];
    const created: string[] = [];
    const root = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        if (!options?.create) throw new DOMException('missing', 'NotFoundError');
        created.push(name);
        return {};
      },
      getDirectoryHandle: async () => { throw new DOMException('missing', 'NotFoundError'); },
    };
    const context = deps({
      getActiveHandle: () => root,
      send: (message: any) => calls.push(message.command),
      refreshWorkspace: async () => { calls.push('refresh'); },
    });
    await handleWebFileUtilityMessage({ command: 'createWorkspaceEntry', requestId: 'c', parentPath: '', name: 'a.md', kind: 'file' }, context);
    expect(created).toEqual(['a.md']);
    expect(calls).toEqual(['refresh', 'createWorkspaceEntryResult']);
  });
  it('answers delete in single-file mode with unsupported failures', async () => {
    const context = deps();
    await handleWebFileUtilityMessage({ command: 'deleteWorkspaceEntries', requestId: 'd', paths: ['a.md'] }, context);
    expect(context.send).toHaveBeenCalledWith({
      command: 'deleteWorkspaceEntriesResult', requestId: 'd', mode: 'permanent', deleted: [], failed: [{ path: 'a.md', reason: 'unsupported' }],
    });
    expect(context.refreshWorkspace).not.toHaveBeenCalled();
  });
});
