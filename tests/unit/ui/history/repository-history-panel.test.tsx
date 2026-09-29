import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  getLaneX,
  getRowMaxLane,
  getRowSpacerWidth,
  getRowY,
  getSegmentPath,
  ROW_HEIGHT,
} from '../../../../ui/src/components/History/GitCommitGraph';
import { RepositoryHistoryPanel } from '../../../../ui/src/components/History/RepositoryHistoryPanel';
import { RepositorySnapshotProvider } from '../../../../ui/src/contexts/RepositorySnapshotContext';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';
import { layoutGitGraph } from '../../../../ui/src/history/gitGraphLayout';
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
    listDocumentHistory: vi.fn().mockResolvedValue([]),
    readGitRevision: vi.fn(),
    compareGitRevisions: vi.fn(),
    listRepositoryHistory: vi.fn().mockResolvedValue(commits),
    listRevisionFiles: vi.fn().mockResolvedValue([{ path: 'docs/a.md' }]),
    readRevisionFile: vi.fn().mockResolvedValue({ oid: oldOid, path: 'docs/a.md', source: '# snapshot' }),
    dispose: vi.fn(),
  };
}

function commit(index: number, overrides: Partial<GitRepositoryCommit> = {}): GitRepositoryCommit {
  const oid = index.toString(16).padStart(40, '0');
  return {
    oid,
    shortOid: oid.slice(0, 7),
    parentOids: [],
    author: `Developer ${index}`,
    authoredAt: '2026-09-13T00:00:00Z',
    subject: `commit ${index}`,
    refs: [],
    isHead: index === 1,
    ...overrides,
  };
}

function createPagedClient(): HistoryClient {
  const firstPage = Array.from({ length: 50 }, (_, index) => commit(index + 1));
  const match = commit(255, { author: 'Alice', subject: 'fix parser pagination' });
  return {
    ...createClient(),
    listRepositoryHistory: vi.fn().mockImplementation(async ({ before }: { before?: string } = {}) => (
      before === undefined ? firstPage : before === firstPage[49].oid ? [match] : []
    )),
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
  it('reminds that History needs Git and a Git-tracked workspace', async () => {
    render(<HistoryFixture client={createClient()} visible />);

    expect(screen.getByText(/History shows earlier file versions when Git is installed/)).toBeInTheDocument();
    expect(await screen.findByText('feat: snapshot history')).toBeInTheDocument();
  });

  it('explains a missing Git after a failed load and retries on demand', async () => {
    const client = createClient();
    vi.mocked(client.listRepositoryHistory).mockRejectedValueOnce(new Error('git-unavailable'));
    render(<HistoryFixture client={client} visible />);

    expect(await screen.findByText('Install Git and reopen this workspace to use History.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('feat: snapshot history')).toBeInTheDocument();
  });

  it('explains a workspace that Git does not track', async () => {
    const client = createClient();
    vi.mocked(client.listRepositoryHistory).mockRejectedValueOnce(new Error('fatal: not a git repository (or any of the parent directories): .git'));
    render(<HistoryFixture client={client} visible />);

    expect(await screen.findByText((content) => content.startsWith('Open a workspace that tracks versions with Git'))).toBeInTheDocument();
  });

  it('explains that a workspace must be opened before loading History', () => {
    const client = createClient();
    render(<RepositorySnapshotProvider client={client} workspaceKey=""><RepositoryHistoryPanel visible language="en" hasWorkspace={false} /></RepositorySnapshotProvider>);
    expect(screen.getAllByText('Open a workspace to check its version history.')).toHaveLength(2);
    expect(client.listRepositoryHistory).not.toHaveBeenCalled();
  });

  it('loads repository commits only when visible and browses snapshot files after explicit activation', async () => {
    const client = createClient();
    const { rerender } = render(<HistoryFixture client={client} visible={false} />);
    expect(client.listRepositoryHistory).not.toHaveBeenCalled();

    rerender(<HistoryFixture client={client} visible />);
    expect(await screen.findByText('feat: snapshot history')).toBeInTheDocument();
    expect(screen.getByText(/History shows earlier file versions when Git is installed/)).toBeInTheDocument();
    expect(client.listRepositoryHistory).toHaveBeenCalledWith({ limit: 50, allRefs: false });
    expect(screen.getAllByTestId('repository-history-graph')).toHaveLength(1);

    await activateOldCommitFromMenu();
    expect(await screen.findByRole('button', { name: /docs\/a\.md/i })).toBeInTheDocument();
    expect(client.listRevisionFiles).toHaveBeenCalledWith(oldOid);

    await userEvent.click(screen.getByRole('button', { name: /docs\/a\.md/i }));
    await waitFor(() => expect(client.readRevisionFile).toHaveBeenCalledWith(oldOid, 'docs/a.md'));
  });

  it('opens commit metadata without activating revision mode and displays icons', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await userEvent.click(await screen.findByRole('button', { name: /feat: snapshot history/i }));
    const shaItem = screen.getByRole('menuitem', { name: /sha aaaaaaa/i });
    const authorItem = screen.getByRole('menuitem', { name: /author · dev/i });
    const viewItem = screen.getByRole('menuitem', { name: /view workspace at this commit/i });
    expect(shaItem).toBeInTheDocument();
    expect(authorItem).toBeInTheDocument();
    expect(viewItem).toBeInTheDocument();
    expect(shaItem.querySelector('.tab-context-menu__item-icon svg')).toBeInTheDocument();
    expect(authorItem.querySelector('.tab-context-menu__item-icon svg')).toBeInTheDocument();
    expect(viewItem.querySelector('.tab-context-menu__item-icon svg')).toBeInTheDocument();
    expect(client.listRevisionFiles).not.toHaveBeenCalled();
  });

  it('offers Back to current HEAD after activating a historical commit', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await activateOldCommitFromMenu();
    expect(await screen.findByRole('button', { name: /back to current head/i })).toBeInTheDocument();
  });

  it('filters by commit metadata and progressively loads pages until a query matches', async () => {
    const client = createPagedClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('commit 2');

    const search = await screen.findByRole('searchbox', { name: /search commits/i });
    await userEvent.type(search, 'alice');

    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenCalledWith({ limit: 50, before: commit(50).oid, offset: 50, allRefs: false }));
    expect(await screen.findByText('fix parser pagination')).toBeInTheDocument();
    expect(screen.queryByText('commit 2')).not.toBeInTheDocument();
  });

  it('loads the next page when the history scroller approaches the bottom', async () => {
    const client = createPagedClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('commit 2');

    const body = screen.getByTestId('repository-history-body');
    Object.defineProperties(body, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
    });
    fireEvent.scroll(body, { target: { scrollTop: 550 } });

    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenCalledWith({ limit: 50, before: commit(50).oid, offset: 50, allRefs: false }));
    // Rows are virtualized: bring the appended commit into the viewport.
    await waitFor(() => expect(document.querySelector('.repository-history__rows-spacer--after')).not.toBeNull());
    fireEvent.scroll(body, { target: { scrollTop: 2400 } });
    expect(await screen.findByText('fix parser pagination')).toBeInTheDocument();
  });
});

describe('GitCommitGraph lane spacing and path routing', () => {
  it('spaces lanes 50% closer (10px clearance between lanes)', () => {
    expect(getLaneX(1) - getLaneX(0)).toBe(10);
    expect(getLaneX(2) - getLaneX(1)).toBe(10);
  });

  it('draws straight vertical path when lanes match', () => {
    const path = getSegmentPath({
      fromRow: 0,
      fromLane: 0,
      toRow: 2,
      toLane: 0,
      continuesBeyondWindow: false,
    }, 200);
    expect(path).toBe('M 6 26 L 6 130');
  });

  it('turns immediately on the first row when branching out to higher lane over multiple rows', () => {
    const path = getSegmentPath({
      fromRow: 0,
      fromLane: 0,
      toRow: 3,
      toLane: 1,
      continuesBeyondWindow: false,
    }, 200);
    expect(path).toBe('M 6 26 C 6 52, 16 52, 16 78 L 16 182');
  });

  it('defers turn to the final row when merging into lower lane over multiple rows', () => {
    const path = getSegmentPath({
      fromRow: 0,
      fromLane: 1,
      toRow: 3,
      toLane: 0,
      continuesBeyondWindow: false,
    }, 200);
    expect(path).toBe('M 16 26 L 16 130 C 16 156, 6 156, 6 182');
  });

  it('handles single row transitions smoothly', () => {
    const forkPath = getSegmentPath({
      fromRow: 0,
      fromLane: 0,
      toRow: 1,
      toLane: 1,
      continuesBeyondWindow: false,
    }, 200);
    expect(forkPath).toBe('M 6 26 C 6 52, 16 52, 16 78');

    const mergePath = getSegmentPath({
      fromRow: 1,
      fromLane: 1,
      toRow: 2,
      toLane: 0,
      continuesBeyondWindow: false,
    }, 200);
    expect(mergePath).toBe('M 16 78 C 16 104, 6 104, 6 130');
  });

  it('extends to bottom of window when continuing beyond window', () => {
    const path = getSegmentPath({
      fromRow: 1,
      fromLane: 0,
      toRow: 2,
      toLane: 0,
      continuesBeyondWindow: true,
    }, 300);
    expect(path).toBe('M 6 78 L 6 300');
  });

  it('displays hover card with SHA, author, and full commit message at bottom on node hover', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('feat: snapshot history');

    const nodeGroup = screen.getByTestId(`repository-history-node-${headOid}`);
    expect(nodeGroup).toBeInTheDocument();

    fireEvent.mouseEnter(nodeGroup);

    const card = await screen.findByTestId('repository-history-node-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent(headOid.slice(0, 7));
    expect(card).toHaveTextContent('Dev');
    expect(card).toHaveTextContent('feat: current head');

    fireEvent.mouseLeave(nodeGroup);
    await waitFor(() => expect(screen.queryByTestId('repository-history-node-card')).not.toBeInTheDocument());
  });

  it('calculates row max lane and spacer width close to the rightmost line on each row', () => {
    const commit1 = commit(1, { parentOids: ['0'.repeat(40)] });
    const commit2 = commit(2, { parentOids: [commit1.oid] });
    const commit3 = commit(3, { parentOids: [commit1.oid] });
    const layout = layoutGitGraph([commit3, commit2, commit1]);

    for (let r = 0; r < layout.nodes.length; r++) {
      const maxLane = getRowMaxLane(r, layout);
      expect(getRowSpacerWidth(r, layout)).toBe(getLaneX(maxLane) + 14);
    }
  });

  it('centers commit nodes vertically in each row without cumulative drift', () => {
    expect(getRowY(0)).toBe(ROW_HEIGHT / 2);
    expect(getRowY(1)).toBe(ROW_HEIGHT + ROW_HEIGHT / 2);
    expect(getRowY(2)).toBe(2 * ROW_HEIGHT + ROW_HEIGHT / 2);
    expect(getRowY(10)).toBe(10 * ROW_HEIGHT + ROW_HEIGHT / 2);
  });

  it('applies per-row adaptive spacer width CSS variable to commit rows', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('feat: snapshot history');

    const commitItems = screen.getAllByRole('listitem');
    expect(commitItems.length).toBeGreaterThan(0);
    for (const item of commitItems) {
      expect(item.style.getPropertyValue('--repository-history-row-graph-width')).toMatch(/\d+px/);
    }
  });

  it('marks commit row as is-menu-open when menu is open and toggles closed on second click', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    const button = await screen.findByRole('button', { name: /feat: snapshot history/i });
    const row = button.closest('li')!;
    expect(row).not.toHaveClass('is-menu-open');

    await userEvent.click(button);
    expect(row).toHaveClass('is-menu-open');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.click(button);
    expect(row).not.toHaveClass('is-menu-open');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('marks commit row as is-hovered when hovering the node circle', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('feat: snapshot history');

    const nodeGroup = screen.getByTestId(`repository-history-node-${headOid}`);
    const headButton = screen.getByRole('button', { name: /feat: current head/i });
    const headRow = headButton.closest('li')!;

    expect(headRow).not.toHaveClass('is-hovered');
    fireEvent.mouseEnter(nodeGroup);
    expect(headRow).toHaveClass('is-hovered');

    fireEvent.mouseLeave(nodeGroup);
    expect(headRow).not.toHaveClass('is-hovered');
  });

  it('reloads with every branch from the All branches toggle', async () => {
    const client = createClient();
    render(<HistoryFixture client={client} visible />);
    await screen.findByText('feat: snapshot history');

    await userEvent.click(screen.getByRole('switch', { name: /all branches/i }));

    await waitFor(() => expect(client.listRepositoryHistory).toHaveBeenLastCalledWith({ limit: 50, allRefs: true }));
    expect(screen.getByRole('switch', { name: /all branches/i })).toBeChecked();
  });
});
