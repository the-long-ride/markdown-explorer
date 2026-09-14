import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryHistoryPanel } from '../../../../ui/src/components/History/RepositoryHistoryPanel';
import { RepositorySnapshotProvider } from '../../../../ui/src/contexts/RepositorySnapshotContext';
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
    subject: 'feat: current head',
    refs: ['HEAD -> main'],
    isHead: true,
  },
  {
    oid: oldOid,
    shortOid: oldOid.slice(0, 7),
    parentOids: [],
    author: 'Dev',
    authoredAt: '2026-09-13T00:00:00Z',
    subject: 'feat: snapshot history',
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
    readRevisionFile: vi.fn().mockResolvedValue({ oid: oldOid, path: 'docs/a.md', source: '# snapshot' }),
    dispose: vi.fn(),
  };
}

function HistoryFixture({ client, visible }: { client: HistoryClient; visible: boolean }) {
  return (
    <div className="sidebar">
      <RepositorySnapshotProvider client={client} workspaceKey="/repo">
        <RepositoryHistoryPanel visible={visible} language="en" />
      </RepositorySnapshotProvider>
    </div>
  );
}

async function activateOldCommitFromMenu(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /feat: snapshot history/i }));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('menuitem', { name: /view workspace at this commit/i }));
}

describe('RepositoryHistoryPanel', () => {
  it('loads repository commits only when visible and browses snapshot files after explicit activation', async () => {
    const client = createClient();
    const { rerender } = render(<HistoryFixture client={client} visible={false} />);
    await waitFor(() => expect(client.getCapability).toHaveBeenCalledTimes(1));
    expect(client.listRepositoryHistory).not.toHaveBeenCalled();

    rerender(<HistoryFixture client={client} visible />);
    expect(await screen.findByText('feat: snapshot history')).toBeInTheDocument();
    expect(client.listRepositoryHistory).toHaveBeenCalledWith(200);
    expect(screen.getAllByTestId('repository-history-graph')).toHaveLength(1);

    await activateOldCommitFromMenu();
    expect(await screen.findByRole('button', { name: /docs\/a\.md/i })).toBeInTheDocument();
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oldOid);

    await userEvent.click(screen.getByRole('button', { name: /docs\/a\.md/i }));
    await waitFor(() => expect(client.readRevisionFile).toHaveBeenCalledWith(oldOid, 'docs/a.md'));
  });

  it('opens commit metadata without activating revision mode', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await userEvent.click(await screen.findByRole('button', { name: /feat: snapshot history/i }));
    expect(screen.getByRole('menuitem', { name: /sha aaaaaaa/i })).toBeInTheDocument();
    expect(client.listRevisionFiles).not.toHaveBeenCalled();
  });

  it('offers Back to current HEAD after activating a historical commit', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await activateOldCommitFromMenu();
    expect(await screen.findByRole('button', { name: /back to current head/i })).toBeInTheDocument();
  });
});
