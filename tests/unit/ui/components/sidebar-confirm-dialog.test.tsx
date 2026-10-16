import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarConfirmDialog } from '../../../../ui/src/components/Sidebar/SidebarConfirmDialog';

afterEach(cleanup);

describe('SidebarConfirmDialog', () => {
  it('renders list, more label, warning and destructive confirm', () => {
    const onConfirm = vi.fn();
    render(<SidebarConfirmDialog title="Delete 7 items?" message="Cannot be undone" cancelLabel="Cancel" confirmLabel="Delete permanently"
      items={['a.md', 'b.md']} moreLabel="and 5 more" warning="1 file has unsaved changes" variant="destructive" onCancel={vi.fn()} onConfirm={onConfirm} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete 7 items?' });
    expect(dialog.className).toContain('sidebar-confirm-dialog--destructive');
    expect(screen.getByText('a.md')).toBeTruthy();
    expect(screen.getByText('and 5 more')).toBeTruthy();
    expect(screen.getByText('1 file has unsaved changes')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Cancel');
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('uses the title as confirm label by default and cancels on Escape', () => {
    const onCancel = vi.fn();
    render(<SidebarConfirmDialog title="Clear pins" message="Sure?" cancelLabel="Cancel" onCancel={onCancel} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Clear pins' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
  it('lists repeated basenames without duplicate-key warnings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SidebarConfirmDialog title="Delete 3 items?" message="Sure?" cancelLabel="Cancel" items={['a.md', 'a.md', 'b.md']} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getAllByText('a.md')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(error.mock.calls.filter((call) => String(call[0]).includes('same key'))).toEqual([]);
    error.mockRestore();
  });
});
