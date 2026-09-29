import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarFilesActions } from '../../../../ui/src/components/Sidebar/SidebarFilesActions';

function renderActions(onClearPins = vi.fn()) {
  const props = {
    canLocate: false,
    hasPins: true,
    workspaceKey: 'workspace-a',
    locateLabel: 'Locate',
    clearPinsLabel: 'Clear all pinned items',
    clearPinsConfirmBody: 'This will unpin every item in the current workspace.',
    cancelLabel: 'Cancel',
    sortLabel: 'Sort',
    sortNameAscLabel: 'Name A to Z',
    sortNameDescLabel: 'Name Z to A',
    sortModifiedDescLabel: 'Recently modified',
    sortModifiedAscLabel: 'Oldest modified',
    collapseLabel: 'Collapse',
    expandLabel: 'Expand',
    sortMode: 'name-asc' as const,
    onLocate: vi.fn(),
    onClearPins,
    onSortChange: vi.fn(),
    onCollapseAll: vi.fn(),
    onExpandAll: vi.fn(),
  };
  return { ...render(<SidebarFilesActions {...props} />), onClearPins, props };
}

describe('sidebar clear pins confirmation', () => {
  it('keeps pins until the user confirms and supports cancellation', () => {
    const { onClearPins } = renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all pinned items' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClearPins).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClearPins).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all pinned items' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear all pinned items' }));
    expect(onClearPins).toHaveBeenCalledOnce();
  });

  it('does not clear a different workspace if the active workspace changes', () => {
    const { rerender, onClearPins, props } = renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all pinned items' }));
    rerender(<SidebarFilesActions {...props} workspaceKey="workspace-b" />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClearPins).not.toHaveBeenCalled();
  });

  it('focuses Cancel and closes on Escape without unpinning', () => {
    const { onClearPins } = renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all pinned items' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClearPins).not.toHaveBeenCalled();
  });
});
