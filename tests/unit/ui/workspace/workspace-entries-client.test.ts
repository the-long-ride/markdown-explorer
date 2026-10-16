import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostMessage } from '../../../../ui/src/types';
import { requestCreateWorkspaceEntry, requestDeleteWorkspaceEntries, requestRenameWorkspaceEntry } from '../../../../ui/src/workspace/workspaceEntriesClient';

function fakeBridge() {
  const listeners = new Set<(message: HostMessage) => void>();
  const posted: any[] = [];
  return {
    posted,
    postMessage: (message: any) => { posted.push(message); },
    onMessage: (listener: (message: HostMessage) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    emit: (message: any) => { for (const listener of [...listeners]) listener(message); },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => vi.useRealTimers());

describe('requestCreateWorkspaceEntry', () => {
  it('posts the request and resolves with the matching result', async () => {
    const bridge = fakeBridge();
    const pending = requestCreateWorkspaceEntry(bridge as any, { parentPath: 'docs', name: 'a.md', kind: 'file' }, { requestId: 'r1' });
    expect(bridge.posted[0]).toEqual({ command: 'createWorkspaceEntry', requestId: 'r1', parentPath: 'docs', name: 'a.md', kind: 'file' });
    bridge.emit({ command: 'createWorkspaceEntryResult', requestId: 'other', ok: false, reason: 'failed' });
    bridge.emit({ command: 'createWorkspaceEntryResult', requestId: 'r1', ok: true, path: 'docs/a.md', kind: 'file' });
    await expect(pending).resolves.toMatchObject({ ok: true, path: 'docs/a.md' });
    expect(bridge.listenerCount()).toBe(0);
  });
  it('times out with reason failed', async () => {
    vi.useFakeTimers();
    const bridge = fakeBridge();
    const pending = requestCreateWorkspaceEntry(bridge as any, { parentPath: '', name: 'a.md', kind: 'file' }, { timeoutMs: 50 });
    vi.advanceTimersByTime(50);
    await expect(pending).resolves.toMatchObject({ ok: false, reason: 'failed' });
    expect(bridge.listenerCount()).toBe(0);
  });
  it('resolves with reason failed and cleans up when postMessage throws', async () => {
    vi.useFakeTimers();
    const bridge = { ...fakeBridge(), postMessage: () => { throw new Error('bridge down'); } };
    const pending = requestCreateWorkspaceEntry(bridge as any, { parentPath: '', name: 'a.md', kind: 'file' }, { requestId: 'r2' });
    await expect(pending).resolves.toMatchObject({ command: 'createWorkspaceEntryResult', requestId: 'r2', ok: false, reason: 'failed' });
    expect(bridge.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('requestDeleteWorkspaceEntries', () => {
  it('resolves with the matching result', async () => {
    const bridge = fakeBridge();
    const pending = requestDeleteWorkspaceEntries(bridge as any, ['a.md'], 'trash', { requestId: 'd1' });
    expect(bridge.posted[0]).toEqual({ command: 'deleteWorkspaceEntries', requestId: 'd1', paths: ['a.md'], mode: 'trash' });
    bridge.emit({ command: 'deleteWorkspaceEntriesResult', requestId: 'd1', mode: 'trash', deleted: ['a.md'], failed: [] });
    await expect(pending).resolves.toMatchObject({ deleted: ['a.md'] });
  });
  it('reports every path as failed on timeout', async () => {
    vi.useFakeTimers();
    const bridge = fakeBridge();
    const pending = requestDeleteWorkspaceEntries(bridge as any, ['a.md', 'b'], 'permanent', { timeoutMs: 10 });
    vi.advanceTimersByTime(10);
    await expect(pending).resolves.toEqual(expect.objectContaining({
      mode: 'permanent', deleted: [],
      failed: [{ path: 'a.md', reason: 'failed' }, { path: 'b', reason: 'failed' }],
    }));
  });
  it('reports every path as failed and cleans up when postMessage throws', async () => {
    vi.useFakeTimers();
    const bridge = { ...fakeBridge(), postMessage: () => { throw new Error('bridge down'); } };
    const pending = requestDeleteWorkspaceEntries(bridge as any, ['a.md', 'b'], 'trash', { requestId: 'd2' });
    await expect(pending).resolves.toEqual({
      command: 'deleteWorkspaceEntriesResult', requestId: 'd2', mode: 'trash', deleted: [],
      failed: [{ path: 'a.md', reason: 'failed' }, { path: 'b', reason: 'failed' }],
    });
    expect(bridge.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('reconciles a late successful rename after the initial timeout',async()=>{
  vi.useFakeTimers();const bridge=fakeBridge();const late=vi.fn();
  const pending=requestRenameWorkspaceEntry(bridge as any,{path:'a.md',name:'b.md',kind:'file'},{requestId:'late',timeoutMs:10,onLateResult:late} as any);
  await vi.advanceTimersByTimeAsync(11);expect(await pending).toMatchObject({ok:false,pending:true});expect(bridge.listenerCount()).toBe(1);
  bridge.emit({command:'renameWorkspaceEntryResult',requestId:'late',ok:true,oldPath:'a.md',path:'b.md',kind:'file'});
  expect(late).toHaveBeenCalledWith(expect.objectContaining({ok:true,path:'b.md'}));expect(bridge.listenerCount()).toBe(0);
});
