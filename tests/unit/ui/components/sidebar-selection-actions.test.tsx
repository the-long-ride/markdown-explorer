import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarSelectionActions } from '../../../../ui/src/components/Sidebar/SidebarSelectionActions';
import { getTranslations } from '../../../../ui/src/contexts/translations';

afterEach(cleanup);
const t = getTranslations('en');
const setup = (patch = {}) => {
  const props = {
    t, cancelLabel: 'Cancel', entryNames: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md'], pinnedSelectedCount: 1,
    deleteMode: 'trash' as const, unsavedCount: 0, onExpandAll: vi.fn(), onCollapseAll: vi.fn(), onUnpin: vi.fn(),
    onDelete: vi.fn(async () => {}), onExit: vi.fn(), ...patch,
  };
  render(<SidebarSelectionActions {...props} />);
  return props;
};

describe('SidebarSelectionActions', () => {
  it('expands, collapses and exits', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: t.sidebar.expandAllFolders }));
    fireEvent.click(screen.getByRole('button', { name: t.sidebar.collapseAllFolders }));
    fireEvent.click(screen.getByRole('button', { name: t.sidebar.exitSelectMode }));
    expect(props.onExpandAll).toHaveBeenCalledOnce();
    expect(props.onCollapseAll).toHaveBeenCalledOnce();
    expect(props.onExit).toHaveBeenCalledOnce();
  });
  it('confirms unpin and disables it without pinned selection', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin selected (1)' }));
    expect(props.onUnpin).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(dialog.querySelector('.sidebar-confirm-dialog__confirm')!);
    expect(props.onUnpin).toHaveBeenCalledOnce();
    cleanup();
    setup({ pinnedSelectedCount: 0 });
    expect((screen.getByRole('button', { name: 'Unpin selected (0)' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('shows trash copy, five names, more label and unsaved warning', () => {
    const props = setup({ unsavedCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (7)' }));
    expect(screen.getByRole('alertdialog', { name: 'Move 7 items to Trash?' })).toBeTruthy();
    expect(screen.getByText('e.md')).toBeTruthy();
    expect(screen.queryByText('f.md')).toBeNull();
    expect(screen.getByText('and 2 more')).toBeTruthy();
    expect(screen.getByText('2 files have unsaved changes that will be lost.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    expect(props.onDelete).toHaveBeenCalledOnce();
  });
  it('uses permanent copy for browsers and hides delete without a delete mode', () => {
    setup({ deleteMode: 'permanent' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (7)' }));
    expect(screen.getByRole('alertdialog', { name: 'Permanently delete 7 items?' })).toBeTruthy();
    expect(screen.getByText('Permanently delete — this cannot be undone.')).toBeTruthy();
    cleanup();
    setup({ deleteMode: null });
    expect(screen.queryByRole('button', { name: /Delete selected/ })).toBeNull();
  });
  it('disables unpin and delete and flags the toolbar busy while a delete is in flight', () => {
    setup({ busy: true });
    expect((screen.getByRole('button', { name: 'Unpin selected (1)' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete selected (7)' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('toolbar', { name: t.sidebar.selectMode }).getAttribute('aria-busy')).toBe('true');
    cleanup();
    setup();
    expect((screen.getByRole('button', { name: 'Delete selected (7)' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('toolbar', { name: t.sidebar.selectMode }).getAttribute('aria-busy')).toBeNull();
  });
  it('marks the destructive delete button and the toolbar for styling', () => {
    setup();
    const toolbar = screen.getByRole('toolbar', { name: t.sidebar.selectMode });
    expect(toolbar.className).toContain('sidebar__files-actions--selection');
    expect(screen.getByRole('button', { name: 'Delete selected (7)' }).className).toContain('sidebar__files-action--delete-selected');
  });
});
