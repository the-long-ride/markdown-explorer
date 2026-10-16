import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasProtectedSegment, hasStreamSegment } from '../../../vscode/src/core/workspaceEntryName';
import { handlePanelWorkspaceEntryMessage } from '../../../vscode/src/core/panelWorkspaceEntries';

const roots: string[] = [];
const temp = (prefix = 'vsc-resolved-') => { const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(root); return root; };
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

async function create(deps: Record<string, unknown>, parentPath: unknown, name: unknown = 'index.lock') {
  const post = vi.fn();
  await handlePanelWorkspaceEntryMessage({ command: 'createWorkspaceEntry', requestId: 'c', parentPath, name, kind: 'file' }, { refresh: vi.fn(), post, ...deps } as any);
  return post.mock.calls[0][0];
}
async function remove(deps: Record<string, unknown>, paths: unknown) {
  const post = vi.fn();
  await handlePanelWorkspaceEntryMessage({ command: 'deleteWorkspaceEntries', requestId: 'd', paths }, { refresh: vi.fn(), post, ...deps } as any);
  return post.mock.calls[0][0];
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

describe('create resolved-path protection', () => {
  it('refuses a parent that an alias resolves to .git', async () => {
    const root = gitRepo();
    expect(await create({ workspacePath: root, fsApi: aliasFs }, 'GIT~1')).toEqual({ command: 'createWorkspaceEntryResult', requestId: 'c', ok: false, reason: 'protected' });
    expect(fs.existsSync(path.join(root, '.git', 'index.lock'))).toBe(false);
  });
  it('refuses a parent nested below an aliased .git', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, '.git', 'hooks'));
    expect(await create({ workspacePath: root, fsApi: aliasFs }, 'GIT~1/hooks', 'x')).toMatchObject({ ok: false, reason: 'protected' });
  });
  it.skipIf(!canSymlink)('refuses a parent that is a link into .git', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, 'docs'));
    fs.symlinkSync(path.join(root, '.git'), path.join(root, 'docs', 'x'), 'junction');
    expect(await create({ workspacePath: root }, 'docs/x')).toMatchObject({ ok: false, reason: 'protected' });
    expect(fs.existsSync(path.join(root, '.git', 'index.lock'))).toBe(false);
  });
  it('still creates inside a look-alike folder', async () => {
    const root = temp();
    fs.mkdirSync(path.join(root, '.github'));
    expect(await create({ workspacePath: root }, '.github', 'a.md')).toMatchObject({ ok: true, path: '.github/a.md' });
  });
  it.runIf(process.platform === 'win32')('rejects an alternate-data-stream parent segment on win32', async () => {
    const root = temp();
    expect(await create({ workspacePath: root }, '.git::$INDEX_ALLOCATION', 'x.md')).toMatchObject({ ok: false, reason: 'invalid-name' });
    expect(await create({ workspacePath: root }, 'a:b', 'x.md')).toMatchObject({ ok: false, reason: 'invalid-name' });
  });
});

describe('delete resolved-path protection', () => {
  it('refuses an entry whose alias resolves to .git and keeps going', async () => {
    const root = gitRepo();
    fs.writeFileSync(path.join(root, 'b.md'), 'b');
    const trashEntry = vi.fn(async (target: string) => fs.promises.rm(target, { recursive: true, force: true }));
    const reply = await remove({ workspacePath: root, fsApi: aliasFs, trashEntry }, ['GIT~1', 'b.md']);
    expect(reply).toMatchObject({ deleted: ['b.md'], failed: [{ path: 'GIT~1', reason: 'protected' }] });
    expect(trashEntry).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, '.git', 'config'))).toBe(true);
  });
  it.skipIf(!canSymlink)('refuses entries below a link into .git but trashes the link itself', async () => {
    const root = gitRepo();
    fs.mkdirSync(path.join(root, 'docs'));
    fs.symlinkSync(path.join(root, '.git'), path.join(root, 'docs', 'x'), 'junction');
    const trashEntry = vi.fn(async (target: string) => fs.promises.unlink(target));
    const reply = await remove({ workspacePath: root, trashEntry }, ['docs/x/config', 'docs/x']);
    expect(reply).toMatchObject({ deleted: ['docs/x'], failed: [{ path: 'docs/x/config', reason: 'protected' }] });
    expect(trashEntry).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, '.git', 'config'))).toBe(true);
  });
  it.runIf(process.platform === 'win32')('rejects alternate-data-stream segments on win32', async () => {
    const root = temp();
    const trashEntry = vi.fn();
    const reply = await remove({ workspacePath: root, trashEntry }, ['.git::$INDEX_ALLOCATION', 'a.md:stream']);
    expect(reply.deleted).toEqual([]);
    expect(reply.failed.map((entry: { reason: string }) => entry.reason)).toEqual(['invalid-name', 'invalid-name']);
    expect(trashEntry).not.toHaveBeenCalled();
  });
});
