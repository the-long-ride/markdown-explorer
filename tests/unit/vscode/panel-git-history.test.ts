import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createPanelGitHistoryAdapter } from '../../../vscode/src/core/panelGitHistory';

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
    const readFileImpl = vi.fn(async () => '# working\n');
    const adapter = createPanelGitHistoryAdapter({ execFileImpl, readFileImpl });

    await expect(adapter.compareGitSources({
      workspacePath: '/workspace',
      left: { kind: 'revision', oid, path: 'a.md' },
      right: { kind: 'current', path: '/workspace/a.md' },
    })).resolves.toMatchObject({
      leftSource: '# committed\n',
      rightSource: '# working\n',
    });

    expect(readFileImpl).toHaveBeenCalledWith(path.resolve('/workspace/a.md'), 'utf8');
  });

  it('rejects repository files outside a subfolder workspace', async () => {
    const oid = 'c'.repeat(40);
    const execFileImpl = makeExec(['/workspace\n', '/workspace\n', '/workspace\n']);
    const adapter = createPanelGitHistoryAdapter({ execFileImpl });

    await expect(adapter.listDocumentHistory({
      workspacePath: '/workspace/docs',
      filePath: '/workspace/secret.md',
      limit: 20,
    })).rejects.toThrow(/outside workspace/i);

    await expect(adapter.readGitRevision({
      workspacePath: '/workspace/docs',
      oid,
      path: 'secret.md',
    })).rejects.toThrow(/outside workspace/i);
  });
});
