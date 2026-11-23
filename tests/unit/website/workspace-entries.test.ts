import { describe, expect, it, vi } from 'vitest';
import { createBrowserWorkspaceEntry, handleBrowserWorkspaceEntryCommand, renameBrowserWorkspaceEntry } from '../../../website-app/src/workspace-entries';
import { handleWebFileUtilityMessage } from '../../../website-app/src/web-file-utility-router';
import { memoryFile, MemoryFolder } from './memory-file-system';

class MemoryFile {
  readonly kind = 'file';
  content = '';
  constructor(readonly name: string) {}
  async getFile() { return new Blob([this.content]); }
  async createWritable() { return { write: async (data: Blob) => { this.content = await data.text(); }, close: async () => {} }; }
}

describe('browser workspace rename', () => {
  it('rejects unsupported, protected, and invalid paths before asking for permission', async () => {
    const folder = new MemoryFolder('root', 'denied');
    const root = folder.asHandle();
    const input = { path: 'old.md', name: 'new.md', kind: 'file' };
    expect(await renameBrowserWorkspaceEntry(null, input)).toMatchObject({ reason: 'unsupported' });
    for (const [patch, reason] of [
      [{ path: '../outside.md' }, 'outside-workspace'],
      [{ path: '.git/config' }, 'protected'],
      [{ path: undefined }, 'protected'],
      [{ name: undefined }, 'invalid-name'],
      [{ name: 'outside/file.md' }, 'invalid-name'],
      [{ kind: 'symlink' }, 'invalid-name'],
      [{}, 'permission-denied'],
    ] as const) {
      expect(await renameBrowserWorkspaceEntry(root, { ...input, ...patch })).toMatchObject({ ok: false, reason });
    }
  });

  it('does not replace an existing directory, but allows a same-name rename', async () => {
    const folder = new MemoryFolder('root');
    folder.children.set('notes', new MemoryFolder('notes'));
    folder.children.set('archive', new MemoryFolder('archive'));
    const root = folder.asHandle();
    expect(await renameBrowserWorkspaceEntry(root, { path: 'notes', name: 'notes', kind: 'folder' }))
      .toEqual({ ok: true, oldPath: 'notes', path: 'notes', kind: 'folder' });
    expect(await renameBrowserWorkspaceEntry(root, { path: 'notes', name: 'archive', kind: 'folder' }))
      .toMatchObject({ ok: false, reason: 'exists' });
  });

  it('uses a browser-native move for case-only renames of the same entry', async () => {
    const folder = new MemoryFolder('root');
    const note = Object.assign(memoryFile('note.md', '# Note'), {
      isSameEntry: vi.fn().mockResolvedValue(true),
      move: vi.fn(),
    });
    folder.children.set('note.md', note);
    folder.children.set('different.md', memoryFile('different.md', '# Different'));
    const original = folder.getFileHandle.bind(folder);
    vi.spyOn(folder, 'getFileHandle').mockImplementation((name, options) => original(name === 'NOTE.md' ? 'note.md' : name, options));
    const root = folder.asHandle();
    expect(await renameBrowserWorkspaceEntry(root, { path: 'note.md', name: 'different.md', kind: 'file' })).toMatchObject({ reason: 'exists' });
    note.isSameEntry.mockResolvedValueOnce(false);
    expect(await renameBrowserWorkspaceEntry(root, { path: 'note.md', name: 'NOTE.md', kind: 'file' })).toMatchObject({ reason: 'exists' });
    expect(await renameBrowserWorkspaceEntry(root, { path: 'note.md', name: 'NOTE.md', kind: 'file' })).toMatchObject({ ok: true, path: 'NOTE.md' });
    expect(note.move).toHaveBeenCalledExactlyOnceWith(root, 'NOTE.md');
  });

  it('keeps the source and rolls back an incomplete recursive copy', async () => {
    const root = new MemoryFolder('root');
    const child = new MemoryFolder('child');
    const file = memoryFile('private.md', '# Secret');
    child.children.set(file.name, file);
    root.children.set(child.name, child);
    vi.spyOn(file, 'getFile').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    expect(await renameBrowserWorkspaceEntry(root.asHandle(), { path: 'child', name: 'next', kind: 'folder' }))
      .toMatchObject({ ok: false, reason: 'permission-denied' });
    expect([...root.children.keys()]).toEqual(['child']);

    vi.spyOn(root, 'getFileHandle').mockRejectedValue(new DOMException('Restricted', 'SecurityError'));
    expect(await createBrowserWorkspaceEntry(root.asHandle(), { name: 'new.md', kind: 'file' }))
      .toMatchObject({ ok: false, reason: 'permission-denied', error: 'Restricted' });
  });
});
class MemoryDir {
  readonly kind = 'directory';
  readonly entries = new Map<string, MemoryDir | MemoryFile>();
  permission: PermissionState = 'granted';
  constructor(readonly name: string) {}
  async queryPermission() { return this.permission; }
  async requestPermission() { return this.permission; }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryDir) return entry;
    if (entry) throw new DOMException('type', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const dir = new MemoryDir(name);
    this.entries.set(name, dir);
    return dir;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryFile) return entry;
    if (entry) throw new DOMException('type', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const file = new MemoryFile(name);
    this.entries.set(name, file);
    return file;
  }
  async *[Symbol.asyncIterator]() { for (const entry of this.entries) yield entry; }
  async removeEntry(name: string) {
    if (!this.entries.delete(name)) throw new DOMException('missing', 'NotFoundError');
  }
}

function setup() {
  const root = new MemoryDir('root');
  const sent: any[] = [];
  const order: string[] = [];
  const context = {
    activeHandle: root as unknown as FileSystemDirectoryHandle,
    send: (message: any) => { sent.push(message); order.push(message.command); },
    refreshWorkspace: vi.fn(async () => { order.push('refresh'); }),
  };
  return { root, sent, order, context };
}

describe('handleBrowserWorkspaceEntryCommand', () => {
  it('ignores unrelated commands', async () => {
    const { context } = setup();
    await expect(handleBrowserWorkspaceEntryCommand({ command: 'ready' }, context)).resolves.toBe(false);
  });
  it('creates a file and folder, refreshing first', async () => {
    const { root, sent, order, context } = setup();
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: '1', parentPath: '', name: 'docs', kind: 'folder' }, context);
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: '2', parentPath: 'docs', name: 'a.md', kind: 'file' }, context);
    expect(sent.map((m) => m.path)).toEqual(['docs', 'docs/a.md']);
    expect(sent.map((m) => m.kind)).toEqual(['folder', 'file']);
    expect(sent.every((m) => m.ok === true)).toBe(true);
    expect(order).toEqual(['refresh', 'createWorkspaceEntryResult', 'refresh', 'createWorkspaceEntryResult']);
    expect((root.entries.get('docs') as MemoryDir).entries.has('a.md')).toBe(true);
  });
  it('still replies ok when the refresh fails', async () => {
    const { sent, context } = setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    context.refreshWorkspace.mockRejectedValueOnce(new Error('scan failed'));
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: 'r', parentPath: '', name: 'a.md', kind: 'file' }, context);
    expect(sent[0]).toEqual({ command: 'createWorkspaceEntryResult', requestId: 'r', ok: true, kind: 'file', path: 'a.md' });
    errorSpy.mockRestore();
  });
  it.each([
    [{ parentPath: '', name: 'docs', kind: 'file' }, 'exists'],
    [{ parentPath: '', name: 'docs', kind: 'folder' }, 'exists'],
    [{ parentPath: '', name: 'note.md', kind: 'file' }, 'exists'],
    [{ parentPath: '', name: 'a|b', kind: 'file' }, 'invalid-name'],
    [{ parentPath: '', name: 42, kind: 'file' }, 'invalid-name'],
    [{ parentPath: '', name: { toString: () => 'x.md' }, kind: 'file' }, 'invalid-name'],
    [{ parentPath: '', name: undefined, kind: 'file' }, 'invalid-name'],
    [{ parentPath: '', name: 'x.md', kind: 'link' }, 'invalid-name'],
    [{ parentPath: '', name: '.git', kind: 'folder' }, 'protected'],
    [{ parentPath: '.git', name: 'x.md', kind: 'file' }, 'protected'],
    [{ parentPath: 'docs/.GIT', name: 'x.md', kind: 'file' }, 'protected'],
    [{ parentPath: '../up', name: 'x.md', kind: 'file' }, 'outside-workspace'],
    [{ parentPath: 'docs\\sub', name: 'x.md', kind: 'file' }, 'outside-workspace'],
    [{ parentPath: 'missing', name: 'x.md', kind: 'file' }, 'missing'],
    [{ parentPath: 'note.md', name: 'x.md', kind: 'file' }, 'missing'],
  ])('create %j fails with %s', async (input, reason) => {
    const { root, sent, context } = setup();
    root.entries.set('docs', new MemoryDir('docs'));
    root.entries.set('note.md', new MemoryFile('note.md'));
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: 'x', ...input }, context);
    expect(sent[0]).toMatchObject({ command: 'createWorkspaceEntryResult', requestId: 'x', ok: false, reason });
    expect(context.refreshWorkspace).not.toHaveBeenCalled();
    expect(root.entries.size).toBe(2);
  });
  it('reports permission-denied and unsupported', async () => {
    const { root, sent, context } = setup();
    root.permission = 'denied';
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: 'p', parentPath: '', name: 'a.md', kind: 'file' }, context);
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: 'u', parentPath: '', name: 'a.md', kind: 'file' }, { ...context, activeHandle: null });
    expect(sent.map((m) => m.reason)).toEqual(['permission-denied', 'unsupported']);
    expect(root.entries.size).toBe(0);
  });
  it('replies permission-denied when the permission query itself throws (create)', async () => {
    const { root, sent, context } = setup();
    root.queryPermission = async () => { throw new DOMException('revoked', 'InvalidStateError'); };
    await handleBrowserWorkspaceEntryCommand({ command: 'createWorkspaceEntry', requestId: 't', parentPath: '', name: 'a.md', kind: 'file' }, context);
    expect(sent).toEqual([{ command: 'createWorkspaceEntryResult', requestId: 't', ok: false, reason: 'permission-denied' }]);
    expect(root.entries.size).toBe(0);
  });
  it('replies per-path permission-denied when the permission query throws (delete)', async () => {
    const { root, sent, context } = setup();
    root.entries.set('b.md', new MemoryFile('b.md'));
    root.queryPermission = async () => { throw new DOMException('revoked', 'InvalidStateError'); };
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: 't', paths: ['b.md', '.git', 'c.md'] }, context);
    expect(sent).toEqual([{
      command: 'deleteWorkspaceEntriesResult', requestId: 't', mode: 'permanent', deleted: [],
      failed: [{ path: 'b.md', reason: 'permission-denied' }, { path: '.git', reason: 'protected' }, { path: 'c.md', reason: 'permission-denied' }],
    }]);
    expect(root.entries.has('b.md')).toBe(true);
  });
  it('deletes permanently and reports each path', async () => {
    const { root, sent, context } = setup();
    const docs = new MemoryDir('docs');
    docs.entries.set('a.md', new MemoryFile('a.md'));
    root.entries.set('docs', docs);
    root.entries.set('b.md', new MemoryFile('b.md'));
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: 'd', paths: ['docs', 'b.md', 'gone.md', '', '.git'] }, context);
    expect(sent[0]).toEqual({
      command: 'deleteWorkspaceEntriesResult', requestId: 'd', mode: 'permanent', deleted: ['docs', 'b.md'],
      failed: [{ path: 'gone.md', reason: 'missing' }, { path: '', reason: 'protected' }, { path: '.git', reason: 'protected' }],
    });
    expect(root.entries.size).toBe(0);
  });
  it('refreshes before the delete reply and not when nothing was deleted', async () => {
    const { root, order, context } = setup();
    root.entries.set('b.md', new MemoryFile('b.md'));
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: '1', paths: ['b.md'] }, context);
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: '2', paths: ['b.md'] }, context);
    expect(order).toEqual(['refresh', 'deleteWorkspaceEntriesResult', 'deleteWorkspaceEntriesResult']);
  });
  it('deletes nested paths and rejects traversal, git segments and bad input', async () => {
    const { root, sent, context } = setup();
    const docs = new MemoryDir('docs');
    docs.entries.set('a.md', new MemoryFile('a.md'));
    root.entries.set('docs', docs);
    root.entries.set('.git', new MemoryDir('.git'));
    await handleBrowserWorkspaceEntryCommand(
      { command: 'deleteWorkspaceEntries', requestId: 'n', paths: ['docs/a.md', '../x.md', 'docs/../a.md', '.git/config', 'docs//a.md'] },
      context,
    );
    expect(sent[0].deleted).toEqual(['docs/a.md']);
    expect(sent[0].failed).toEqual([
      { path: '../x.md', reason: 'outside-workspace' },
      { path: 'docs/../a.md', reason: 'outside-workspace' },
      { path: '.git/config', reason: 'protected' },
      { path: 'docs//a.md', reason: 'outside-workspace' },
    ]);
    expect(root.entries.has('.git')).toBe(true);
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: 'o', paths: 'docs' }, context);
    expect(sent[1]).toEqual({ command: 'deleteWorkspaceEntriesResult', requestId: 'o', mode: 'permanent', deleted: [], failed: [] });
  });
  it('fails every delete with permission-denied or unsupported', async () => {
    const { root, sent, context } = setup();
    root.entries.set('b.md', new MemoryFile('b.md'));
    root.permission = 'denied';
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: 'p', paths: ['b.md'] }, context);
    await handleBrowserWorkspaceEntryCommand({ command: 'deleteWorkspaceEntries', requestId: 'u', paths: ['b.md'] }, { ...context, activeHandle: null });
    expect(sent[0].failed).toEqual([{ path: 'b.md', reason: 'permission-denied' }]);
    expect(sent[1].failed).toEqual([{ path: 'b.md', reason: 'unsupported' }]);
    expect(root.entries.has('b.md')).toBe(true);
    expect(context.refreshWorkspace).not.toHaveBeenCalled();
  });
});

describe('Web host routing', () => {
  it('routes workspace entry commands before the other utility commands', async () => {
    const { root, sent, context } = setup();
    const utilityDeps = {
      getSearchIndex: () => null,
      getFlatList: () => [],
      getWorkspaceTree: () => null,
      getActiveWorkspacePath: () => '/site-workspace',
      getActiveHandle: () => context.activeHandle,
      getSingleFileHandle: () => null,
      send: context.send,
      readText: vi.fn(),
      refreshWorkspace: context.refreshWorkspace,
    };
    await expect(handleWebFileUtilityMessage(
      { command: 'createWorkspaceEntry', requestId: 'c', parentPath: '', name: 'a.md', kind: 'file' }, utilityDeps,
    )).resolves.toBe(true);
    expect(sent[0]).toMatchObject({ command: 'createWorkspaceEntryResult', ok: true, path: 'a.md' });
    expect(root.entries.has('a.md')).toBe(true);
    expect(context.refreshWorkspace).toHaveBeenCalledTimes(1);
  });
});

it('renames browser files and folder descendants without overwriting siblings', async () => {
  const { root, context, sent, order } = setup();
  const docs = await root.getDirectoryHandle('docs', { create: true });
  const file = await docs.getFileHandle('a.md', { create: true }); file.content = 'keep';
  expect(await handleBrowserWorkspaceEntryCommand({ command: 'renameWorkspaceEntry', requestId: 'r', path: 'docs/a.md', name: 'b.md', kind: 'file' }, context)).toBe(true);
  expect(sent.at(-1)).toMatchObject({ ok: true, path: 'docs/b.md' });
  expect(order).toEqual(['renameWorkspaceEntryResult', 'refresh']);
  expect((docs.entries.get('b.md') as MemoryFile).content).toBe('keep');
  await handleBrowserWorkspaceEntryCommand({ command: 'renameWorkspaceEntry', requestId: 'f', path: 'docs', name: 'notes', kind: 'folder' }, context);
  expect(sent.at(-1)).toMatchObject({ ok: true, path: 'notes' });
  expect(((root.entries.get('notes') as MemoryDir).entries.get('b.md') as MemoryFile).content).toBe('keep');
  const notes = root.entries.get('notes') as MemoryDir; await notes.getFileHandle('c.md', { create: true });
  await handleBrowserWorkspaceEntryCommand({ command: 'renameWorkspaceEntry', requestId: 'c', path: 'notes/b.md', name: 'c.md', kind: 'file' }, context);
  expect(sent.at(-1)).toMatchObject({ ok: false, reason: 'exists' });
  expect((notes.entries.get('b.md') as MemoryFile).content).toBe('keep');
});
it('keeps the complete browser copy if recursive source removal partially fails',async()=>{
  const {root,context,sent}=setup();const docs=await root.getDirectoryHandle('docs',{create:true});
  (await docs.getFileHandle('a.md',{create:true})).content='A';(await docs.getFileHandle('b.md',{create:true})).content='B';
  const remove=root.removeEntry.bind(root);root.removeEntry=async(name:string)=>{if(name==='docs'){docs.entries.delete('a.md');throw new DOMException('locked','NotAllowedError');}await remove(name);};
  await handleBrowserWorkspaceEntryCommand({command:'renameWorkspaceEntry',requestId:'partial',path:'docs',name:'notes',kind:'folder'},context);
  expect(sent.at(-1)).toMatchObject({ok:false});
  const copy=root.entries.get('notes') as MemoryDir;expect(copy).toBeDefined();expect((copy.entries.get('a.md') as MemoryFile).content).toBe('A');expect((copy.entries.get('b.md') as MemoryFile).content).toBe('B');
});
