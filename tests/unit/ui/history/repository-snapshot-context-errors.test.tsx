import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositorySnapshotProvider, useRepositorySnapshot } from '../../../../ui/src/contexts/RepositorySnapshotContext';

const headOid = 'h'.repeat(40);
const oldOid = 'a'.repeat(40);
const commits = [
  { oid: headOid, shortOid: 'hhhhhhh', parentOids: [oldOid], author: 'D', authoredAt: '2026-09-14T00:00:00Z', subject: 'head', refs: [], isHead: true },
  { oid: oldOid, shortOid: 'aaaaaaa', parentOids: [], author: 'D', authoredAt: '2026-09-13T00:00:00Z', subject: 'old', refs: [], isHead: false },
];

function client(overrides: Record<string, any> = {}): any {
  return {
    listDocumentHistory: vi.fn().mockResolvedValue([]), readGitRevision: vi.fn(), compareGitRevisions: vi.fn(),
    listRepositoryHistory: vi.fn().mockResolvedValue(commits),
    listRevisionFiles: vi.fn().mockResolvedValue([{ path: 'docs/a.md' }]),
    readRevisionFile: vi.fn().mockResolvedValue({ oid: oldOid, path: 'docs/a.md', source: '# x\n' }),
    dispose: vi.fn(), ...overrides,
  };
}

let api: any;
function Probe() {
  api = useRepositorySnapshot();
  return <span data-testid="status">{api.state.status}:{api.state.error ?? ''}</span>;
}

function mount(c: any) {
  return render(<RepositorySnapshotProvider client={c} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
}

describe('RepositorySnapshotContext edge paths', () => {
  it('provides inert defaults outside a provider', async () => {
    const { result } = renderHook(() => useRepositorySnapshot());
    result.current.setAllRefs(true);
    result.current.returnToHead();
    await result.current.loadHistory();
    await result.current.loadMoreHistory();
    await result.current.selectCommit('x');
    await result.current.activateWorkspaceRevision('x');
    await result.current.openSnapshotFile('x');
    expect(await result.current.searchRevision('q' as any, {} as any)).toEqual([]);
  });

  it('reports non-Error history failures', async () => {
    mount(client({ listRepositoryHistory: vi.fn().mockRejectedValue(undefined) }));
    await act(async () => { await api.loadHistory(); });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('Repository history is unavailable'));
  });

  it('ignores empty, head and unknown revisions and handles revision read failures', async () => {
    const c = client({ listRevisionFiles: vi.fn().mockRejectedValue('boom') });
    mount(c);
    await act(async () => { await api.loadHistory(); });
    await waitFor(() => expect(api.commits.length).toBe(2));
    await act(async () => {
      await api.activateWorkspaceRevision('  ');
      await api.activateWorkspaceRevision(headOid);
      await api.activateWorkspaceRevision('b'.repeat(40));
      await api.openSnapshotFile('docs/a.md');
    });
    expect(await api.searchRevision('q', {})).toEqual([]);
    await act(async () => { await api.activateWorkspaceRevision(oldOid); });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('boom'));
  });

  it('handles snapshot file read failures and searches revisions', async () => {
    const c = client({ readRevisionFile: vi.fn().mockRejectedValue(new Error('read failed')) });
    mount(c);
    await act(async () => { await api.loadHistory(); });
    await waitFor(() => expect(api.commits.length).toBe(2));
    await act(async () => { await api.activateWorkspaceRevision(oldOid); });
    await waitFor(() => expect(api.repositoryView.mode).toBe('revision'));
    await act(async () => { await api.openSnapshotFile(''); await api.openSnapshotFile('docs/a.md'); });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('read failed'));
    await act(async () => { try { await api.searchRevision('x', { matchCase: false }); } catch { /* search errors surface to callers */ } });
  });
});
