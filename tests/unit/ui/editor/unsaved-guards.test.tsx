import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UnsavedChangesModal } from '../../../../ui/src/components/Modal/UnsavedChangesModal';
import { collectDirtyDocumentPaths } from '../../../../ui/src/editor/unsavedGuards';
import { createEditableDocumentSession, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';

describe('unsaved changes guard', () => {
  it('returns only dirty document paths', () => {
    const clean = createEditableDocumentSession('/docs/a.md', '# A', '1:3');
    const dirty = replaceWorkingSource(createEditableDocumentSession('/docs/b.md', '# B', '1:3'), '# B2');
    expect(collectDirtyDocumentPaths({ '/docs/a.md': clean, '/docs/b.md': dirty })).toEqual(['/docs/b.md']);
  });

  it('reports cancel without performing another action', async () => {
    const onChoose = vi.fn();
    render(<UnsavedChangesModal fileName="a.md" onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChoose).toHaveBeenCalledWith('cancel');
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('exposes save and discard choices', async () => {
    const onChoose = vi.fn();
    render(<UnsavedChangesModal fileName="a.md" onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChoose).toHaveBeenLastCalledWith('save');
    await userEvent.click(screen.getByRole('button', { name: "Don't Save" }));
    expect(onChoose).toHaveBeenLastCalledWith('discard');
  });
});
