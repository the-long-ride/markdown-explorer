import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentHistoryPanel } from '../../../../ui/src/components/History/DocumentHistoryPanel';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';

const revision = {
  oid: 'a'.repeat(40),
  shortOid: 'aaaaaaa',
  author: 'Test User',
  authoredAt: '2026-09-07T00:00:00Z',
  subject: 'docs: update',
  path: 'docs/a.md',
};

function createClient(): HistoryClient {
  return {
    getCapability: vi.fn().mockResolvedValue({ supported: true, repositoryRoot: '/repo' }),
    listDocumentHistory: vi.fn().mockResolvedValue([revision]),
    readGitRevision: vi.fn(),
    compareGitRevisions: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('DocumentHistoryPanel', () => {
  it('loads history only after the user requests it', async () => {
    const client = createClient();
    render(<DocumentHistoryPanel filePath="/repo/docs/a.md" client={client} onClose={() => {}} onViewRevision={() => {}} />);
    expect(client.listDocumentHistory).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /load history/i }));

    expect(client.getCapability).toHaveBeenCalledTimes(1);
    expect(client.listDocumentHistory).toHaveBeenCalledWith('/repo/docs/a.md');
    expect(await screen.findByText('docs: update')).toBeInTheDocument();
  });

  it('emits the selected revision without mutating document state', async () => {
    const client = createClient();
    const onViewRevision = vi.fn();
    render(<DocumentHistoryPanel filePath="/repo/docs/a.md" client={client} onClose={() => {}} onViewRevision={onViewRevision} />);
    await userEvent.click(screen.getByRole('button', { name: /load history/i }));
    await userEvent.click(await screen.findByRole('button', { name: /view revision/i }));
    expect(onViewRevision).toHaveBeenCalledWith(revision);
  });

  it('surfaces revision action failures without unmounting the loaded history', async () => {
    const client = createClient();
    const onViewRevision = vi.fn().mockRejectedValue(new Error('Revision could not be read'));
    render(<DocumentHistoryPanel filePath="/repo/docs/a.md" client={client} onClose={() => {}} onViewRevision={onViewRevision} />);
    await userEvent.click(screen.getByRole('button', { name: /load history/i }));
    await userEvent.click(await screen.findByRole('button', { name: /view revision/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Revision could not be read');
    expect(screen.getByText('docs: update')).toBeInTheDocument();
  });

  it('uses the same visible error path for compare action failures', async () => {
    const client = createClient();
    const onCompareCurrent = vi.fn().mockRejectedValue('comparison failed');
    render(
      <DocumentHistoryPanel
        filePath="/repo/docs/a.md"
        client={client}
        onClose={() => {}}
        onViewRevision={() => {}}
        onCompareCurrent={onCompareCurrent}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /load history/i }));
    await userEvent.click(await screen.findByRole('button', { name: /compare with current/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('comparison failed');
  });
});
