import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nameError } from '../../../vscode/src/core/workspaceEntryName';
import { handlePanelWorkspaceEntryMessage } from '../../../vscode/src/core/panelWorkspaceEntries';

const fixture = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/workspace-entry-names.json'), 'utf8'));
const roots: string[] = [];
const temp = (prefix = 'vsc-entries-') => { const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function probeSymlinks(): boolean {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-probe-'));
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

describe('vscode name rules', () => {
  it.each(fixture.valid)('accepts %j', (name: string) => expect(nameError(name)).toBeNull());
  it.each(fixture.invalid)('rejects %j as %s', (name: string, reason: string) => expect(nameError(name)).toBe(reason));
});

describe('handlePanelWorkspaceEntryMessage', () => {
  it('ignores other commands', async () => {
    await expect(handlePanelWorkspaceEntryMessage({ command: 'ready' }, { refresh: vi.fn(), post: vi.fn(), workspacePath: temp() })).resolves.toBe(false);
    await expect(handlePanelWorkspaceEntryMessage(null, { refresh: vi.fn(), post: vi.fn(), workspacePath: temp() })).resolves.toBe(false);
  });
  it('creates, refreshes, then posts the result', async () => {
    const root = temp();
    const order: string[] = [];
    const handled = await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'r1', parentPath: '', name: 'notes', kind: 'folder' },
      { workspacePath: root, refresh: async () => { order.push('refresh'); }, post: (message: any) => { order.push(message.command); } },
    );
    expect(handled).toBe(true);
    expect(order).toEqual(['refresh', 'createWorkspaceEntryResult']);
    expect(fs.statSync(path.join(root, 'notes')).isDirectory()).toBe(true);
  });
  it('creates an empty file in a nested folder with a workspace-relative path', async () => {
    const root = temp();
    fs.mkdirSync(path.join(root, 'docs'));
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'n', parentPath: 'docs', name: 'a.md', kind: 'file' },
      { workspacePath: root, refresh: vi.fn(), post },
    );
    expect(post).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'n', ok: true, kind: 'file', path: 'docs/a.md' });
    expect(fs.readFileSync(path.join(root, 'docs', 'a.md'), 'utf8')).toBe('');
  });
  it('reports exists, outside-workspace, protected and unsupported', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'keep');
    const post = vi.fn();
    const deps = { workspacePath: root, refresh: vi.fn(), post };
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: '1', parentPath: '', name: 'a.md', kind: 'file' }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: '2', parentPath: '..', name: 'b.md', kind: 'file' }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: '3', parentPath: '.git', name: 'b.md', kind: 'file' }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: '4', parentPath: '', name: 'b.md', kind: 'file' }, { ...deps, workspacePath: null });
    expect(post.mock.calls.map(([message]) => message.reason)).toEqual(['exists', 'outside-workspace', 'protected', 'unsupported']);
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, 'a.md'), 'utf8')).toBe('keep');
  });
  it.each([
    ['bad:name', 'invalid-name'],
    ['.git', 'protected'],
    [42, 'invalid-name'],
    [undefined, 'invalid-name'],
    [null, 'invalid-name'],
    [{}, 'invalid-name'],
  ])('name %j fails with %s without throwing', async (name, reason) => {
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'x', parentPath: '', name, kind: 'file' },
      { workspacePath: temp(), refresh: vi.fn(), post },
    );
    expect(post.mock.calls[0][0]).toMatchObject({ ok: false, reason });
  });
  it('rejects an unknown kind and a missing parent', async () => {
    const post = vi.fn();
    const deps = { workspacePath: temp(), refresh: vi.fn(), post };
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: 'k', parentPath: '', name: 'a.md', kind: 'socket' }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: 'm', parentPath: 'nope', name: 'a.md', kind: 'file' }, deps);
    expect(post.mock.calls.map(([message]) => message.reason)).toEqual(['invalid-name', 'missing']);
  });
  it('reports unsupported for a single-file workspace', async () => {
    const root = temp();
    const single = path.join(root, 'only.md');
    fs.writeFileSync(single, '# only');
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 's', parentPath: '', name: 'x.md', kind: 'file' },
      { workspacePath: single, refresh: vi.fn(), post },
    );
    expect(post.mock.calls[0][0]).toMatchObject({ ok: false, reason: 'unsupported' });
  });
  it.skipIf(!canSymlink)('refuses a symlinked parent that escapes the workspace', async () => {
    const root = temp();
    const outside = temp('vsc-outside-');
    fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'l', parentPath: 'link', name: 'x.md', kind: 'file' },
      { workspacePath: root, refresh: vi.fn(), post },
    );
    expect(post.mock.calls[0][0]).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(fs.existsSync(path.join(outside, 'x.md'))).toBe(false);
  });
  it('still replies when refresh throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'r', parentPath: '', name: 'a.md', kind: 'file' },
      { workspacePath: temp(), refresh: async () => { throw new Error('boom'); }, post },
    );
    expect(post).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'r', ok: true, kind: 'file', path: 'a.md' });
    errorSpy.mockRestore();
  });
  it('deletes through the trash callback with mode trash', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const trashEntry = vi.fn(async (target: string) => fs.promises.rm(target));
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'd', paths: ['a.md', 'gone.md', ''] }, { workspacePath: root, refresh: vi.fn(), post, trashEntry });
    expect(post).toHaveBeenCalledWith({
      command: 'deleteWorkspaceEntriesResult', requestId: 'd', mode: 'trash', deleted: ['a.md'],
      failed: [{ path: 'gone.md', reason: 'missing' }, { path: '', reason: 'protected' }],
    });
  });
  it('refreshes before the delete reply only when something was deleted', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const order: string[] = [];
    const deps = {
      workspacePath: root,
      trashEntry: async (target: string) => fs.promises.rm(target),
      refresh: async () => { order.push('refresh'); },
      post: (message: any) => { order.push(message.command); },
    };
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: '1', paths: ['a.md'] }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: '2', paths: ['a.md'] }, deps);
    expect(order).toEqual(['refresh', 'deleteWorkspaceEntriesResult', 'deleteWorkspaceEntriesResult']);
  });
  it('classifies protected and outside paths and tolerates a non-array paths field', async () => {
    const root = temp();
    const trashEntry = vi.fn();
    const post = vi.fn();
    const deps = { workspacePath: root, refresh: vi.fn(), post, trashEntry };
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'p', paths: ['.git/config', '../x', 'a\\b'] }, deps);
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'q', paths: 'a.md' }, deps);
    expect(post.mock.calls[0][0].failed).toEqual([
      { path: '.git/config', reason: 'protected' },
      { path: '../x', reason: 'outside-workspace' },
      { path: 'a\\b', reason: 'outside-workspace' },
    ]);
    expect(post.mock.calls[1][0]).toMatchObject({ deleted: [], failed: [] });
    expect(trashEntry).not.toHaveBeenCalled();
  });
  it('maps trash errors and fails every path as unsupported without a folder workspace', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const post = vi.fn();
    const trashEntry = vi.fn(async () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); });
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'e', paths: ['a.md'] }, { workspacePath: root, refresh: vi.fn(), post, trashEntry });
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'u', paths: ['a.md'] }, { workspacePath: null, refresh: vi.fn(), post, trashEntry });
    expect(post.mock.calls[0][0].failed).toEqual([{ path: 'a.md', reason: 'permission-denied' }]);
    expect(post.mock.calls[1][0].failed).toEqual([{ path: 'a.md', reason: 'unsupported' }]);
  });
  it.skipIf(!canSymlink)('trashes a symlink as a link, not its target', async () => {
    const root = temp();
    const outside = temp('vsc-outside-');
    fs.writeFileSync(path.join(outside, 'keep.md'), 'keep');
    fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
    const trashEntry = vi.fn(async (target: string) => fs.promises.unlink(target));
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'sl', paths: ['link'] }, { workspacePath: root, refresh: vi.fn(), post: vi.fn(), trashEntry });
    expect(trashEntry).toHaveBeenCalledWith(path.join(fs.realpathSync(root), 'link'));
    expect(fs.existsSync(path.join(outside, 'keep.md'))).toBe(true);
  });
  it('uses the VS Code workspace folder and workspace.fs trash by default', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const remove = vi.fn(async () => {});
    const vscodeApi = {
      workspace: { workspaceFolders: [{ uri: { fsPath: root } }], fs: { delete: remove } },
      Uri: { file: (value: string) => ({ fsPath: value }) },
    };
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'v', paths: ['a.md'] }, { vscodeApi, refresh: vi.fn(), post });
    expect(remove).toHaveBeenCalledWith({ fsPath: path.join(fs.realpathSync(root), 'a.md') }, { recursive: true, useTrash: true });
    expect(post.mock.calls[0][0]).toMatchObject({ deleted: ['a.md'], failed: [] });
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: 'v2', parentPath: '', name: 'b.md', kind: 'file' }, { vscodeApi, refresh: vi.fn(), post });
    expect(fs.existsSync(path.join(root, 'b.md'))).toBe(true);
  });
  it('reports unsupported when no VS Code API or workspace folder is available', async () => {
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: 'n1', parentPath: '', name: 'a.md', kind: 'file' }, { refresh: vi.fn(), post });
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'n2', parentPath: '', name: 'a.md', kind: 'file' },
      { vscodeApi: { workspace: { workspaceFolders: undefined, fs: { delete: vi.fn() } }, Uri: { file: (value: string) => value } }, refresh: vi.fn(), post },
    );
    expect(post.mock.calls.map(([message]) => message.reason)).toEqual(['unsupported', 'unsupported']);
  });
  it('maps unexpected filesystem failures to failed', async () => {
    const root = temp();
    const fsApi = { ...fs, promises: { ...fs.promises, mkdir: async () => { throw new Error('disk on fire'); } } } as unknown as typeof fs;
    const post = vi.fn();
    await handlePanelWorkspaceEntryMessage(
      { command: 'createWorkspaceEntry', requestId: 'f', parentPath: '', name: 'x', kind: 'folder' },
      { workspacePath: root, refresh: vi.fn(), post, fsApi },
    );
    expect(post.mock.calls[0][0]).toMatchObject({ ok: false, reason: 'failed', error: 'disk on fire' });
  });
});
