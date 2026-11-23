import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarFilesActions } from '../../../../ui/src/components/Sidebar/SidebarFilesActions';
import { useSidebarScopeFocus } from '../../../../ui/src/components/Sidebar/useSidebarScopeFocus';
import { initialState } from '../../../../ui/src/contexts/appStateModel';

function renderActions(onClearPins = vi.fn(), inSidebar = false) {
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
  const actions = <SidebarFilesActions {...props} />;
  return { ...render(inSidebar ? <aside className="sidebar">{actions}</aside> : actions), onClearPins, props };
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

  it('toggles the sort menu closed via its anchor', () => {
    renderActions(vi.fn(), true);
    const sort = screen.getByRole('button', { name: 'Sort' });
    fireEvent.click(sort);
    expect(screen.getByRole('menu', { name: 'Sort' })).toBeInTheDocument();
    fireEvent.click(sort);
    expect(screen.queryByRole('menu', { name: 'Sort' })).not.toBeInTheDocument();
  });

  it('reports controlled sort changes', () => {
    const { rerender, props } = renderActions(vi.fn(), true);
    const sort = screen.getByRole('button', { name: 'Sort' });
    fireEvent.click(sort);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Sort' })).getByText('Oldest modified'));
    expect(props.onSortChange).toHaveBeenCalledWith('modified-asc');
    expect(screen.queryByRole('menu', { name: 'Sort' })).not.toBeInTheDocument();
    for (const [sortMode, label] of [
      ['name-desc', 'Name Z to A'], ['modified-desc', 'Recently modified'], ['modified-asc', 'Oldest modified'],
    ] as const) {
      rerender(<aside className="sidebar"><SidebarFilesActions {...props} sortMode={sortMode} /></aside>);
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe('sidebar scope focus', () => {
  it('starts with all files for legacy settings and restores every path without retaining a redundant override', () => {
    const fileList = ['/a.md', '/b.md'].map((fsPath) => ({
      fsPath, relativePath: fsPath.slice(1), parts: [fsPath.slice(1)], fileName: fsPath.slice(1), title: fsPath.slice(1),
    }));
    const updateSettings = vi.fn();
    const settings = { ...initialState.settings, scopeFocus: undefined };
    const { result, rerender } = renderHook(({ scopeFocus, editing }) => useSidebarScopeFocus({
      fileList, settings: { ...settings, scopeFocus }, workspaceKey: 'current', updateSettings, editing,
    }), { initialProps: { scopeFocus: settings.scopeFocus as typeof initialState.settings.scopeFocus, editing: true } });
    expect(result.current.allSelected).toBe(true);
    act(() => result.current.treeProps.onFileChange('/a.md', false));
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: { current: ['/b.md'] } });
    act(() => result.current.treeProps.onFolderChange(['/a.md', '/b.md'], false));
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: { current: [] } });
    act(() => result.current.clear());
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: {} });
    rerender({ scopeFocus: { current: ['/b.md', '/deleted.md'], other: [] }, editing: false });
    expect(result.current.hideUnselected).toBe(true);
    expect(result.current.count).toBe(1);
    act(() => result.current.treeProps.onFolderChange(['/a.md', '/deleted.md'], true));
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: { other: [] } });
    act(() => result.current.treeProps.onFileChange('/a.md', true));
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: { other: [] } });
    act(() => result.current.treeProps.onFolderChange(['/b.md'], false));
    expect(updateSettings).toHaveBeenLastCalledWith({ scopeFocus: { current: [], other: [] } });
  });
});
