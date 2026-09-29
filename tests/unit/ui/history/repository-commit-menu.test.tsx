import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryCommitMenu } from '../../../../ui/src/components/History/RepositoryCommitMenu';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';

const oid = 'a'.repeat(40);
const commit: GitRepositoryCommit = {
  oid,
  shortOid: oid.slice(0, 7),
  parentOids: [],
  author: 'Dev User',
  authoredAt: '2026-09-14T00:00:00Z',
  subject: 'feat: menu',
  refs: [],
  isHead: false,
};

function setup(activeRevisionOid: string | null = null) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  const anchor = document.createElement('button');
  sidebar.append(anchor);
  document.body.append(sidebar);

  const onCopy = vi.fn();
  const onActivateRevision = vi.fn();
  const onReturnToHead = vi.fn();
  const onClose = vi.fn();

  render(
    <RepositoryCommitMenu
      commit={commit}
      anchor={anchor}
      activeRevisionOid={activeRevisionOid}
      onCopy={onCopy}
      onActivateRevision={onActivateRevision}
      onReturnToHead={onReturnToHead}
      onClose={onClose}
    />,
  );

  return { sidebar, onCopy, onActivateRevision, onReturnToHead };
}

describe('RepositoryCommitMenu', () => {
  it('copies the full commit SHA while showing the abbreviated SHA', async () => {
    const { sidebar, onCopy, onActivateRevision } = setup();
    await userEvent.click(screen.getByRole('menuitem', { name: /sha aaaaaaa/i }));
    expect(onCopy).toHaveBeenCalledWith(commit.oid, 'Commit SHA');
    expect(onActivateRevision).not.toHaveBeenCalled();
    sidebar.remove();
  });

  it('copies the author and activates a workspace revision only from its action', async () => {
    const { sidebar, onCopy, onActivateRevision } = setup();
    await userEvent.click(screen.getByRole('menuitem', { name: /author · dev user/i }));
    expect(onCopy).toHaveBeenCalledWith(commit.author, 'Author');
    expect(onActivateRevision).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('menuitem', { name: /view workspace at this commit/i }));
    expect(onActivateRevision).toHaveBeenCalledWith(commit.oid);
    sidebar.remove();
  });

  it('shows the return-to-head action only while a historical revision is active', async () => {
    const first = setup();
    expect(screen.queryByRole('menuitem', { name: /back to current head/i })).not.toBeInTheDocument();
    first.sidebar.remove();

    const second = setup('b'.repeat(40));
    await userEvent.click(screen.getByRole('menuitem', { name: /back to current head/i }));
    expect(second.onReturnToHead).toHaveBeenCalledTimes(1);
    second.sidebar.remove();
  });
});
