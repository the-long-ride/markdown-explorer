import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositorySnapshotProvider, useRepositorySnapshot } from '../../../../ui/src/contexts/RepositorySnapshotContext';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';

const oid = 'a'.repeat(40);
const commit = {
  oid,
  shortOid: oid.slice(0, 7),
  parentOids: [],
  author: 'Dev',
  authoredAt: '2026-09-13T00:00:00Z',
  subject: 'snapshot',
  refs: ['HEAD -> main'],
  isHead: true,
};

function createClient(): HistoryClient {
  return {
    getCapability: vi.fn().mockResolvedValue({ supported: true, repositoryRoot: '/repo' }),
    listDocumentHistory: vi.fn().mockResolvedValue([]),
    readGitRevision: vi.fn(),
    compareGitRevisions: vi.fn(),
    listRepositoryHistory: vi.fn().mockResolvedValue([commit]),
    listRevisionFiles: vi.fn().mockResolvedValue([{ path: 'docs/a.md' }]),
    readRevisionFile: vi.fn().mockResolvedValue({ oid, path: 'docs/a.md', source: '# historical\n' }),
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
      <span data-testid="active">{snapshot.state.activeFile?.source ?? ''}</span>
      <button type="button" onClick={() => { void snapshot.loadHistory(); }}>load</button>
      <button type="button" onClick={() => { void snapshot.selectCommit(oid); }}>select</button>
      <button type="button" onClick={() => { void snapshot.openSnapshotFile('docs/a.md'); }}>open</button>
      <button type="button" onClick={snapshot.returnToHead}>head</button>
    </div>
  );
}

describe('RepositorySnapshotProvider', () => {
  it('loads history, browses a read-only revision file, and returns to live HEAD state', async () => {
    const client = createClient();
    render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);

    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('head')).toHaveTextContent(oid));

    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(oid));
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oid);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('# historical'));
    expect(client.readRevisionFile).toHaveBeenCalledWith(oid, 'docs/a.md');

    await userEvent.click(screen.getByRole('button', { name: 'head' }));
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('active')).toHaveTextContent('');
    expect(client.compareGitRevisions).not.toHaveBeenCalled();
  });

  it('resets repository snapshot state when the workspace changes', async () => {
    const client = createClient();
    const { rerender } = render(<RepositorySnapshotProvider client={client} workspaceKey="/repo"><Probe /></RepositorySnapshotProvider>);
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() => expect(screen.getByTestId('head')).toHaveTextContent(oid));

    rerender(<RepositorySnapshotProvider client={client} workspaceKey="/other"><Probe /></RepositorySnapshotProvider>);
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('head')).toHaveTextContent('');
    expect(screen.getByTestId('selected')).toHaveTextContent('');
  });
});
