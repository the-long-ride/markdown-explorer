import { describe, expect, it, vi } from 'vitest';
import {
  createPanelGitHistoryAdapter,
  parsePanelGitHistory,
  parsePanelRepositoryHistory,
} from '../../../vscode/src/core/panelGitHistory';

function makeExec(outputs: string[]) {
  return vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void) => {
    callback(null, outputs.shift() ?? '', '');
  });
}

describe('VS Code panel Git history adapter', () => {
  it('detects the repository with execFile argument arrays and workspace cwd', async () => {
    const execFileImpl = makeExec(['/workspace\n']);
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.detectGitCapability('/workspace/docs')).resolves.toEqual({ supported: true, repositoryRoot: '/workspace' });
    expect(execFileImpl).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      expect.objectContaining({ cwd: '/workspace/docs', windowsHide: true }),
      expect.any(Function),
    );
  });

  it('parses rename-aware history and validates full object IDs', () => {
    const firstOid = '1'.repeat(40);
    const secondOid = '2'.repeat(40);
    expect(parsePanelGitHistory(
      `\x1e${secondOid}\x1fDev\x1f2026-09-14T00:00:00Z\x1frename\nR100\told.md\tnew.md\n\x1e${firstOid}\x1fDev\x1f2026-09-13T00:00:00Z\x1ffirst\n`,
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
    const adapter = createPanelGitHistoryAdapter({ execFileImpl, readFileImpl });

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
    expect(readFileImpl).toHaveBeenCalledWith('/workspace/a.md', 'utf8');
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
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 50, offset: 100 })).resolves.toHaveLength(1);
    expect(execFileImpl.mock.calls[1]?.[1]).toEqual(['rev-parse', 'HEAD']);
    expect(execFileImpl.mock.calls[2]?.[1]).toEqual([
      'log', '--all', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '--skip=100', '-n', '50',
    ]);
  });

  it('scopes revision tree listing and reads to the workspace prefix', async () => {
    const oid = '2'.repeat(40);
    const listExec = makeExec([
      '/workspace\n',
      'docs/a.md\ndocs/sub/b.md\n',
    ]);
    const listAdapter = createPanelGitHistoryAdapter({ execFileImpl: listExec });

    await expect(listAdapter.listRevisionFiles({ workspacePath: '/workspace/docs', oid })).resolves.toEqual([
      { path: 'a.md' },
      { path: 'sub/b.md' },
    ]);
    expect(listExec.mock.calls[1]?.[1]).toEqual(['ls-tree', '-r', '--name-only', oid, '--', 'docs']);

    const readExec = makeExec([
      '/workspace\n',
      '# snapshot\n',
    ]);
    const readAdapter = createPanelGitHistoryAdapter({ execFileImpl: readExec });
    await expect(readAdapter.readRevisionFile({ workspacePath: '/workspace/docs', oid, path: 'a.md' })).resolves.toEqual({
      oid,
      path: 'a.md',
      source: '# snapshot\n',
    });
    expect(readExec.mock.calls[1]?.[1]).toEqual(['show', `${oid}:docs/a.md`]);
  });
});
