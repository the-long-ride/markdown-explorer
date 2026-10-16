import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URL } from 'node:url';

async function harness() {
  const workspace = await import('../../../website-app/src/virtual-workspace');
  const { handleWebTestMessage } = await import('../../../website-app/src/web-test-message-router');
  const { createTestModeHandlers } = await import('../../../website-app/src/web-test-host');
  const sent: any[] = [];
  const state: any = { flatList: [], workspaceTree: null, currentFile: null };
  const send = (message: unknown) => { sent.push(message); };
  const handlers = createTestModeHandlers({ state, send, hostInfo: () => ({ appRuntime: 'chrome' }),
    findFileInfo: (files, path) => files.find(f => f.relativePath === path)! });
  const deps = { getReadyHandled: () => false, setReadyHandled: vi.fn(),
    setCurrentFile: (path: string | null) => { state.currentFile = path; },
    getCurrentFile: () => state.currentFile, getFlatList: () => state.flatList, send, ...handlers };
  await handlers.sendTestReady();
  const post = async (command: string, input = {}) => {
    sent.length = 0;
    await handleWebTestMessage({ command, requestId: 'request', ...input }, deps);
    return sent.find(m => m.command === `${command}Result`);
  };
  return { workspace, post, sent, state };
}

beforeEach(() => { vi.stubGlobal('URL', URL); localStorage.clear(); vi.resetModules(); });

describe('localStorage demo workspace', () => {
  it('creates nested files and empty folders and restores them after reload', async () => {
    const h = await harness();
    expect(await h.post('createWorkspaceEntry', { kind: 'folder', parentPath: '', name: 'notes' })).toMatchObject({ ok: true });
    expect(await h.post('createWorkspaceEntry', { kind: 'file', parentPath: 'notes', name: 'new.md' })).toMatchObject({ ok: true, path: 'notes/new.md' });
    await h.post('createWorkspaceEntry', { kind: 'folder', parentPath: 'notes', name: 'empty' });
    expect(h.sent[0].command).toBe('workspaceFilesChanged');
    vi.resetModules();
    const reloaded = await harness();
    expect(reloaded.workspace.getVirtualContent('notes/new.md')).toBe('');
    expect(reloaded.state.workspaceTree.children.find((f: any) => f.path === 'notes').children[0].path).toBe('notes/empty');
  });

  it('renames sample files without losing content and deletes them persistently', async () => {
    const h = await harness();
    const path = h.state.flatList[0].fsPath;
    const content = h.workspace.getVirtualContent(path);
    expect(await h.post('renameWorkspaceEntry', { path, name: 'renamed.md', kind: 'file' })).toMatchObject({ ok: true, oldPath: path, path: 'renamed.md' });
    expect(h.workspace.getVirtualContent('renamed.md')).toBe(content);
    expect(h.state.currentFile).toBe('renamed.md');
    vi.resetModules();
    const restored = await harness();
    expect(restored.workspace.getVirtualContent(path)).toBeNull();
    expect(restored.workspace.getVirtualContent('renamed.md')).toBe(content);
    expect(await restored.post('deleteWorkspaceEntries', { paths: ['renamed.md'] })).toMatchObject({ mode: 'permanent', deleted: ['renamed.md'] });
    vi.resetModules();
    expect((await harness()).workspace.getVirtualContent('renamed.md')).toBeNull();
  });

  it('renames and recursively deletes folders, keeping similarly prefixed siblings', async () => {
    const h = await harness();
    for (const name of ['docs', 'docs-other']) await h.post('createWorkspaceEntry', { parentPath: '', name, kind: 'folder' });
    await h.post('createWorkspaceEntry', { parentPath: 'docs', name: 'a.md', kind: 'file' });
    expect(await h.post('renameWorkspaceEntry', { path: 'docs', name: 'guide', kind: 'folder' })).toMatchObject({ ok: true });
    expect(h.workspace.getVirtualContent('guide/a.md')).toBe('');
    await h.post('deleteWorkspaceEntries', { paths: ['guide'] });
    expect(h.workspace.getVirtualContent('guide/a.md')).toBeNull();
    expect(h.state.workspaceTree.children.map((f: any) => f.path)).toContain('docs-other');
  });

  it('rejects traversal, collisions, missing parents, and kind mismatches', async () => {
    const h = await harness();
    const create = (parentPath: string, name: string, kind = 'folder') => h.post('createWorkspaceEntry', { parentPath, name, kind });
    expect(await create('../', 'escape')).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await create('', '.git')).toMatchObject({ ok: false, reason: 'protected' });
    expect(await create('missing', 'a.md', 'file')).toMatchObject({ ok: false, reason: 'missing' });
    await create('', 'docs');
    expect(await create('', 'docs')).toMatchObject({ ok: false, reason: 'exists' });
    expect(await h.post('renameWorkspaceEntry', { path: 'docs', kind: 'file', name: 'x.md' })).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('does not report success or mutate when localStorage cannot persist', async () => {
    const h = await harness();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(await h.post('createWorkspaceEntry', { parentPath: '', name: 'lost.md', kind: 'file' })).toMatchObject({ ok: false, reason: 'failed' });
    expect(h.workspace.getVirtualContent('lost.md')).toBeNull();
  });

  it('updates search and preview paths after renaming and deleting sample content', async () => {
    const h = await harness();
    const path = h.state.flatList[0].fsPath;
    await h.post('renameWorkspaceEntry', { path, name: 'unique-demo-name.md', kind: 'file' });
    await h.post('searchWorkspace', { query: 'unique-demo-name' });
    expect(h.sent.flatMap(m => m.results ?? []).map((f: any) => f.fsPath)).toContain('unique-demo-name.md');
    expect(await h.post('loadSearchPreview', { filePath: 'unique-demo-name.md' })).toBeUndefined();
    expect(h.sent[0]).toMatchObject({ command: 'searchPreviewResult', ok: true });
    await h.post('deleteWorkspaceEntries', { paths: ['unique-demo-name.md'] });
    await h.post('loadSearchPreview', { filePath: 'unique-demo-name.md' });
    expect(h.sent[0]).toMatchObject({ command: 'searchPreviewResult', ok: false });
  });

  it('keeps an entirely deleted workspace empty after reload', async () => {
    const h = await harness();
    await h.post('deleteWorkspaceEntries', { paths: h.state.flatList.map((f: any) => f.fsPath) });
    vi.resetModules();
    expect((await harness()).state.flatList).toEqual([]);
  });
});
