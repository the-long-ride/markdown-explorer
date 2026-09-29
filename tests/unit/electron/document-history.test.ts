import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const {
  compareGitSources,
  createGitHistoryMessageHandlers,
  listDocumentHistory,
  listRepositoryHistory,
  listRevisionFiles,
  clearGitContextCache,
  resolveGitContext,
  toGitHistoryError,
  GIT_TIMEOUT_MS,
  MAX_GIT_OUTPUT_BYTES,
  readGitRevision,
  readRevisionFile,
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

async function createRepositorySnapshotFixture() {
  const repo = await createTempGitRepo();
  const workspacePath = path.join(repo, 'workspace');
  const firstOid = await commitFile(repo, 'workspace/a.md', '# root\n', 'root document');
  await commitFile(repo, 'outside.md', '# outside\n', 'outside workspace');
  const baseBranch = (await git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).trim();

  await git(repo, 'checkout', '-b', 'snapshot-side');
  const sideOid = await commitFile(repo, 'workspace/side.md', '# side\n', 'side document');
  await git(repo, 'checkout', baseBranch);
  const mainOid = await commitFile(repo, 'workspace/main.md', '# main\n', 'main document');
  await git(repo, 'merge', '--no-ff', 'snapshot-side', '-m', 'merge side branch');
  const mergeOid = (await git(repo, 'rev-parse', 'HEAD')).trim();

  return { repo, workspacePath, firstOid, sideOid, mainOid, mergeOid };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Electron local Git document history', () => {
  it('resolves a Git repository from a nested workspace path', async () => {
    const repo = await createTempGitRepo();
    const nested = path.join(repo, 'docs');
    await mkdir(nested, { recursive: true });

    await expect(resolveGitContext(nested)).resolves.toMatchObject({ repositoryRoot: repo });
  });

  it('rejects a folder outside any Git repository', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'md-explorer-no-repo-'));
    roots.push(root);

    await expect(resolveGitContext(root)).rejects.toThrow();
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

  it('lists repository commits with merge parents, refs, and exact HEAD state', async () => {
    const fixture = await createRepositorySnapshotFixture();
    const commits = await listRepositoryHistory({ workspacePath: fixture.workspacePath, limit: 50 });
    const head = commits.find((item: { isHead: boolean }) => item.isHead);

    expect(head?.oid).toBe(fixture.mergeOid);
    expect(head?.parentOids).toHaveLength(2);
    expect(head?.shortOid).toBe(fixture.mergeOid.slice(0, 7));
    expect(head?.subject).toBe('merge side branch');
    expect(commits.some((item: { refs: string[] }) => item.refs.some((ref) => ref.includes('snapshot-side')))).toBe(true);
  });

  it('lists only files inside the workspace for a selected revision', async () => {
    const fixture = await createRepositorySnapshotFixture();
    const files = await listRevisionFiles({ workspacePath: fixture.workspacePath, oid: fixture.mergeOid });

    expect(files).toEqual([
      { path: 'a.md' },
      { path: 'main.md' },
      { path: 'side.md' },
    ]);
    expect(files.some((item: { path: string }) => item.path.includes('outside.md'))).toBe(false);
  });

  it('reads workspace-relative historical files without changing the working tree', async () => {
    const fixture = await createRepositorySnapshotFixture();
    const statusBefore = await git(fixture.repo, 'status', '--porcelain');
    const sourceBefore = await readFile(path.join(fixture.workspacePath, 'a.md'), 'utf8');

    await expect(readRevisionFile({
      workspacePath: fixture.workspacePath,
      oid: fixture.mergeOid,
      path: 'a.md',
    })).resolves.toEqual({
      oid: fixture.mergeOid,
      path: 'a.md',
      source: '# root\n',
    });

    await expect(readRevisionFile({
      workspacePath: fixture.workspacePath,
      oid: fixture.mergeOid,
      path: '../outside.md',
    })).rejects.toThrow(/outside workspace/i);
    await expect(readRevisionFile({
      workspacePath: fixture.workspacePath,
      oid: 'HEAD;rm -rf .',
      path: 'a.md',
    })).rejects.toThrow(/invalid revision/i);

    expect(await git(fixture.repo, 'status', '--porcelain')).toBe(statusBefore);
    expect(await readFile(path.join(fixture.workspacePath, 'a.md'), 'utf8')).toBe(sourceBefore);
  });

  it('emits repository snapshot protocol result messages from handlers', async () => {
    const fixture = await createRepositorySnapshotFixture();
    const sent: any[] = [];
    const handlers = createGitHistoryMessageHandlers({
      getWorkspacePath: () => fixture.workspacePath,
      sendHostMessage: (message: any) => sent.push(message),
    });

    await handlers.handleListRepositoryHistory({ requestId: 'history-1', limit: 20 });
    expect(sent[0]).toMatchObject({ command: 'repositoryHistoryResult', requestId: 'history-1', ok: true });

    await handlers.handleListRevisionFiles({ requestId: 'files-1', oid: fixture.mergeOid });
    expect(sent[1]).toMatchObject({ command: 'revisionFilesResult', requestId: 'files-1', ok: true });

    await handlers.handleReadRevisionFile({ requestId: 'file-1', oid: fixture.mergeOid, path: 'a.md' });
    expect(sent[2]).toMatchObject({ command: 'revisionFileResult', requestId: 'file-1', ok: true, snapshot: { path: 'a.md' } });
  });
});

describe('Electron repository history paging', () => {
  async function commitMany(repo: string, count: number, env: Record<string, string> = {}): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      const filePath = path.join(repo, `file-${index}.md`);
      await writeFile(filePath, `# ${index}\n`, 'utf8');
      await git(repo, 'add', '--', `file-${index}.md`);
      await execFileAsync('git', ['-C', repo, 'commit', '-m', `commit ${index}`], {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, ...env },
      });
    }
  }

  async function pageAll(workspacePath: string, limit: number, allRefs = false): Promise<string[]> {
    const oids: string[] = [];
    let before: string | undefined;
    for (let guard = 0; guard < 40; guard += 1) {
      const page = await listRepositoryHistory({ workspacePath, limit, before, offset: oids.length, allRefs });
      if (page.length === 0) break;
      oids.push(...page.map((commit: { oid: string }) => commit.oid));
      if (page.length < limit) break;
      before = page[page.length - 1].oid;
    }
    return oids;
  }

  it('pages with a before cursor without gaps or duplicates', async () => {
    const repo = await createTempGitRepo();
    await commitMany(repo, 7);
    const expected = (await git(repo, 'log', '--format=%H')).trim().split(/\r?\n/);
    const oids = await pageAll(repo, 3);
    expect(oids).toEqual(expected);
  });

  it('pages commits that share the same committer second exactly once', async () => {
    const repo = await createTempGitRepo();
    const date = '2026-01-01T00:00:00Z';
    await commitMany(repo, 5, { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date });
    const oids = await pageAll(repo, 2);
    expect(oids).toHaveLength(5);
    expect(new Set(oids).size).toBe(5);
  });

  it('falls back to offset paging when more same-second commits than the overlap precede the cursor', async () => {
    const repo = await createTempGitRepo();
    const date = '2026-01-01T00:00:00Z';
    await commitMany(repo, 30, { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date });
    const expected = (await git(repo, 'log', '--format=%H')).trim().split(/\r?\n/);
    const oids = await pageAll(repo, 3);
    expect(oids).toEqual(expected);
  }, 60000);

  it('lists HEAD history by default and every branch with allRefs', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'a.md', '# a\n', 'base');
    const baseBranch = (await git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).trim();
    await git(repo, 'checkout', '-b', 'side');
    const sideOid = await commitFile(repo, 'side.md', '# side\n', 'side only');
    await git(repo, 'checkout', baseBranch);

    const headOnly = await listRepositoryHistory({ workspacePath: repo, limit: 50 });
    const all = await listRepositoryHistory({ workspacePath: repo, limit: 50, allRefs: true });
    expect(headOnly.map((commit: { oid: string }) => commit.oid)).not.toContain(sideOid);
    expect(all.map((commit: { oid: string }) => commit.oid)).toContain(sideOid);
  });

  it('caches the resolved repository context per workspace until cleared', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'a.md', '# a\n', 'base');
    const first = resolveGitContext(repo);
    expect(resolveGitContext(repo)).toBe(first);
    await first;
    clearGitContextCache();
    const second = resolveGitContext(repo);
    expect(second).not.toBe(first);
    await second;
  });

  it('maps a git process killed by the timeout to git-timeout', () => {
    expect(GIT_TIMEOUT_MS).toBe(20000);
    const error = toGitHistoryError({ killed: true, signal: 'SIGTERM', message: 'Command failed' });
    expect(error.reason).toBe('git-timeout');
  });
});

describe('Electron Git history hardening', () => {
  it('reports non-ASCII paths unquoted in document history and follows renames', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'blåbær.md', '# one\n', 'first');
    await renameAndCommit(repo, 'blåbær.md', 'røde bær.md', 'rename');

    const revisions = await listDocumentHistory({
      workspacePath: repo,
      filePath: path.join(repo, 'røde bær.md'),
      limit: 20,
    });

    expect(revisions.map((item: { subject: string }) => item.subject)).toEqual(['rename', 'first']);
    expect(revisions.map((item: { path: string }) => item.path)).toEqual(['røde bær.md', 'blåbær.md']);
    await expect(readGitRevision({
      workspacePath: repo,
      oid: revisions[1].oid,
      path: revisions[1].path,
    })).resolves.toMatchObject({ source: '# one\n' });
  });

  it('lists non-ASCII and space-containing revision files without escaping', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'blåbær.md', '# a\n', 'first');
    const oid = await commitFile(repo, 'notater/ø ved.md', '# b\n', 'second');

    const files = await listRevisionFiles({ workspacePath: repo, oid });
    expect(files).toEqual([{ path: 'blåbær.md' }, { path: 'notater/ø ved.md' }]);
  });

  it('lists only document files for a revision', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'a.md', '# a\n', 'md');
    await commitFile(repo, 'docs/B.MDX', '# b\n', 'mdx');
    await commitFile(repo, 'notes.txt', 'n\n', 'txt');
    await commitFile(repo, 'src/app.ts', 'export {}\n', 'code');
    await commitFile(repo, 'logo.png', 'not-a-png', 'binary');
    const oid = (await git(repo, 'rev-parse', 'HEAD')).trim();

    const files = await listRevisionFiles({ workspacePath: repo, oid });
    expect(files.map((item: { path: string }) => item.path).sort()).toEqual(['a.md', 'docs/B.MDX', 'notes.txt']);
  });

  it('returns an empty page when the before cursor is not in the listed history', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'a.md', '# a\n', 'base');
    const baseBranch = (await git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).trim();
    await git(repo, 'checkout', '-b', 'side');
    const sideOid = await commitFile(repo, 'side.md', '# side\n', 'side only');
    await git(repo, 'checkout', baseBranch);
    await commitFile(repo, 'b.md', '# b\n', 'main only');

    await expect(listRepositoryHistory({ workspacePath: repo, limit: 5, before: sideOid })).resolves.toEqual([]);
    const explicit = await listRepositoryHistory({ workspacePath: repo, limit: 5, before: sideOid, offset: 1 });
    expect(explicit).toHaveLength(1);
    expect(explicit[0].subject).toBe('base');
  });

  it('never lets the renderer choose the repository directory', async () => {
    const repoA = await createTempGitRepo();
    const repoB = await createTempGitRepo();
    await commitFile(repoA, 'a.md', '# a\n', 'in repo A');
    await commitFile(repoB, 'b.md', '# b\n', 'in repo B');
    const sent: any[] = [];
    const handlers = createGitHistoryMessageHandlers({
      getWorkspacePath: () => repoA,
      sendHostMessage: (message: any) => sent.push(message),
    });

    await handlers.handleListRepositoryHistory({ requestId: 'r1', limit: 5, workspacePath: repoB });
    expect(sent[0].commits.map((item: { subject: string }) => item.subject)).toEqual(['in repo A']);
  });

  it('rejects a current-side comparison path that resolves outside the workspace', async () => {
    const repo = await createTempGitRepo();
    const workspace = path.join(repo, 'workspace');
    await commitFile(repo, 'workspace/a.md', '# a\n', 'base');
    const outside = await mkdtemp(path.join(tmpdir(), 'md-explorer-history-outside-'));
    roots.push(outside);
    await writeFile(path.join(outside, 'secret.md'), '# secret\n', 'utf8');
    await symlink(outside, path.join(workspace, 'linked'), 'junction');

    await expect(compareGitSources({
      workspacePath: workspace,
      left: { kind: 'current', path: path.join(workspace, 'linked', 'secret.md') },
      right: { kind: 'current', path: path.join(workspace, 'a.md') },
    })).rejects.toMatchObject({ reason: 'outside-workspace' });
  });

  it('caps the size of the current-side file read for comparisons', async () => {
    const repo = await createTempGitRepo();
    await commitFile(repo, 'a.md', '# a\n', 'base');
    await writeFile(path.join(repo, 'big.md'), Buffer.alloc(MAX_GIT_OUTPUT_BYTES + 1, 0x61));

    await expect(compareGitSources({
      workspacePath: repo,
      left: { kind: 'current', path: 'big.md' },
      right: { kind: 'current', path: 'a.md' },
    })).rejects.toMatchObject({ reason: 'output-too-large' });
  });
});
