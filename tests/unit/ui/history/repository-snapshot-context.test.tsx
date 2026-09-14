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
    getCapability: vi.fn().mockResolvedValue({ supported: true, repositoryRoot: '/repo' }),
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

    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('view')).toHaveTextContent('live');
    expect(onPersistedSelectionsChange).toHaveBeenLastCalledWith({});
  });

  it('resets repository snapshot state when the workspace changes', async () => {
    const client = createClient();
    const { rerender } = render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('head')).toHaveTextContent(headOid));
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent(`revision:${oldOid}`));

    rerender(<RepositorySnapshotProvider client={client} workspaceKey="/other"><Probe /></RepositorySnapshotProvider>);
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('head')).toHaveTextContent('');
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('view')).toHaveTextContent('live');
  });
});
