import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GitRevisionSummary } from '../../../../ui/src/history/contracts';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';
import { FILE_HISTORY_PAGE_SIZE, useFileHistory } from '../../../../ui/src/history/useFileHistory';

function entry(index: number, path = 'docs/a.md'): GitRevisionSummary {
  const oid = (index + 1).toString(16).padStart(40, '0');
  return { oid, shortOid: oid.slice(0, 7), author: 'Dev', authoredAt: '2026-09-13T00:00:00Z', subject: `commit ${index}`, path };
}

function createClient(entries: readonly GitRevisionSummary[]): HistoryClient {
  return {
    listDocumentHistory: vi.fn().mockImplementation(async (_path: string, limit = 100) => entries.slice(0, limit)),
    readGitRevision: vi.fn().mockImplementation(async (oid: string, path: string) => ({ oid, path, source: `source of ${oid.slice(-2)}` })),
    compareGitRevisions: vi.fn().mockImplementation(async (left: { oid?: string }, right: { oid?: string; kind: string }) => ({
      leftSource: `left ${left.oid?.slice(-2)}`,
      rightSource: right.kind === 'current' ? 'disk text' : `right ${right.oid?.slice(-2)}`,
    })),
    listRepositoryHistory: vi.fn(),
    listRevisionFiles: vi.fn(),
    readRevisionFile: vi.fn(),
    dispose: vi.fn(),
  };
}

const noCurrent = () => null;

describe('useFileHistory', () => {
  it('loads entries then the latest commit diff without interaction', async () => {
    const entries = [entry(0), entry(1), entry(2)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent, 'C:/workspace'));

    await waitFor(() => expect(result.current.diff.status).toBe('ready'));
    expect(result.current.status).toBe('ready');
    expect(client.listDocumentHistory).toHaveBeenCalledWith('docs/a.md', FILE_HISTORY_PAGE_SIZE);
    expect(result.current.selection).toEqual({ kind: 'commit', oid: entries[0].oid });
    expect(client.compareGitRevisions).toHaveBeenCalledWith(
      { kind: 'revision', oid: entries[1].oid, path: entries[1].path },
      { kind: 'revision', oid: entries[0].oid, path: entries[0].path },
    );
  });

  it('compares each entry with its own historical path across a rename', async () => {
    const entries = [entry(0, 'docs/new.md'), entry(1, 'docs/old.md')];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/new.md', noCurrent));

    await waitFor(() => expect(result.current.diff.status).toBe('ready'));
    expect(client.compareGitRevisions).toHaveBeenCalledWith(
      { kind: 'revision', oid: entries[1].oid, path: 'docs/old.md' },
      { kind: 'revision', oid: entries[0].oid, path: 'docs/new.md' },
    );
  });

  it('shows the oldest commit of a short history as the file being added', async () => {
    const entries = [entry(0), entry(1)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));
    vi.mocked(client.compareGitRevisions).mockClear();

    act(() => result.current.select({ kind: 'commit', oid: entries[1].oid }));

    await waitFor(() => expect(result.current.diff.fileAdded).toBe(true));
    expect(result.current.diff.sources?.leftSource).toBe('');
    expect(result.current.diff.sources?.rightSource).toBe(`source of ${entries[1].oid.slice(-2)}`);
    expect(client.compareGitRevisions).not.toHaveBeenCalled();
  });

  it('fetches the next page before comparing the oldest commit of a full page', async () => {
    const entries = Array.from({ length: 150 }, (_, index) => entry(index));
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.select({ kind: 'commit', oid: entries[99].oid }));

    await waitFor(() => expect(client.listDocumentHistory).toHaveBeenCalledWith('docs/a.md', 200));
    await waitFor(() => expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      { kind: 'revision', oid: entries[100].oid, path: entries[100].path },
      { kind: 'revision', oid: entries[99].oid, path: entries[99].path },
    ));
    expect(result.current.entries).toHaveLength(150);
    expect(result.current.diff.fileAdded).toBe(false);
  });

  it('compares a range from the older commit to the newer commit', async () => {
    const entries = [entry(0), entry(1), entry(2)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));

    act(() => result.current.select({ kind: 'range', olderOid: entries[2].oid, newerOid: entries[0].oid }));

    await waitFor(() => expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      { kind: 'revision', oid: entries[2].oid, path: entries[2].path },
      { kind: 'revision', oid: entries[0].oid, path: entries[0].path },
    ));
  });

  it('compares a commit with the unsaved editor text for the current file', async () => {
    const entries = [entry(0), entry(1)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', () => 'unsaved text'));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));

    act(() => result.current.select({ kind: 'current', oid: entries[0].oid }));

    await waitFor(() => expect(result.current.diff.sources?.rightSource).toBe('unsaved text'));
    expect(result.current.diff.sources?.leftSource).toBe(`source of ${entries[0].oid.slice(-2)}`);
  });

  it('compares a commit with the file on disk when there is no editor text', async () => {
    const entries = [entry(0), entry(1)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));

    act(() => result.current.select({ kind: 'current', oid: entries[0].oid }));

    await waitFor(() => expect(result.current.diff.sources?.rightSource).toBe('disk text'));
    expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      { kind: 'revision', oid: entries[0].oid, path: entries[0].path },
      { kind: 'current', path: 'docs/a.md' },
    );
  });

  it('ignores a slow comparison once a newer selection has been made', async () => {
    const entries = [entry(0), entry(1), entry(2), entry(3)];
    const client = createClient(entries);
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));
    await waitFor(() => expect(result.current.diff.status).toBe('ready'));

    let resolveSlow: (value: { leftSource: string; rightSource: string }) => void = () => undefined;
    vi.mocked(client.compareGitRevisions)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
      .mockResolvedValueOnce({ leftSource: 'fast left', rightSource: 'fast right' });

    act(() => result.current.select({ kind: 'commit', oid: entries[1].oid }));
    act(() => result.current.select({ kind: 'commit', oid: entries[2].oid }));
    await waitFor(() => expect(result.current.diff.sources?.rightSource).toBe('fast right'));

    await act(async () => { resolveSlow({ leftSource: 'slow left', rightSource: 'slow right' }); });
    expect(result.current.diff.sources?.rightSource).toBe('fast right');
    expect(result.current.selection).toEqual({ kind: 'commit', oid: entries[2].oid });
  });

  it('reports an unsupported repository as an error and retries on demand', async () => {
    const client = createClient([entry(0)]);
    vi.mocked(client.listDocumentHistory).mockRejectedValueOnce(new Error('not-repository'));
    const { result } = renderHook(() => useFileHistory(client, 'docs/a.md', noCurrent));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('not-repository');

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.entries).toHaveLength(1);
  });

  it('reports a history with no commits as ready and empty', async () => {
    const client = createClient([]);
    const { result } = renderHook(() => useFileHistory(client, 'docs/untracked.md', noCurrent));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.entries).toEqual([]);
    expect(result.current.selection).toBeNull();
    expect(client.compareGitRevisions).not.toHaveBeenCalled();
  });
});
