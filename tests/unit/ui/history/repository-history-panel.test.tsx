import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryHistoryPanel } from '../../../../ui/src/components/History/RepositoryHistoryPanel';
import { RepositorySnapshotProvider } from '../../../../ui/src/contexts/RepositorySnapshotContext';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';

const oid = 'a'.repeat(40);
const commit = {
  oid,
  shortOid: oid.slice(0, 7),
  parentOids: [],
  author: 'Dev',
  authoredAt: '2026-09-13T00:00:00Z',
  subject: 'feat: snapshot history',
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
    readRevisionFile: vi.fn().mockResolvedValue({ oid, path: 'docs/a.md', source: '# snapshot' }),
    dispose: vi.fn(),
  };
}

describe('RepositoryHistoryPanel', () => {
  it('loads repository commits only when visible and browses snapshot files', async () => {
    const client = createClient();
    const { rerender } = render(
      <RepositorySnapshotProvider client={client} workspaceKey="/repo">
        <RepositoryHistoryPanel visible={false} language="en" />
      </RepositorySnapshotProvider>,
    );
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    expect(client.listRepositoryHistory).not.toHaveBeenCalled();

    rerender(
      <RepositorySnapshotProvider client={client} workspaceKey="/repo">
        <RepositoryHistoryPanel visible language="en" />
      </RepositorySnapshotProvider>,
    );
    expect(await screen.findByText('feat: snapshot history')).toBeInTheDocument();
    expect(client.listRepositoryHistory).toHaveBeenCalledWith(200);

    await userEvent.click(screen.getByRole('button', { name: /feat: snapshot history/i }));
    expect(await screen.findByRole('button', { name: /docs\/a\.md/i })).toBeInTheDocument();
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oid);

    await userEvent.click(screen.getByRole('button', { name: /docs\/a\.md/i }));
    await waitFor(() => expect(client.readRevisionFile).toHaveBeenCalledWith(oid, 'docs/a.md'));
  });

  it('offers Back to current HEAD after selecting a historical commit', async () => {
    const client = createClient();
    render(
      <RepositorySnapshotProvider client={client} workspaceKey="/repo">
        <RepositoryHistoryPanel visible language="en" />
      </RepositorySnapshotProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /feat: snapshot history/i }));
    expect(await screen.findByRole('button', { name: /back to current head/i })).toBeInTheDocument();
  });
});
