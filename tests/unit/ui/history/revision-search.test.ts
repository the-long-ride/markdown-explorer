import { describe, expect, it, vi } from 'vitest';
import { searchRevisionWorkspace } from '../../../../ui/src/history/revisionWorkspace';

const oid = 'a'.repeat(40);

function reader(sources: Record<string, string>) {
  return vi.fn(async (requestedOid: string, path: string) => ({
    oid: requestedOid,
    path,
    source: sources[path] ?? '',
  }));
}

describe('revision workspace search', () => {
  it('searches text files with case-insensitive and case-sensitive modes', async () => {
    const readFile = reader({
      'README.md': 'Hello world\nhello again',
      'docs/a.txt': 'HELLO text',
      'assets/image.png': 'hello binary',
    });
    const files = [
      { path: 'README.md' },
      { path: 'docs/a.txt' },
      { path: 'assets/image.png' },
    ];

    const insensitive = await searchRevisionWorkspace(oid, files, readFile, 'hello', false);
    expect(insensitive).toHaveLength(3);
    expect(insensitive[0]).toMatchObject({
      fsPath: `revision://${oid}/README.md`,
      relativePath: 'README.md',
      lineNumber: 1,
      matchOrdinal: 1,
    });
    expect(readFile).not.toHaveBeenCalledWith(oid, 'assets/image.png');

    readFile.mockClear();
    const sensitive = await searchRevisionWorkspace(oid, files, readFile, 'Hello', true);
    expect(sensitive).toHaveLength(1);
    expect(sensitive[0]?.excerpt).toBe('Hello world');
  });

  it('skips unreadable files and aborts immediately when cancelled', async () => {
    const readFile = vi.fn(async (requestedOid: string, path: string) => {
      if (path === 'bad.md') throw new Error('unreadable');
      return { oid: requestedOid, path, source: 'needle' };
    });
    const files = [{ path: 'bad.md' }, { path: 'good.md' }];

    const results = await searchRevisionWorkspace(oid, files, readFile, 'needle', false);
    expect(results).toHaveLength(1);
    expect(results[0]?.relativePath).toBe('good.md');

    const controller = new AbortController();
    controller.abort();
    await expect(searchRevisionWorkspace(oid, files, readFile, 'needle', false, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
