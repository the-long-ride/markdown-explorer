import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const {
  compareGitSources,
  detectGitCapability,
  listDocumentHistory,
  readGitRevision,
} = require('../../../electron/git/document-history.js');

const roots: string[] = [];

async function git(repo: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return stdout;
}

async function createTempGitRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'md-explorer-history-'));
  roots.push(root);
  await git(root, 'init');
  await git(root, 'config', 'user.name', 'Markdown Explorer Tests');
  await git(root, 'config', 'user.email', 'tests@example.invalid');
  return root;
}

async function commitFile(repo: string, relativePath: string, source: string, subject: string): Promise<string> {
  const filePath = path.join(repo, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source, 'utf8');
  await git(repo, 'add', '--', relativePath.split(path.sep).join('/'));
  await git(repo, 'commit', '-m', subject);
  return (await git(repo, 'rev-parse', 'HEAD')).trim();
}

async function renameAndCommit(repo: string, oldPath: string, newPath: string, subject: string): Promise<string> {
  await mkdir(path.dirname(path.join(repo, newPath)), { recursive: true });
  await git(repo, 'mv', '--', oldPath, newPath);
  await git(repo, 'commit', '-m', subject);
  return (await git(repo, 'rev-parse', 'HEAD')).trim();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Electron local Git document history', () => {
  it('detects a Git repository from a nested workspace path', async () => {
    const repo = await createTempGitRepo();
    const nested = path.join(repo, 'docs');
    await mkdir(nested, { recursive: true });

    await expect(detectGitCapability(nested)).resolves.toEqual({
      supported: true,
      repositoryRoot: repo,
    });
  });

  it('reports a normal non-repository without throwing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'md-explorer-no-repo-'));
    roots.push(root);

    await expect(detectGitCapability(root)).resolves.toEqual({
      supported: false,
      reason: 'not-repository',
    });
  });

  it('lists revisions newest first and preserves renamed historical paths', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'old.md', '# one\n', 'first');
    await renameAndCommit(repo, 'old.md', 'new.md', 'rename');

    const revisions = await listDocumentHistory({
      workspacePath: repo,
      filePath: path.join(repo, 'new.md'),
      limit: 20,
    });

    expect(revisions.map((item: { subject: string }) => item.subject)).toEqual(['rename', 'first']);
    expect(revisions.map((item: { path: string }) => item.path)).toEqual(['new.md', 'old.md']);
    expect(revisions.every((item: { oid: string }) => /^[0-9a-f]{40,64}$/i.test(item.oid))).toBe(true);
    expect(revisions[0].shortOid).toBe(revisions[0].oid.slice(0, 7));
    expect(revisions[0].author).toBe('Markdown Explorer Tests');
    expect(revisions[0].authoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reads a historical snapshot using the path stored for that revision', async () => {
    const repo = await createTempGitRepo();
    const firstOid = await commitFile(repo, 'old.md', '# one\n', 'first');
    await renameAndCommit(repo, 'old.md', 'new.md', 'rename');

    await expect(readGitRevision({
      workspacePath: repo,
      oid: firstOid,
      path: 'old.md',
    })).resolves.toEqual({
      oid: firstOid,
      path: 'old.md',
      source: '# one\n',
    });
  });

  it('compares revision-to-revision sources without mutating the repository', async () => {
    const repo = await createTempGitRepo();
    const firstOid = await commitFile(repo, 'a.md', '# one\n', 'first');
    const secondOid = await commitFile(repo, 'a.md', '# two\n', 'second');

    const comparison = await compareGitSources({
      workspacePath: repo,
      left: { kind: 'revision', oid: firstOid, path: 'a.md' },
      right: { kind: 'revision', oid: secondOid, path: 'a.md' },
    });

    expect(comparison.leftSource).toBe('# one\n');
    expect(comparison.rightSource).toBe('# two\n');
    expect(await readFile(path.join(repo, 'a.md'), 'utf8')).toBe('# two\n');
  });

  it('compares a revision to the current working-tree file', async () => {
    const repo = await createTempGitRepo();
    const oid = await commitFile(repo, 'a.md', '# committed\n', 'first');
    await writeFile(path.join(repo, 'a.md'), '# working tree\n', 'utf8');

    const comparison = await compareGitSources({
      workspacePath: repo,
      left: { kind: 'revision', oid, path: 'a.md' },
      right: { kind: 'current', path: path.join(repo, 'a.md') },
    });

    expect(comparison.leftSource).toBe('# committed\n');
    expect(comparison.rightSource).toBe('# working tree\n');
  });

  it('rejects invalid revision identifiers before invoking Git object lookup', async () => {
    const repo = await createTempGitRepo();

    await expect(readGitRevision({
      workspacePath: repo,
      oid: 'HEAD;rm -rf .',
      path: 'a.md',
    })).rejects.toThrow(/invalid revision/i);
  });

  it('rejects document paths outside the detected repository', async () => {
    const repo = await createTempGitRepo();
    const outside = path.join(path.dirname(repo), 'outside.md');
    await writeFile(outside, '# outside\n', 'utf8');
    try {
      await expect(listDocumentHistory({
        workspacePath: repo,
        filePath: outside,
        limit: 20,
      })).rejects.toThrow(/outside repository/i);
    } finally {
      await rm(outside, { force: true });
    }
  });

  it('rejects Git reads outside a subfolder workspace even when they are inside the repository', async () => {
    const repo = await createTempGitRepo();
    const docsOid = await commitFile(repo, 'docs/inside.md', '# inside\n', 'inside');
    const secretOid = await commitFile(repo, 'secret.md', '# secret\n', 'secret');
    const workspace = path.join(repo, 'docs');

    await expect(listDocumentHistory({
      workspacePath: workspace,
      filePath: path.join(repo, 'secret.md'),
      limit: 20,
    })).rejects.toThrow(/outside workspace/i);

    await expect(readGitRevision({
      workspacePath: workspace,
      oid: secretOid,
      path: 'secret.md',
    })).rejects.toThrow(/outside workspace/i);

    await expect(readGitRevision({
      workspacePath: workspace,
      oid: docsOid,
      path: 'docs/inside.md',
    })).resolves.toMatchObject({ source: '# inside\n' });
  });
});
