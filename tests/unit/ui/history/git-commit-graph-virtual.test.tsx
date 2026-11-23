import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitCommitGraph } from '../../../../ui/src/components/History/GitCommitGraph';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';

function makeCommits(count: number): GitRepositoryCommit[] {
  const oids = Array.from({ length: count }, (_, index) => index.toString(16).padStart(40, '0'));
  return oids.map((oid, index) => ({
    oid,
    shortOid: oid.slice(0, 7),
    parentOids: index + 1 < count ? [oids[index + 1]] : [],
    author: 'Dev',
    authoredAt: '2026-09-13T00:00:00Z',
    subject: `commit ${index}`,
    refs: [],
    isHead: index === 0,
  }));
}

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

describe('GitCommitGraph virtualization', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() { return (this as HTMLElement).classList.contains('repository-history__body') ? 520 : 0; },
    });
  });

  afterEach(() => {
    if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    vi.restoreAllMocks();
  });

  it('renders only the rows near the viewport for a long history', () => {
    render(
      <div className="repository-history__body" data-testid="body">
        <GitCommitGraph commits={makeCommits(2000)} selectedOid={null} headLabel="HEAD" browseLabel="Browse" onActivateRevision={vi.fn()} onReturnToHead={vi.fn()} />
      </div>,
    );

    expect(document.querySelectorAll('li.repository-history__commit').length).toBeLessThanOrEqual(30);
    expect(screen.getByText('commit 0')).toBeInTheDocument();

    const body = screen.getByTestId('body');
    act(() => {
      body.scrollTop = 52000;
      fireEvent.scroll(body);
    });

    const rows = document.querySelectorAll('li.repository-history__commit');
    expect(rows.length).toBeLessThanOrEqual(30);
    expect(screen.queryByText('commit 0')).toBeNull();
    expect(screen.getByText('commit 1000')).toBeInTheDocument();
    const firstSubject = rows[0].querySelector('.repository-history__commit-subject')?.textContent ?? '';
    expect(Number(firstSubject.replace('commit ', ''))).toBeGreaterThanOrEqual(990);
  });

  it('opens a commit menu from the row and clamps the hover card at viewport edges', () => {
    const [head] = makeCommits(1);
    const commit = { ...head, shortOid: 'abc123', subject: '', refs: ['main', 'v1'] };
    const activate = vi.fn();
    render(<GitCommitGraph commits={[commit]} selectedOid={null} headLabel="HEAD" browseLabel="Browse" onActivateRevision={activate} onReturnToHead={vi.fn()} />);
    const row = screen.getByRole('listitem');
    const button = screen.getByRole('button', { name: /abc123/ });
    expect(row.querySelector('.repository-history__commit-subject')).toHaveTextContent('abc123');
    fireEvent.click(row);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const node = screen.getByTestId(`repository-history-node-${commit.oid}`);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(window.innerWidth - 30, window.innerHeight - 25, 20, 20));
    fireEvent.mouseEnter(node);
    const card = screen.getByRole('tooltip');
    expect(card).toHaveTextContent('main · v1');
    expect(card.style.getPropertyValue('--repository-history-card-left')).toBe(`${window.innerWidth - 300}px`);
    expect(card.style.getPropertyValue('--repository-history-card-top')).toBe(`${window.innerHeight - 122}px`);
    fireEvent.resize(window);
    expect(card).not.toBeInTheDocument();
    fireEvent.click(node);
    expect(activate).toHaveBeenCalledExactlyOnceWith(commit.oid);
  });
});
