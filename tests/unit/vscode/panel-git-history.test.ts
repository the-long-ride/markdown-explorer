import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createPanelGitHistoryAdapter, parsePanelRepositoryHistory } from '../../../vscode/src/core/panelGitHistory';

type ExecCallback = (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void;

function makeExec(outputs: string[]) {
  return vi.fn((_file: string, _args: readonly string[], _options: Record<string, unknown>, callback: ExecCallback) => {
    const stdout = outputs.shift() ?? '';
    callback(null, stdout, '');
  });
}

describe('VS Code panel Git history adapter', () => {
  it('detects the repository with execFile argument arrays and workspace cwd', async () => {
    const execFileImpl = makeExec(['/workspace\n']);
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.detectGitCapability('/workspace/docs')).resolves.toEqual({
      supported: true,
      repositoryRoot: path.resolve('/workspace'),
    });

    expect(execFileImpl).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      expect.objectContaining({ cwd: path.resolve('/workspace/docs'), windowsHide: true, encoding: 'utf8' }),
      expect.any(Function),
    );
  });

  it('parses rename-aware history and validates full object IDs', async () => {
    const oid = 'a'.repeat(40);
    const execFileImpl = makeExec([
      '/workspace\n',
      `\x1e${oid}\x1fDev\x1f2026-09-07T00:00:00Z\x1frename\n\nR100\told.md\tnew.md\n`,
    ]);
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.listDocumentHistory({
      workspacePath: '/workspace',
      filePath: '/workspace/new.md',
      limit: 20,
    })).resolves.toEqual([{
      oid,
      shortOid: oid.slice(0, 7),
      author: 'Dev',
      authoredAt: '2026-09-07T00:00:00Z',
      subject: 'rename',
      path: 'new.md',
    }]);

    expect(execFileImpl).toHaveBeenLastCalledWith(
      'git',
      expect.arrayContaining(['log', '--follow', '--name-status', '--', 'new.md']),
      expect.objectContaining({ cwd: path.resolve('/workspace') }),
      expect.any(Function),
    );

    await expect(adapter.readGitRevision({
      workspacePath: '/workspace',
      oid: 'HEAD',
      path: 'new.md',
    })).rejects.toThrow(/invalid revision/i);
  });

  it('reads current comparison sources through the injected file reader', async () => {
    const oid = 'b'.repeat(40);
    const execFileImpl = makeExec(['/workspace\n', '# committed\n']);
    const readFileImpl = vi.fn(async () => '# current');
    const adapter = createPanelGitHistoryAdapter({ execFileImpl, readFileImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'revision', oid, path: 'docs/a.md' },
      right: { kind: 'current', path: 'docs/a.md' },
    })).resolves.toEqual({
      leftSource: '# committed\n',
      rightSource: '# current',
      leftLabel: `${oid.slice(0, 7)}:docs/a.md`,
      rightLabel: 'Current:docs/a.md',
    });
  });

  it('parses repository history with parents, refs, and HEAD detection', () => {
    const mergeOid = 'c'.repeat(40);
    const leftParent = 'd'.repeat(40);
    const rightParent = 'e'.repeat(40);
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

  it('uses exact Git argument arrays for repository history', async () => {
    const headOid = '1'.repeat(40);
    const execFileImpl = makeExec([
      '/workspace\n',
      `${headOid}\n`,
      `\x1e${headOid}\x1f\x1fDev\x1f2026-09-13T00:00:00Z\x1finitial\x1fHEAD -> main\n`,
    ]);
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.listRepositoryHistory({ workspacePath: '/workspace', limit: 200 })).resolves.toHaveLength(1);
    expect(execFileImpl.mock.calls[1]?.[1]).toEqual(['rev-parse', 'HEAD']);
    expect(execFileImpl.mock.calls[2]?.[1]).toEqual([
      'log', '--all', '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D', '-n', '200',
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

    const readExec = makeExec(['/workspace\n', '# historical\n', '/workspace\n']);
    const readAdapter = createPanelGitHistoryAdapter({ execFileImpl: readExec });
    await expect(readAdapter.readRevisionFile({ workspacePath: '/workspace/docs', oid, path: 'a.md' })).resolves.toEqual({
      oid,
      path: 'a.md',
      source: '# historical\n',
    });
    expect(readExec.mock.calls[1]?.[1]).toEqual(['show', `${oid}:docs/a.md`]);

    await expect(readAdapter.readRevisionFile({ workspacePath: '/workspace/docs', oid, path: '../secret.md' })).rejects.toThrow(/outside workspace/i);
    await expect(readAdapter.readRevisionFile({ workspacePath: '/workspace/docs', oid: 'HEAD', path: 'a.md' })).rejects.toThrow(/invalid revision/i);
  });
});
