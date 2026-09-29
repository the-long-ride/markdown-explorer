import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositorySnapshotProvider, useRepositorySnapshot } from '../../../../ui/src/contexts/RepositorySnapshotContext';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';

const headOid = 'h'.repeat(40);
const oldOid = 'a'.repeat(40);
const commits = [
  {
    oid: headOid,
    shortOid: headOid.slice(0, 7),
    parentOids: [oldOid],
    author: 'Dev',
    authoredAt: '2026-09-14T00:00:00Z',
    subject: 'head',
    refs: ['HEAD -> main'],
    isHead: true,
  },
  {
    oid: oldOid,
    shortOid: oldOid.slice(0, 7),
    parentOids: [],
    author: 'Dev',
    authoredAt: '2026-09-13T00:00:00Z',
    subject: 'snapshot',
    refs: [],
    isHead: false,
  },
];

function createClient(): HistoryClient {
  return {
    listDocumentHistory: vi.fn().mockResolvedValue([]),
    readGitRevision: vi.fn(),
    compareGitRevisions: vi.fn(),
    listRepositoryHistory: vi.fn().mockResolvedValue(commits),
    listRevisionFiles: vi.fn().mockResolvedValue([{ path: 'docs/a.md' }]),
    readRevisionFile: vi.fn().mockImplementation(async (oid: string, path: string) => ({ oid, path, source: '# historical\n' })),
    dispose: vi.fn(),
  };
}

function Probe() {
  const snapshot = useRepositorySnapshot();
  return (
    <div>
      <span data-testid="status">{snapshot.state.status}</span>
      <span data-testid="head">{snapshot.state.headOid ?? ''}</span>
      <span data-testid="selected">{snapshot.state.selectedOid ?? ''}</span>
      <span data-testid="view">{snapshot.repositoryView.mode === 'revision' ? `revision:${snapshot.repositoryView.oid}` : 'live'}</span>
      <span data-testid="active">{snapshot.state.activeFile?.source ?? ''}</span>
      <span data-testid="count">{snapshot.commits.length}</span>
      <span data-testid="error">{snapshot.state.error ?? ''}</span>
      <span data-testid="all-refs">{String(snapshot.allRefs)}</span>
      <span data-testid="has-more">{String(snapshot.hasMoreHistory)}</span>
      <button type="button" onClick={() => { void snapshot.loadMoreHistory(); }}>more</button>
      <button type="button" onClick={() => snapshot.setAllRefs(!snapshot.allRefs)}>toggle-all</button>
      <button type="button" onClick={() => { void snapshot.loadHistory(); }}>load</button>
      <button type="button" onClick={() => { void snapshot.activateWorkspaceRevision(oldOid); }}>select</button>
      <button type="button" onClick={() => { void snapshot.openSnapshotFile('docs/a.md'); }}>open</button>
      <button type="button" onClick={snapshot.returnToHead}>head</button>
    </div>
  );
}

describe('RepositorySnapshotProvider', () => {
  it('loads history, activates a read-only old revision, and returns to live HEAD state', async () => {
    const client = createClient();
    const onPersistedSelectionsChange = vi.fn();
    render(
      <RepositorySnapshotProvider
        client={client}
        workspaceKey="/repo"
        onPersistedSelectionsChange={onPersistedSelectionsChange}
      >
        <Probe />
      </RepositorySnapshotProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('head')).toHaveTextContent(headOid));
    expect(screen.getByTestId('view')).toHaveTextContent('live');

    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(oldOid));
    expect(screen.getByTestId('view')).toHaveTextContent(`revision:${oldOid}`);
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oldOid);
    expect(onPersistedSelectionsChange).toHaveBeenLastCalledWith({ '/repo': { oid: oldOid } });

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('# historical'));
    expect(client.readRevisionFile).toHaveBeenCalledWith(oldOid, 'docs/a.md');

    await userEvent.click(screen.getByRole('button', { name: 'head' }));
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('active')).toHaveTextContent('');
    expect(screen.getByTestId('view')).toHaveTextContent('live');
    expect(onPersistedSelectionsChange).toHaveBeenLastCalledWith({});
    expect(client.compareGitRevisions).not.toHaveBeenCalled();
  });

  it('restores a valid persisted old revision after history loads', async () => {
    const client = createClient();
    render(
      <RepositorySnapshotProvider
        client={client}
        workspaceKey="/repo"
        persistedSelections={{ '/repo': { oid: oldOid } }}
      >
        <Probe />
      </RepositorySnapshotProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent(`revision:${oldOid}`));
    expect(screen.getByTestId('selected')).toHaveTextContent(oldOid);
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oldOid);
  });

  it('clears a stale persisted revision and remains live', async () => {
    const client = createClient();
    const onPersistedSelectionsChange = vi.fn();
    render(
      <RepositorySnapshotProvider
        client={client}
        workspaceKey="/repo"
        persistedSelections={{ '/repo': { oid: 'missing' } }}
        onPersistedSelectionsChange={onPersistedSelectionsChange}
      >
        <Probe />
      </RepositorySnapshotProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('view')).toHaveTextContent('live');
    expect(onPersistedSelectionsChange).toHaveBeenLastCalledWith({});
  });

  it('keeps a persisted revision when older pages may still contain it', async () => {
    const client = createClient();
    const storedOid = 'f'.repeat(40);
    const firstPage = Array.from({ length: 50 }, (_, index) => {
      const oid = index === 0 ? headOid : index.toString(16).padStart(40, '0');
      return {
        ...commits[0],
        oid,
        shortOid: oid.slice(0, 7),
        parentOids: [],
        subject: `commit ${index}`,
        refs: index === 0 ? ['HEAD -> main'] : [],
        isHead: index === 0,
      };
    });
    vi.mocked(client.listRepositoryHistory).mockResolvedValue(firstPage);
    const onPersistedSelectionsChange = vi.fn();
    render(
      <RepositorySnapshotProvider
        client={client}
        workspaceKey="/repo"
        persistedSelections={{ '/repo': { oid: storedOid } }}
        onPersistedSelectionsChange={onPersistedSelectionsChange}
      >
        <Probe />
      </RepositorySnapshotProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(onPersistedSelectionsChange).not.toHaveBeenCalled();
  });

  it('resets repository snapshot state when the workspace changes', async () => {
    const client = createClient();
    const { rerender } = render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('head')).toHaveTextContent(headOid));
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent(`revision:${oldOid}`));

    rerender(<RepositorySnapshotProvider client={client} workspaceKey="/other"><Probe /></RepositorySnapshotProvider>);
    expect(screen.getByTestId('head')).toHaveTextContent('');
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('view')).toHaveTextContent('live');
  });

  it('surfaces a timed-out load as an error that retry recovers from', async () => {
    const client = createClient();
    vi.mocked(client.listRepositoryHistory)
      .mockRejectedValueOnce(new Error('History request timed out'))
      .mockResolvedValueOnce(commits);
    render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('error')).toHaveTextContent('History request timed out');
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
  });

  it('loads the new workspace when the workspace changes during a pending load', async () => {
    const client = createClient();
    let resolveFirst: (value: typeof commits) => void = () => undefined;
    vi.mocked(client.listRepositoryHistory)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([commits[1]]);
    const { rerender } = render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('loading-history'));

    rerender(<RepositorySnapshotProvider client={client} workspaceKey="/other"><Probe /></RepositorySnapshotProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    resolveFirst(commits);
    await Promise.resolve();
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('requests older commits with the last loaded oid as the cursor', async () => {
    const client = createClient();
    const page = Array.from({ length: 50 }, (_, index) => ({
      ...commits[1],
      oid: index.toString(16).padStart(40, '0'),
      isHead: index === 0,
    }));
    vi.mocked(client.listRepositoryHistory).mockResolvedValueOnce(page).mockResolvedValueOnce([]);
    render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('50'));
    await userEvent.click(screen.getByRole('button', { name: 'more' }));
    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenLastCalledWith({ limit: 50, before: page[49].oid, offset: 50, allRefs: false }));
  });

  it('stops paging when a page adds no new commits', async () => {
    const client = createClient();
    const page = Array.from({ length: 50 }, (_, index) => ({
      ...commits[1],
      oid: index.toString(16).padStart(40, '0'),
      isHead: index === 0,
    }));
    vi.mocked(client.listRepositoryHistory).mockResolvedValueOnce(page).mockResolvedValueOnce(page);
    render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('true'));
    await userEvent.click(screen.getByRole('button', { name: 'more' }));
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('false'));
    expect(screen.getByTestId('count')).toHaveTextContent('50');
  });

  it('reloads with every branch when allRefs is toggled and resets it per workspace', async () => {
    const client = createClient();
    const { rerender } = render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenLastCalledWith({ limit: 50, allRefs: false }));
    await userEvent.click(screen.getByRole('button', { name: 'toggle-all' }));
    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenLastCalledWith({ limit: 50, allRefs: true }));
    expect(screen.getByTestId('all-refs')).toHaveTextContent('true');

    rerender(<RepositorySnapshotProvider client={client} workspaceKey="/other"><Probe /></RepositorySnapshotProvider>);
    await waitFor(() => expect(screen.getByTestId('all-refs')).toHaveTextContent('false'));
  });
});
