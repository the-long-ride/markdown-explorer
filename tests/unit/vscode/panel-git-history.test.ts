import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import {
  createPanelGitHistoryAdapter,
  parsePanelGitHistory,
  parsePanelRepositoryHistory,
} from '../../../vscode/src/core/panelGitHistory';
import { tmpdir } from 'node:os';

// Keep adapters off the real disk: identity realpath and a small regular-file stat.
const hermetic = {
  realpathImpl: async (value: string) => value,
  statImpl: async () => ({ size: 10, isFile: () => true }),
};

// Every Git call must disable path quoting so non-ASCII paths arrive verbatim.
const QP = ['-c', 'core.quotePath=false'];

function makeExec(outputs: string[]) {
  return vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void) => {
    callback(null, outputs.shift() ?? '', '');
  });
}

describe('VS Code panel Git history adapter', () => {
  it('runs Git with argument arrays from the workspace folder', async () => {
    const execFileImpl = makeExec(['/workspace\n', '']);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listDocumentHistory({ workspacePath: '/workspace/docs', filePath: '/workspace/docs/a.md' })).resolves.toEqual([]);
    expect(execFileImpl).toHaveBeenCalledWith(
      'git',
      [...QP, 'rev-parse', '--show-toplevel'],
      expect.objectContaining({ cwd: path.resolve('/workspace/docs'), windowsHide: true }),
      expect.any(Function),
    );
  });

  it('accepts a workspace opened through a junction or symlink', async () => {
    const execFileImpl = makeExec(['/workspace\n', '']);
    const realpathImpl = async (value: string) => value.replace(path.resolve('/linked'), path.resolve('/workspace'));
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl, realpathImpl });

    await expect(adapter.listDocumentHistory({ workspacePath: '/linked/docs', filePath: '/workspace/docs/a.md' })).resolves.toEqual([]);
  });

  it('reports a missing Git as git-unavailable', async () => {
    const execFileImpl = vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: (error: NodeJS.ErrnoException | null) => void) => {
      callback(Object.assign(new Error('Git not found'), { code: 'ENOENT' }));
    });
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: tmpdir() })).rejects.toMatchObject({ reason: 'git-unavailable' });
  });

  it('parses rename-aware history and validates full object IDs', () => {
    const firstOid = '1'.repeat(40);
    const secondOid = '2'.repeat(40);
    expect(parsePanelGitHistory(
      `\x1e${secondOid}\x1fDev\x1f2026-09-14T00:00:00Z\x1frename\0\nR100\0old.md\0new.md\0\x1e${firstOid}\x1fDev\x1f2026-09-13T00:00:00Z\x1ffirst\0\nA\0old.md\0`,
      'new.md',
    )).toEqual([
      expect.objectContaining({ oid: secondOid, shortOid: secondOid.slice(0, 7), path: 'new.md' }),
      expect.objectContaining({ oid: firstOid, shortOid: firstOid.slice(0, 7), path: 'old.md' }),
    ]);
  });

  it('reads current comparison sources through the injected file reader', async () => {
    const oid = '3'.repeat(40);
    const execFileImpl = makeExec(['/workspace\n', '# revision\n']);
    const readFileImpl = vi.fn().mockResolvedValue('# current\n');
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl, readFileImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'revision', oid, path: 'a.md' },
      right: { kind: 'current', path: '/workspace/a.md' },
    })).resolves.toEqual({
      leftSource: '# revision\n',
      rightSource: '# current\n',
      leftLabel: `${oid.slice(0, 7)}:a.md`,
      rightLabel: 'Current:a.md',
    });
    expect(readFileImpl).toHaveBeenCalledWith(path.resolve('/workspace/a.md'), 'utf8');
  });

  it('pages repository history after a before cursor and lists HEAD only by default', async () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((char) => char.repeat(40));
    const record = (oid: string) => `\x1e${oid}\x1f\x1fDev\x1f2026-09-14T00:00:00Z\x1fsubject ${oid[0]}\x1f\n`;
    const execFileImpl = makeExec(['/workspace\n', `${a}\n`, '1790000000\n', [a, b, c, d].map(record).join('')]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    const commits = await adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 2, before: b });

    expect(commits.map((commit) => commit.oid)).toEqual([c, d]);
    expect(execFileImpl.mock.calls[2][1]).toEqual([...QP, 'show', '-s', '--format=%ct', b]);
    expect(execFileImpl.mock.calls[3][1]).toEqual([...QP, 'log', 'HEAD', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '--until=1790000000', '-n', '22']);
  });

  it('falls back to offset paging when the cursor is missing from a full overlap window', async () => {
    const record = (oid: string) => `\x1e${oid}\x1f\x1fDev\x1f2026-09-14T00:00:00Z\x1fsubject\x1f\n`;
    const window = Array.from({ length: 22 }, (_, index) => (index + 16).toString(16).repeat(20).slice(0, 40));
    const cursor = 'f'.repeat(40);
    const next = ['e'.repeat(40), 'd'.repeat(40)];
    const execFileImpl = makeExec(['/workspace\n', `${window[0]}\n`, '1790000000\n', window.map(record).join(''), '/workspace\n', `${window[0]}\n`, next.map(record).join('')]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    const commits = await adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 2, before: cursor, offset: 30 });

    expect(commits.map((commit) => commit.oid)).toEqual(next);
    expect(execFileImpl.mock.calls[6][1]).toEqual([...QP, 'log', 'HEAD', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '--skip=30', '-n', '2']);
  });

  it('lists every ref when allRefs is requested', async () => {
    const execFileImpl = makeExec(['/workspace\n', `${'a'.repeat(40)}\n`, '']);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 50, allRefs: true });

    expect(execFileImpl.mock.calls[2][1]).toEqual([...QP, 'log', '--all', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '--skip=0', '-n', '50']);
  });

  it('parses repository history with parents, refs, and HEAD detection', () => {
    const mergeOid = 'a'.repeat(40);
    const leftParent = 'b'.repeat(40);
    const rightParent = 'c'.repeat(40);
    const commits = parsePanelRepositoryHistory(
      `\x1e${mergeOid}\x1f${leftParent} ${rightParent}\x1fDev\x1f2026-09-13T00:00:00Z\x1fmerge branch\x1fHEAD -> main, tag: v2\n`,
      mergeOid,
    );

    expect(commits).toEqual([{
      oid: mergeOid,
      shortOid: mergeOid.slice(0, 7),
      parentOids: [leftParent, rightParent],
      author: 'Dev',
      authoredAt: '2026-09-13T00:00:00Z',
      subject: 'merge branch',
      refs: ['HEAD -> main', 'tag: v2'],
      isHead: true,
    }]);
  });

  it('uses exact Git argument arrays for repository history pagination', async () => {
    const headOid = '1'.repeat(40);
    const execFileImpl = makeExec([
      '/workspace\n',
      `${headOid}\n`,
      `\x1e${headOid}\x1f\x1fDev\x1f2026-09-13T00:00:00Z\x1finitial\x1fHEAD -> main\n`,
    ]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 50, offset: 100 })).resolves.toHaveLength(1);
    expect(execFileImpl.mock.calls[1]?.[1]).toEqual([...QP, 'rev-parse', 'HEAD']);
    expect(execFileImpl.mock.calls[2]?.[1]).toEqual([
      ...QP, 'log', 'HEAD', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '--skip=100', '-n', '50',
    ]);
  });

  it('scopes revision tree listing and reads to the workspace prefix', async () => {
    const oid = '2'.repeat(40);
    const listExec = makeExec([
      '/workspace\n',
      'docs/a.md\0docs/sub/b.md\0docs/notes.txt\0docs/UP.MDX\0docs/img.png\0',
    ]);
    const listAdapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl: listExec });

    await expect(listAdapter.listRevisionFiles({ workspacePath: '/workspace/docs', oid })).resolves.toEqual([
      { path: 'a.md' },
      { path: 'sub/b.md' },
      { path: 'notes.txt' },
      { path: 'UP.MDX' },
    ]);
    expect(listExec.mock.calls[1]?.[1]).toEqual([...QP, 'ls-tree', '-r', '-z', '--name-only', oid, '--', 'docs']);

    const readExec = makeExec([
      '/workspace\n',
      '# snapshot\n',
    ]);
    const readAdapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl: readExec });
    await expect(readAdapter.readRevisionFile({ workspacePath: '/workspace/docs', oid, path: 'a.md' })).resolves.toEqual({
      oid,
      path: 'a.md',
      source: '# snapshot\n',
    });
    expect(readExec.mock.calls[1]?.[1]).toEqual([...QP, 'show', `${oid}:docs/a.md`]);
  });
  it('logs document history with -z and keeps non-ASCII and space-padded paths verbatim', async () => {
    const oid = '4'.repeat(40);
    const execFileImpl = makeExec([
      '/workspace\n',
      `\x1e${oid}\x1fDev\x1f2026-09-14T00:00:00Z\x1frename\0\nR100\0 dokumenter/gammel æøå.md\0 dokumenter/ny æøå.md\0`,
    ]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    const revisions = await adapter.listDocumentHistory({ workspacePath: '/workspace', filePath: '/workspace/ dokumenter/ny æøå.md', limit: 5 });

    expect(execFileImpl.mock.calls[1][1]).toEqual([
      ...QP, 'log', '--follow', '-z', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--name-status', '-M', '-n', '5', '--', ' dokumenter/ny æøå.md',
    ]);
    expect(revisions).toEqual([expect.objectContaining({ oid, path: ' dokumenter/ny æøå.md', subject: 'rename' })]);
  });

  it('follows a rename only when the -z record names the tracked path', () => {
    const newer = '5'.repeat(40);
    const older = '6'.repeat(40);
    const output = `\x1e${newer}\x1fDev\x1f2026-09-14T00:00:00Z\x1fmove\0\nR087\0old æ.md\0new æ.md\0\x1e${older}\x1fDev\x1f2026-09-13T00:00:00Z\x1fadd\0\nA\0old æ.md\0`;

    expect(parsePanelGitHistory(output, 'new æ.md').map((revision) => revision.path)).toEqual(['new æ.md', 'old æ.md']);
    expect(parsePanelGitHistory(output, 'other.md').map((revision) => revision.path)).toEqual(['other.md', 'other.md']);
  });

  it('parses NUL-separated ls-tree output without trimming paths', async () => {
    const oid = '7'.repeat(40);
    const execFileImpl = makeExec(['/workspace\n', 'ÆØÅ notat.md\0 padded.md\0new\nline.md\0']);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRevisionFiles({ workspacePath: '/workspace', oid })).resolves.toEqual([
      { path: 'ÆØÅ notat.md' },
      { path: ' padded.md' },
      { path: 'new\nline.md' },
    ]);
  });

  it('returns an empty page when the before cursor is not found and no offset is given', async () => {
    const record = (oid: string) => `\x1e${oid}\x1f\x1fDev\x1f2026-09-14T00:00:00Z\x1fsubject\x1f\n`;
    const head = 'a'.repeat(40);
    const execFileImpl = makeExec(['/workspace\n', `${head}\n`, '1790000000\n', [head, 'b'.repeat(40)].map(record).join('')]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 2, before: 'f'.repeat(40) })).resolves.toEqual([]);
    expect(execFileImpl).toHaveBeenCalledTimes(4);
  });

  it('does not restart at page one when a full overlap window lacks the cursor and no offset is given', async () => {
    const record = (oid: string) => `\x1e${oid}\x1f\x1fDev\x1f2026-09-14T00:00:00Z\x1fsubject\x1f\n`;
    const window = Array.from({ length: 22 }, (_, index) => (index + 16).toString(16).repeat(20).slice(0, 40));
    const execFileImpl = makeExec(['/workspace\n', `${window[0]}\n`, '1790000000\n', window.map(record).join('')]);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 2, before: 'f'.repeat(40) })).resolves.toEqual([]);
    expect(execFileImpl).toHaveBeenCalledTimes(4);
  });

  it('maps a maxBuffer overflow to output-too-large and keeps the 20s timeout and buffer cap', async () => {
    const execFileImpl = vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: (error: NodeJS.ErrnoException | null) => void) => {
      callback(Object.assign(new Error('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true }));
    });
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace' })).rejects.toMatchObject({ reason: 'output-too-large' });
    expect(execFileImpl.mock.calls[0][2]).toMatchObject({ timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
  });

  it('still maps a killed process without a buffer overflow to git-timeout', async () => {
    const execFileImpl = vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: (error: NodeJS.ErrnoException | null) => void) => {
      callback(Object.assign(new Error('timed out'), { killed: true }));
    });
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace' })).rejects.toMatchObject({ reason: 'git-timeout' });
  });

  it('rejects a current-side file whose real path escapes the workspace', async () => {
    const execFileImpl = makeExec(['/workspace\n']);
    const readFileImpl = vi.fn().mockResolvedValue('# secret\n');
    const realpathImpl = async (value: string) => (value === path.resolve('/workspace/link.md') ? path.resolve('/outside/secret.md') : value);
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl, readFileImpl, realpathImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'current', path: '/workspace/link.md' },
      right: { kind: 'current', path: '/workspace/link.md' },
    })).rejects.toMatchObject({ reason: 'outside-workspace' });
    expect(readFileImpl).not.toHaveBeenCalled();
  });

  it('rejects an oversized current-side file before reading it', async () => {
    const execFileImpl = makeExec(['/workspace\n']);
    const readFileImpl = vi.fn().mockResolvedValue('# big\n');
    const statImpl = async () => ({ size: 16 * 1024 * 1024 + 1, isFile: () => true });
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl, readFileImpl, statImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'current', path: '/workspace/a.md' },
      right: { kind: 'current', path: '/workspace/a.md' },
    })).rejects.toMatchObject({ reason: 'output-too-large' });
    expect(readFileImpl).not.toHaveBeenCalled();
  });

  it('reports a missing current-side file', async () => {
    const execFileImpl = makeExec(['/workspace\n']);
    const statImpl = async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); };
    const adapter = createPanelGitHistoryAdapter({ ...hermetic, execFileImpl, statImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'current', path: '/workspace/a.md' },
      right: { kind: 'current', path: '/workspace/a.md' },
    })).rejects.toMatchObject({ reason: 'missing' });
  });
});
