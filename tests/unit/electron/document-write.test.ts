import fs from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  revisionFor,
  saveWorkspaceDocument,
} = require('../../../electron/workspace/document-write.js');

const roots: string[] = [];

async function createWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'md-explorer-write-'));
  roots.push(root);
  const file = path.join(root, 'a.md');
  await writeFile(file, '# A', 'utf8');
  return { root, file };
}

/** Creating file symlinks needs a privilege on Windows; report false so the test can skip. */
async function trySymlink(target: string, link: string): Promise<boolean> {
  try {
    await symlink(target, link, 'file');
    return true;
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

function failingRenameFs(makeError: () => Error, failures = Infinity) {
  const rename = vi.fn(async (from: string, to: string) => {
    if (rename.mock.calls.length <= failures) throw makeError();
    return fs.promises.rename(from, to);
  });
  const writeFileSpy = vi.fn((...args: Parameters<typeof fs.promises.writeFile>) => fs.promises.writeFile(...args));
  return { fsApi: { ...fs, promises: { ...fs.promises, rename, writeFile: writeFileSpy } }, rename, writeFileSpy };
}

function errorWithCode(code: string) {
  return () => Object.assign(new Error(code), { code });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Electron Markdown document writes', () => {
  it('writes a Markdown file and returns its new revision', async () => {
    const { root, file } = await createWorkspace();
    const expectedRevision = await revisionFor(file);

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# B',
      expectedRevision,
    });

    expect(result.ok).toBe(true);
    expect(result.revision).toBe(await revisionFor(file));
    expect(await readFile(file, 'utf8')).toBe('# B');
  });

  it('rejects a write outside the active workspace', async () => {
    const { root } = await createWorkspace();
    const outside = path.join(path.dirname(root), 'escape.md');

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: outside,
      source: '# nope',
      expectedRevision: null,
    });

    expect(result).toMatchObject({ ok: false, reason: 'outside-workspace' });
  });

  it('rejects a symlink inside the workspace that resolves outside it', async (ctx) => {
    const { root } = await createWorkspace();
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'md-explorer-write-outside-'));
    roots.push(outsideRoot);
    const outsideFile = path.join(outsideRoot, 'outside.md');
    const link = path.join(root, 'linked.md');
    await writeFile(outsideFile, '# Outside', 'utf8');
    if (!(await trySymlink(outsideFile, link))) return ctx.skip(); // no symlink privilege on this Windows account

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: link,
      source: '# Escaped',
      expectedRevision: await revisionFor(link),
    });

    expect(result).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await readFile(outsideFile, 'utf8')).toBe('# Outside');
  });

  it('reports a missing target without creating it', async () => {
    const { root } = await createWorkspace();
    const missing = path.join(root, 'missing.md');

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: missing,
      source: '# new',
      expectedRevision: null,
    });

    expect(result).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('returns conflict data without overwriting when the revision changed', async () => {
    const { root, file } = await createWorkspace();
    const before = await revisionFor(file);
    await writeFile(file, '# External change', 'utf8');

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Mine',
      expectedRevision: before,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'conflict',
      diskSource: '# External change',
    });
    expect(result.diskRevision).toBe(await revisionFor(file));
    expect(await readFile(file, 'utf8')).toBe('# External change');
  });

  it('allows an explicit force save after a conflict', async () => {
    const { root, file } = await createWorkspace();
    const before = await revisionFor(file);
    await writeFile(file, '# External change', 'utf8');

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Mine',
      expectedRevision: before,
      force: true,
    });

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('# Mine');
  });

  it('rejects files that are not Markdown documents', async () => {
    const { root } = await createWorkspace();
    const script = path.join(root, 'run.sh');
    const config = path.join(root, 'package.json');
    await writeFile(script, 'echo safe', 'utf8');
    await writeFile(config, '{}', 'utf8');

    for (const target of [script, config]) {
      const result = await saveWorkspaceDocument({
        workspacePath: root,
        filePath: target,
        source: 'echo pwned',
        expectedRevision: await revisionFor(target),
      });
      expect(result).toMatchObject({ ok: false, reason: 'read-only' });
    }
    expect(await readFile(script, 'utf8')).toBe('echo safe');
    expect(await readFile(config, 'utf8')).toBe('{}');
  });

  it('accepts .md and .mdx documents case-insensitively', async () => {
    const { root } = await createWorkspace();
    for (const name of ['B.MDX', 'c.Md', 'd.mdx']) {
      const target = path.join(root, name);
      await writeFile(target, '# old', 'utf8');
      const result = await saveWorkspaceDocument({
        workspacePath: root,
        filePath: target,
        source: '# new',
        expectedRevision: await revisionFor(target),
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects Markdown paths that live inside a .git directory', async () => {
    const { root } = await createWorkspace();
    const targets: string[] = [];
    for (const dir of ['.git', '.GIT', path.join('sub', '.Git', 'info')]) {
      await mkdir(path.join(root, dir), { recursive: true });
      const target = path.join(root, dir, 'note.md');
      await writeFile(target, '# git internal', 'utf8');
      targets.push(target);
    }

    for (const target of targets) {
      const result = await saveWorkspaceDocument({
        workspacePath: root,
        filePath: target,
        source: '# tampered',
        expectedRevision: await revisionFor(target),
      });
      expect(result).toMatchObject({ ok: false, reason: 'read-only' });
      expect(await readFile(target, 'utf8')).toBe('# git internal');
    }
  });

  it('rejects a Markdown-named symlink whose real target is not Markdown or is inside .git', async (ctx) => {
    const { root } = await createWorkspace();
    await mkdir(path.join(root, '.git'));
    const gitConfig = path.join(root, '.git', 'config');
    const plain = path.join(root, 'plain.txt');
    await writeFile(gitConfig, '[core]', 'utf8');
    await writeFile(plain, 'plain', 'utf8');
    const gitLink = path.join(root, 'looks-safe.md');
    const plainLink = path.join(root, 'also-safe.md');
    if (!(await trySymlink(gitConfig, gitLink))) return ctx.skip(); // no symlink privilege on this Windows account
    expect(await trySymlink(plain, plainLink)).toBe(true);

    for (const link of [gitLink, plainLink]) {
      const result = await saveWorkspaceDocument({
        workspacePath: root,
        filePath: link,
        source: 'overwritten',
        expectedRevision: await revisionFor(link),
      });
      expect(result).toMatchObject({ ok: false, reason: 'read-only' });
    }
    expect(await readFile(gitConfig, 'utf8')).toBe('[core]');
    expect(await readFile(plain, 'utf8')).toBe('plain');
  });

  it('rejects a directory link that leads into .git even though the lexical path looks safe', async () => {
    const { root } = await createWorkspace();
    await mkdir(path.join(root, '.git'));
    const internal = path.join(root, '.git', 'note.md');
    await writeFile(internal, '# git internal', 'utf8');
    const viaLink = path.join(root, 'notes', 'note.md');
    await symlink(path.join(root, '.git'), path.join(root, 'notes'), 'junction');

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: viaLink,
      source: '# tampered',
      expectedRevision: await revisionFor(viaLink),
    });

    expect(result).toMatchObject({ ok: false, reason: 'read-only' });
    expect(await readFile(internal, 'utf8')).toBe('# git internal');
  });

  it('treats a null expected revision on an existing file as a conflict', async () => {
    const { root, file } = await createWorkspace();

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Blind overwrite',
      expectedRevision: null,
    });

    expect(result).toMatchObject({ ok: false, reason: 'conflict', diskSource: '# A' });
    expect(result.diskRevision).toBe(await revisionFor(file));
    expect(await readFile(file, 'utf8')).toBe('# A');
  });

  it('overwrites with a null expected revision only when force is explicit', async () => {
    const { root, file } = await createWorkspace();

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Forced',
      expectedRevision: null,
      force: true,
    });

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('# Forced');
  });

  it('writes through a temp file in the target directory and leaves no temp files behind', async () => {
    const { root, file } = await createWorkspace();
    const { fsApi, rename } = failingRenameFs(errorWithCode('NEVER'), 0);

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Atomic',
      expectedRevision: await revisionFor(file),
      fsApi,
    });

    expect(result.ok).toBe(true);
    expect(rename).toHaveBeenCalledTimes(1);
    const [from, to] = rename.mock.calls[0];
    expect(path.dirname(from)).toBe(path.dirname(to));
    expect(from).not.toBe(to);
    expect(await readFile(file, 'utf8')).toBe('# Atomic');
    expect(await readdir(root)).toEqual(['a.md']);
  });

  it('preserves the original file mode', async (ctx) => {
    if (process.platform === 'win32') return ctx.skip(); // POSIX permission bits only
    const { root, file } = await createWorkspace();
    await chmod(file, 0o640);

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Mode',
      expectedRevision: await revisionFor(file),
    });

    expect(result.ok).toBe(true);
    expect((await stat(file)).mode & 0o777).toBe(0o640);
  });

  it('writes to the real target of an in-workspace symlink instead of replacing the link', async (ctx) => {
    const { root, file } = await createWorkspace();
    const link = path.join(root, 'link.md');
    if (!(await trySymlink(file, link))) return ctx.skip(); // no symlink privilege on this Windows account

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: link,
      source: '# Via link',
      expectedRevision: await revisionFor(link),
    });

    expect(result.ok).toBe(true);
    expect((await fs.promises.lstat(link)).isSymbolicLink()).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('# Via link');
  });

  it('cleans up the temp file and keeps the original when the rename fails', async () => {
    const { root, file } = await createWorkspace();
    const { fsApi, rename, writeFileSpy } = failingRenameFs(errorWithCode('EACCES'));

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Lost',
      expectedRevision: await revisionFor(file),
      fsApi,
      platform: 'linux',
    });

    expect(result).toMatchObject({ ok: false, reason: 'write-failed' });
    expect(rename).toHaveBeenCalledTimes(1);
    expect(writeFileSpy).not.toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe('# A');
    expect(await readdir(root)).toEqual(['a.md']);
  });

  it('retries a transient EBUSY rename on Windows before succeeding', async () => {
    const { root, file } = await createWorkspace();
    const { fsApi, rename, writeFileSpy } = failingRenameFs(errorWithCode('EBUSY'), 2);

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Retried',
      expectedRevision: await revisionFor(file),
      fsApi,
      platform: 'win32',
      renameRetryDelaysMs: [0, 0, 0, 0],
    });

    expect(result.ok).toBe(true);
    expect(rename).toHaveBeenCalledTimes(3);
    expect(writeFileSpy).not.toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe('# Retried');
    expect(await readdir(root)).toEqual(['a.md']);
  });

  it('falls back to a direct write on Windows only when the rename keeps failing', async () => {
    const { root, file } = await createWorkspace();
    const { fsApi, rename, writeFileSpy } = failingRenameFs(errorWithCode('EPERM'));

    const result = await saveWorkspaceDocument({
      workspacePath: root,
      filePath: file,
      source: '# Direct',
      expectedRevision: await revisionFor(file),
      fsApi,
      platform: 'win32',
      renameRetryDelaysMs: [0, 0],
    });

    expect(result.ok).toBe(true);
    expect(rename).toHaveBeenCalledTimes(3);
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(await readFile(file, 'utf8')).toBe('# Direct');
    expect(await readdir(root)).toEqual(['a.md']);
  });
});
