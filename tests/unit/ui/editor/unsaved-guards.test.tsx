import { fireEvent, render, screen } from '@testing-library/react';
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

  it('exposes save and discard choices with stable header and file lines', async () => {
    const onChoose = vi.fn();
    render(<UnsavedChangesModal fileName="a.md" onChoose={onChoose} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Your changes has not been saved' })).toBeInTheDocument();
    expect(screen.getByText('The following file has not been saved:')).toBeInTheDocument();
    expect(screen.getByText('a.md')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChoose).toHaveBeenLastCalledWith('save');
    await userEvent.click(screen.getByRole('button', { name: "Don't Save & Leave" }));
    expect(onChoose).toHaveBeenLastCalledWith('discard');
  });

  it('styles its actions with the shared button classes and focuses Save on open', () => {
    render(<UnsavedChangesModal fileName="a.md" onChoose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn', 'btn--primary');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: "Don't Save & Leave" })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('cancels on Escape', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<UnsavedChangesModal fileName="a.md" onChoose={onChoose} />);
    await user.keyboard('{Escape}');
    expect(onChoose).toHaveBeenCalledWith('cancel');
  });

  it('wraps Tab within the dialog, handles Enter on Save, and leaves the other actions alone', () => {
    const onChoose = vi.fn();
    render(<><button type="button">Outside</button><UnsavedChangesModal fileName="a.md" onChoose={onChoose} /></>);
    const save = screen.getByRole('button', { name: 'Save' });
    const discard = screen.getByRole('button', { name: "Don't Save & Leave" });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(discard).toHaveFocus();
    fireEvent.keyDown(discard, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(discard).toHaveFocus();
    cancel.focus();
    expect(fireEvent.keyDown(cancel, { key: 'Tab' })).toBe(true);
    fireEvent.keyDown(cancel, { key: 'Enter' });
    expect(onChoose).not.toHaveBeenCalled();
    save.focus();
    fireEvent.keyDown(save, { key: 'Enter' });
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('save');
  });

  it('keeps keyboard choices disabled during a save with an error and restores only a connected trigger', () => {
    const onChoose = vi.fn();
    const detached = document.createElement('button');
    document.body.appendChild(detached);
    detached.focus();
    const { unmount } = render(<UnsavedChangesModal fileName="a.md" saving errorMessage="Connection lost" onChoose={onChoose} />);
    detached.remove();
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    for (const key of ['Enter', 'Escape', 'Tab']) fireEvent.keyDown(document, { key });
    expect(onChoose).not.toHaveBeenCalled();
    const focus = vi.spyOn(detached, 'focus');
    unmount();
    expect(focus).not.toHaveBeenCalled();
  });
});
