import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nameRules from '../../../electron/workspace/workspace-entry-name.js';
import entries from '../../../electron/workspace/workspace-entries.js';

const { hasProtectedSegment, hasStreamSegment } = nameRules;
const { createWorkspaceEntry, deleteWorkspaceEntries, createWorkspaceEntryHandlers } = entries;
const roots: string[] = [];
function temp(prefix = 'mdx-resolved-'): string {
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

/** Portable stand-in for a Windows 8.3 short name: GIT~1 resolves to .git when the filesystem is asked. */
const alias = (target: string) => target.replace(/GIT~1(?=[\\/]|$)/, '.git');
const aliasFs = {
  ...fs,
  promises: {
    ...fs.promises,
    realpath: (target: string) => fs.promises.realpath(alias(target)),
    lstat: (target: string) => fs.promises.lstat(alias(target)),
  },
} as unknown as typeof fs;

function gitRepo(): string {
  const root = temp();
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, '.git', 'config'), 'keep');
  return root;
}

describe('protected segment helpers', () => {
  it.each([
    [['.git'], true],
    [['docs', '.GIT'], true],
    [['a', '.git '], true],
    [['a', '.git.'], true],
    [['ok'], false],
    [['git-notes.md', '.gitignore'], false],
    [[], false],
  ])('hasProtectedSegment(%j) is %s', (segments: string[], expected: boolean) => {
    expect(hasProtectedSegment(segments)).toBe(expected);
  });
  it('flags colon segments only on win32', () => {
    expect(hasStreamSegment(['a.md:stream'], 'win32')).toBe(true);
    expect(hasStreamSegment(['.git::$INDEX_ALLOCATION'], 'win32')).toBe(true);
    expect(hasStreamSegment(['a.md:stream'], 'linux')).toBe(false);
    expect(hasStreamSegment(['ok', 'fine.md'], 'win32')).toBe(false);
  });
});

describe('createWorkspaceEntry resolved-path protection', () => {
  it('refuses a parent that an alias resolves to .git', async () => {
    const root = gitRepo();
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'GIT~1', name: 'index.lock', kind: 'file', fsApi: aliasFs }))
      .resolves.toEqual({ ok: false, reason: 'protected' });
    expect(fs.existsSync(path.join(root, '.git', 'index.lock'))).toBe(false);
  });
  it('refuses a parent nested below an aliased .git', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, '.git', 'hooks'));
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'GIT~1/hooks', name: 'x', kind: 'file', fsApi: aliasFs }))
      .resolves.toMatchObject({ ok: false, reason: 'protected' });
  });
  it.skipIf(!canSymlink)('refuses a parent that is a link into .git', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, 'docs'));
    fs.symlinkSync(path.join(root, '.git'), path.join(root, 'docs', 'x'), 'junction');
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'docs/x', name: 'index.lock', kind: 'file' }))
      .resolves.toEqual({ ok: false, reason: 'protected' });
    expect(fs.existsSync(path.join(root, '.git', 'index.lock'))).toBe(false);
  });
  it('still creates inside a look-alike folder', async () => {
    const root = temp();
    fs.mkdirSync(path.join(root, '.github'));
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: '.github', name: 'a.md', kind: 'file' }))
      .resolves.toEqual({ ok: true, kind: 'file', path: '.github/a.md' });
  });
  it.runIf(process.platform === 'win32')('rejects an alternate-data-stream parent segment on win32', async () => {
    const root = temp();
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: '.git::$INDEX_ALLOCATION', name: 'x.md', kind: 'file' }))
      .resolves.toEqual({ ok: false, reason: 'invalid-name' });
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: 'a:b', name: 'x.md', kind: 'file' }))
      .resolves.toEqual({ ok: false, reason: 'invalid-name' });
  });
});

describe('deleteWorkspaceEntries resolved-path protection', () => {
  it('refuses an entry whose alias resolves to .git and keeps going', async () => {
    const root = gitRepo();
    fs.writeFileSync(path.join(root, 'b.md'), 'b');
    const trashItem = vi.fn(removeForTest);
    const result = await deleteWorkspaceEntries({ workspacePath: root, paths: ['GIT~1', 'b.md'], trashItem, fsApi: aliasFs });
    expect(result).toEqual({ deleted: ['b.md'], failed: [{ path: 'GIT~1', reason: 'protected' }] });
    expect(trashItem).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, '.git', 'config'))).toBe(true);
  });
  it.skipIf(!canSymlink)('refuses entries below a link into .git but trashes the link itself', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, 'docs'));
    fs.symlinkSync(path.join(root, '.git'), path.join(root, 'docs', 'x'), 'junction');
    const trashItem = vi.fn(async (target: string) => fs.promises.unlink(target));
    const result = await deleteWorkspaceEntries({ workspacePath: root, paths: ['docs/x/config', 'docs/x'], trashItem });
    expect(result).toEqual({ deleted: ['docs/x'], failed: [{ path: 'docs/x/config', reason: 'protected' }] });
    expect(trashItem).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, '.git', 'config'))).toBe(true);
  });
  it.runIf(process.platform === 'win32')('rejects alternate-data-stream segments on win32', async () => {
    const root = temp();
    const trashItem = vi.fn(removeForTest);
    const result = await deleteWorkspaceEntries({ workspacePath: root, paths: ['.git::$INDEX_ALLOCATION', 'a.md:stream'], trashItem });
    expect(result.deleted).toEqual([]);
    expect(result.failed.map((entry: { reason: string }) => entry.reason)).toEqual(['invalid-name', 'invalid-name']);
    expect(trashItem).not.toHaveBeenCalled();
  });
});

describe('non-string input guards', () => {
  it.each([123, null, undefined, {}, ['a.md'], true])('createWorkspaceEntry rejects name %j as invalid-name without throwing', async (name) => {
    const root = temp();
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: '', name: name as any, kind: 'file' }))
      .resolves.toEqual({ ok: false, reason: 'invalid-name' });
  });
  it.each([123, {}, ['docs']])('createWorkspaceEntry rejects parentPath %j as outside-workspace', async (parentPath) => {
    const root = temp();
    await expect(createWorkspaceEntry({ workspacePath: root, parentPath: parentPath as any, name: 'a.md', kind: 'file' }))
      .resolves.toEqual({ ok: false, reason: 'outside-workspace' });
  });
  it('fails non-string delete paths per entry while the rest proceed', async () => {
    const root = temp();
    fs.writeFileSync(path.join(root, 'a.md'), 'a');
    const trashItem = vi.fn(removeForTest);
    const result = await deleteWorkspaceEntries({ workspacePath: root, paths: [123, null, {}, 'a.md'] as any, trashItem });
    expect(result.deleted).toEqual(['a.md']);
    expect(result.failed).toEqual([
      { path: '', reason: 'outside-workspace' },
      { path: '', reason: 'outside-workspace' },
      { path: '', reason: 'outside-workspace' },
    ]);
  });
  it('replies invalid-name for a numeric name instead of throwing', async () => {
    const root = temp();
    const sendHostMessage = vi.fn();
    const refresh = vi.fn(async () => {});
    const handlers = createWorkspaceEntryHandlers({ getWorkspacePath: () => root, refresh, sendHostMessage, trashItem: removeForTest });
    await handlers.handleCreateWorkspaceEntry({ requestId: 'n1', parentPath: '', name: 123, kind: 'file' });
    expect(sendHostMessage).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'n1', ok: false, reason: 'invalid-name' });
    expect(refresh).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual([]);
  });
  it('replies failed when the host throws unexpectedly while creating', async () => {
    const sendHostMessage = vi.fn();
    const handlers = createWorkspaceEntryHandlers({
      getWorkspacePath: () => { throw new Error('state gone'); },
      refresh: vi.fn(), sendHostMessage, trashItem: removeForTest,
    });
    await handlers.handleCreateWorkspaceEntry({ requestId: 'n2', parentPath: '', name: 'a.md', kind: 'file' });
    expect(sendHostMessage).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'n2', ok: false, reason: 'failed', error: 'state gone' });
  });
});
