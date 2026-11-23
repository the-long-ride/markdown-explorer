import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositorySnapshotProvider, useRepositorySnapshot } from '../../../../ui/src/contexts/RepositorySnapshotContext';

const commit = (index: number) => ({ oid: String(index).padStart(40, '0'), shortOid: String(index), parentOids: [], author: 'D', authoredAt: '2026-09-14T00:00:00Z', subject: `c${index}`, refs: [], isHead: index === 0 });
const page = Array.from({ length: 50 }, (_, index) => commit(index));

function client(listRepositoryHistory: any): any {
  return {
    listDocumentHistory: vi.fn().mockResolvedValue([]), readGitRevision: vi.fn(), compareGitRevisions: vi.fn(),
    listRepositoryHistory, listRevisionFiles: vi.fn().mockResolvedValue([]), readRevisionFile: vi.fn(), dispose: vi.fn(),
  };
}

let api: any;
function Probe() { api = useRepositorySnapshot(); return null; }
const mount = (c: any) => render(<RepositorySnapshotProvider client={c} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);

describe('RepositorySnapshotContext load more history', () => {
  it('reports load-more failures and keeps the loaded page', async () => {
    mount(client(vi.fn().mockResolvedValueOnce(page).mockRejectedValueOnce(new Error('more failed'))));
    await act(async () => { await api.loadHistory(); });
    await waitFor(() => expect(api.hasMoreHistory).toBe(true));
    await act(async () => { await api.loadMoreHistory(); });
    await waitFor(() => expect(api.state.error).toBe('more failed'));
    expect(api.commits).toHaveLength(50);
    expect(api.isLoadingMoreHistory).toBe(false);
  });

  it('stops paging when a page adds nothing new', async () => {
    mount(client(vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce(page)));
    await act(async () => { await api.loadHistory(); });
    await waitFor(() => expect(api.hasMoreHistory).toBe(true));
    await act(async () => { await api.loadMoreHistory(); });
    await waitFor(() => expect(api.hasMoreHistory).toBe(false));
    await act(async () => { await api.loadMoreHistory(); });
  });
});
