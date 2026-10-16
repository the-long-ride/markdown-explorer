import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nameRules from '../../../electron/workspace/workspace-entry-name.js';
import entries from '../../../electron/workspace/workspace-entries.js';

const { nameError } = nameRules;
const { createWorkspaceEntry, deleteWorkspaceEntries, createWorkspaceEntryHandlers } = entries;
const fixture = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/workspace-entry-names.json'), 'utf8'));
const roots: string[] = [];
function temp(prefix = 'mdx-entries-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}
const removeForTest = async (target: string) => fs.promises.rm(target, { recursive: true, force: true });
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function probeSymlinks(): boolean {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-probe-'));
  try {
    const target = path.join(root, 'target');
    fs.mkdirSync(target);
    fs.symlinkSync(target, path.join(root, 'link'), 'junction');
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const canSymlink = probeSymlinks();

describe('electron name rules', () => {
  it.each(fixture.valid)('accepts %j', (name: string) => expect(nameError(name)).toBeNull());
  it.each(fixture.invalid)('rejects %j as %s', (name: string, reason: string) => expect(nameError(name)).toBe(reason));
});

describe('createWorkspaceEntry', () => {
  it('creates an empty file and a folder', async () => {
    const root = temp();
    fs.mkdirSync(path.join(root, 'docs'));
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'docs', name: 'a.md', kind: 'file' }))
      .resolves.toEqual({ ok: true, kind: 'file', path: 'docs/a.md' });
    expect(fs.readFileSync(path.join(root, 'docs', 'a.md'), 'utf8')).toBe('');
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: '', name: 'notes', kind: 'folder' }))
      .resolves.toEqual({ ok: true, kind: 'folder', path: 'notes' });
    expect(fs.statSync(path.join(root, 'notes')).isDirectory()).toBe(true);
  });
  it('never overwrites', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'keep me');
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: '', name: 'a.md', kind: 'file' }))
      .resolves.toMatchObject({ ok: false, reason: 'exists' });
    expect(fs.readFileSync(path.join(root, 'a.md'), 'utf8')).toBe('keep me');
  });
  it.each([
    ['', 'bad:name', 'invalid-name'],
    ['', '.git', 'protected'],
    ['.git', 'x.md', 'protected'],
    ['../outside', 'x.md', 'outside-workspace'],
    ['missing', 'x.md', 'missing'],
  ])('parent %j name %j fails with %s', async (parentPath, name, reason) => {
    const root = temp();
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath, name, kind: 'file' }))
      .resolves.toMatchObject({ ok: false, reason });
  });
  it.skipIf(!canSymlink)('refuses a symlinked parent that escapes the workspace', async () => {
    const root = temp();
    const outside = temp('mdx-outside-');
    fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'link', name: 'x.md', kind: 'file' }))
      .resolves.toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(fs.existsSync(path.join(outside, 'x.md'))).toBe(false);
  });
  it('reports unsupported for a single-file workspace', async () => {
    const root = temp();
    const single = path.join(root, 'only.md');
    fs.writeFileSync(single, '# only');
    await expect(createWorkspaceEntry({ workspacePath: single, parentPath: '', name: 'x.md', kind: 'file' }))
      .resolves.toMatchObject({ ok: false, reason: 'unsupported' });
  });
});

describe('deleteWorkspaceEntries', () => {
  it('trashes each path independently and reports failures per path', async () => {
    const root = temp();
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'a');
    fs.writeFileSync(path.join(root, 'b.md'), 'b');
    const trashItem = vi.fn(removeForTest);
    const result = await deleteWorkspaceEntries({ workspacePath: root, paths: ['docs', 'b.md', 'nope.md', '', '.git/config', '../x'], trashItem });
    expect(result.deleted).toEqual(['docs', 'b.md']);
    expect(result.failed).toEqual([
      { path: 'nope.md', reason: 'missing' },
      { path: '', reason: 'protected' },
      { path: '.git/config', reason: 'protected' },
      { path: '../x', reason: 'outside-workspace' },
    ]);
    expect(trashItem).toHaveBeenCalledTimes(2);
  });
  it.skipIf(!canSymlink)('removes a symlink as a link, not its target', async () => {
    const root = temp();
    const outside = temp('mdx-outside-');
    fs.writeFileSync(path.join(outside, 'keep.md'), 'keep');
    fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
    const trashItem = vi.fn(async (target: string) => fs.promises.unlink(target));
    await deleteWorkspaceEntries({ workspacePath: root, paths: ['link'], trashItem });
    expect(trashItem).toHaveBeenCalledWith(path.join(fs.realpathSync(root), 'link'));
    expect(fs.existsSync(path.join(outside, 'keep.md'))).toBe(true);
  });
  it('maps trash errors', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const trashItem = vi.fn(async () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); });
    await expect(deleteWorkspaceEntries({ workspacePath: root, paths: ['a.md'], trashItem }))
      .resolves.toEqual({ deleted: [], failed: [{ path: 'a.md', reason: 'permission-denied' }] });
  });
  it('fails every path as unsupported for a single-file workspace', async () => {
    const root = temp();
    const single = path.join(root, 'only.md');
    fs.writeFileSync(single, '# only');
    const trashItem = vi.fn(removeForTest);
    await expect(deleteWorkspaceEntries({ workspacePath: single, paths: ['only.md'], trashItem }))
      .resolves.toEqual({ deleted: [], failed: [{ path: 'only.md', reason: 'unsupported' }] });
    expect(trashItem).not.toHaveBeenCalled();
  });
});

describe('createWorkspaceEntryHandlers', () => {
  it('refreshes before replying on success and skips refresh on failure', async () => {
    const root = temp();
    const order: string[] = [];
    const handlers = createWorkspaceEntryHandlers({
      getWorkspacePath: () => root,
      refresh: async () => { order.push('refresh'); },
      sendHostMessage: (message: any) => { order.push(message.command); },
      trashItem: removeForTest,
    });
    await handlers.handleCreateWorkspaceEntry({ requestId: 'r1', parentPath: '', name: 'a.md', kind: 'file' });
    await handlers.handleCreateWorkspaceEntry({ requestId: 'r2', parentPath: '', name: 'a.md', kind: 'file' });
    await handlers.handleDeleteWorkspaceEntries({ requestId: 'r3', paths: ['a.md'] });
    expect(order).toEqual(['refresh', 'createWorkspaceEntryResult', 'createWorkspaceEntryResult', 'refresh', 'deleteWorkspaceEntriesResult']);
  });
  it('still replies when refresh throws', async () => {
    const root = temp();
    const sendHostMessage = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handlers = createWorkspaceEntryHandlers({ getWorkspacePath: () => root, refresh: async () => { throw new Error('boom'); }, sendHostMessage, trashItem: removeForTest });
    await handlers.handleCreateWorkspaceEntry({ requestId: 'r1', parentPath: '', name: 'a.md', kind: 'file' });
    expect(sendHostMessage).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'r1', ok: true, kind: 'file', path: 'a.md' });
    errorSpy.mockRestore();
  });
  it('replies with the failed list and mode trash for partial deletes', async () => {
    const root = temp();
    const sendHostMessage = vi.fn();
    const refresh = vi.fn(async () => {});
    const handlers = createWorkspaceEntryHandlers({ getWorkspacePath: () => root, refresh, sendHostMessage, trashItem: removeForTest });
    await handlers.handleDeleteWorkspaceEntries({ requestId: 'r9', paths: ['nope.md'] });
    expect(refresh).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenCalledWith({
      command: 'deleteWorkspaceEntriesResult', requestId: 'r9', mode: 'trash', deleted: [], failed: [{ path: 'nope.md', reason: 'missing' }],
    });
  });
  it('replies with every path failed when the delete handler throws', async () => {
    const sendHostMessage = vi.fn();
    const refresh = vi.fn(async () => {});
    const handlers = createWorkspaceEntryHandlers({
      getWorkspacePath: () => { throw new Error('boom'); }, refresh, sendHostMessage, trashItem: removeForTest,
    });
    await handlers.handleDeleteWorkspaceEntries({ requestId: 'r7', paths: ['a.md', 'dir/b.md', 5] });
    expect(refresh).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenCalledTimes(1);
    expect(sendHostMessage).toHaveBeenCalledWith({
      command: 'deleteWorkspaceEntriesResult', requestId: 'r7', mode: 'trash', deleted: [],
      failed: [{ path: 'a.md', reason: 'failed' }, { path: 'dir/b.md', reason: 'failed' }, { path: '', reason: 'failed' }],
    });
  });
  it('replies with an empty failed list when the delete handler throws without a paths array', async () => {
    const sendHostMessage = vi.fn();
    const handlers = createWorkspaceEntryHandlers({
      getWorkspacePath: () => { throw new Error('boom'); }, refresh: async () => {}, sendHostMessage, trashItem: removeForTest,
    });
    await handlers.handleDeleteWorkspaceEntries(undefined);
    expect(sendHostMessage).toHaveBeenCalledWith({
      command: 'deleteWorkspaceEntriesResult', requestId: undefined, mode: 'trash', deleted: [], failed: [],
    });
  });
});
