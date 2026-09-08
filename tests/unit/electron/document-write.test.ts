import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

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

  it('rejects a symlink inside the workspace that resolves outside it', async () => {
    const { root } = await createWorkspace();
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'md-explorer-write-outside-'));
    roots.push(outsideRoot);
    const outsideFile = path.join(outsideRoot, 'outside.md');
    const link = path.join(root, 'linked.md');
    await writeFile(outsideFile, '# Outside', 'utf8');
    await symlink(outsideFile, link, 'file');

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
});
