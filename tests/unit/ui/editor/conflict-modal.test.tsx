import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentConflictModal } from '../../../../ui/src/components/Modal/DocumentConflictModal';

describe('document conflict modal', () => {
  const conflict = { diskSource: '# Disk', diskRevision: '2:6' };

  it('invokes keep mine only from the explicit force-save choice', async () => {
    const onKeepMine = vi.fn();
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={onKeepMine} onReload={vi.fn()} onCompare={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Keep my edit' }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });

  it('keeps reload and compare as distinct actions', async () => {
    const onReload = vi.fn();
    const onCompare = vi.fn();
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={vi.fn()} onReload={onReload} onCompare={onCompare} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reload disk version' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onCompare).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });
});
