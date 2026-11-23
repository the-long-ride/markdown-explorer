import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarksPanel } from '../../../../ui/src/components/Bookmarks/BookmarksPanel.tsx';
import { bookmarkStore } from '../../../../ui/src/bookmarks/bookmarkStore.ts';
import { getTranslations } from '../../../../ui/src/contexts/translations.ts';
import type { BookmarkRecord, OpenBookmarkWorkspace } from '../../../../ui/src/bookmarks/types.ts';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice.ts';

describe('BookmarksPanel', () => {
  const translations = getTranslations('en').bookmarks;
  const workspaces: OpenBookmarkWorkspace[] = [
    { workspaceKey: '/ws/alpha', workspaceName: 'Alpha', workspacePath: '/ws/alpha' },
    { workspaceKey: '/ws/beta', workspaceName: 'Beta', workspacePath: '/ws/beta' },
  ];

  const bm1: BookmarkRecord = {
    id: 'b-1',
    name: 'Intro heading',
    workspaceKey: '/ws/alpha',
    workspaceName: 'Alpha',
    workspacePath: '/ws/alpha',
    filePath: '/ws/alpha/readme.md',
    targetKind: 'text',
    selectedText: 'Introduction to Alpha',
    matchOrdinal: 0,
    matchIndex: 0,
    prefix: '',
    suffix: '',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const bm2: BookmarkRecord = {
    id: 'b-2',
    name: 'Setup guide',
    workspaceKey: '/ws/beta',
    workspaceName: 'Beta',
    workspacePath: '/ws/beta',
    filePath: '/ws/beta/guide.md',
    targetKind: 'text',
    selectedText: 'Quick start steps',
    matchOrdinal: 0,
    matchIndex: 0,
    prefix: '',
    suffix: '',
    createdAt: 2000,
    updatedAt: 2000,
  };

  beforeEach(() => {
    const existing = bookmarkStore.getSnapshot().items;
    bookmarkStore.removeMany(existing.map((item) => item.id));
  });

  afterEach(() => {
    cleanup();
    const existing = bookmarkStore.getSnapshot().items;
    bookmarkStore.removeMany(existing.map((item) => item.id));
  });

  it('renders empty state when there are no bookmarks', () => {
    render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(translations.empty)).toBeInTheDocument();
  });

  it('renders items in focus mode only for the active workspace', () => {
    bookmarkStore.add(bm1);
    bookmarkStore.add(bm2);

    render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Intro heading')).toBeInTheDocument();
    expect(screen.queryByText('Setup guide')).not.toBeInTheDocument();
  });

  it('renders groups and expands/collapses them in tabs mode', () => {
    bookmarkStore.add(bm1);
    bookmarkStore.add(bm2);

    render(
      <BookmarksPanel
        visible={true}
        viewMode="tabs"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    // Collapse and expand all buttons
    const collapseAllBtn = screen.getByRole('button', { name: translations.collapseAll });
    fireEvent.click(collapseAllBtn);

    const expandAllBtn = screen.getByRole('button', { name: translations.expandAll });
    fireEvent.click(expandAllBtn);
    expect(screen.getByText('Intro heading')).toBeInTheDocument();
  });

  it('filters bookmarks via search and shows no results when nothing matches', () => {
    bookmarkStore.add(bm1);

    render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(translations.searchPlaceholder);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText(translations.noResults)).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Intro' } });
    expect(screen.getByText('Intro heading')).toBeInTheDocument();
  });

  it('navigates to bookmark on double click or Enter key', () => {
    bookmarkStore.add(bm1);
    const onNavigate = vi.fn();

    render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={onNavigate}
      />,
    );

    const item = screen.getByText('Intro heading').closest('.bookmark-item')!;
    fireEvent.doubleClick(item);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1', name: 'Intro heading' }));

    onNavigate.mockClear();
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1', name: 'Intro heading' }));
  });

  it('supports selection mode, select all, and batch deletion', () => {
    bookmarkStore.add(bm1);
    const onNavigate = vi.fn();

    render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={onNavigate}
      />,
    );

    const toggleSelectBtn = screen.getByRole('button', { name: translations.toggleSelection });
    fireEvent.click(toggleSelectBtn);

    const selectAllBtn = screen.getByRole('button', { name: translations.selectAll });
    fireEvent.click(selectAllBtn);

    const deleteSelectedBtn = screen.getByRole('button', { name: translations.deleteSelected });
    fireEvent.click(deleteSelectedBtn);

    // Confirm modal should appear
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    const confirmBtn = dialog.querySelector('.bookmark-delete-dialog__confirm') as HTMLButtonElement;
    fireEvent.click(confirmBtn);

    expect(bookmarkStore.getSnapshot().items).toHaveLength(0);
  });

  it('opens sort menu and allows changing sort order', () => {
    bookmarkStore.add(bm1);

    const { container } = render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    const sortBtn = screen.getByRole('button', { name: translations.sortLabel });
    fireEvent.click(sortBtn);

    expect(screen.getByRole('menuitem', { name: translations.sortNameDesc })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: translations.sortNameDesc }));
    fireEvent.click(sortBtn);
    expect(screen.getByRole('menuitem', { name: translations.sortNameDesc }).querySelector('svg')).toBeInTheDocument();
    fireEvent.click(sortBtn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('starts with all workspace groups collapsed when no workspace is active', () => {
    bookmarkStore.add(bm1);
    const onNavigate = vi.fn();
    render(<BookmarksPanel visible viewMode="tabs" workspaces={workspaces} activeWorkspaceKey="" translations={translations} onNavigate={onNavigate} />);
    expect(screen.queryByText(bm1.selectedText)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: translations.expandAll }));
    const item = screen.getByText(bm1.selectedText).closest('.bookmark-item')!;
    fireEvent.keyDown(item, { key: 'Tab' });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: translations.toggleSelection }));
    fireEvent.click(item);
    expect(within(item as HTMLElement).getByRole('checkbox')).toBeChecked();
    fireEvent.click(item);
    expect(within(item as HTMLElement).getByRole('checkbox')).not.toBeChecked();
  });

  it('uses item menu actions to navigate, rename with retry, and remove a saved bookmark', () => {
    bookmarkStore.add({ ...bm1, renderedText: 'Visible book excerpt' });
    const onNavigate = vi.fn();
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      render(<BookmarksPanel visible viewMode="focus" workspaces={workspaces} activeWorkspaceKey="/ws/alpha" translations={translations} onNavigate={onNavigate} />);
      const item = screen.getByText('Visible book excerpt').closest('.bookmark-item')!;
      fireEvent.contextMenu(item);
      fireEvent.click(screen.getByRole('menuitem', { name: translations.goTo }));
      expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: bm1.id }));
      fireEvent.click(screen.getByRole('button', { name: translations.menuLabel }));
      fireEvent.click(screen.getByRole('menuitem', { name: translations.editName }));
      const dialog = screen.getByRole('dialog', { name: translations.dialogEditTitle });
      const input = within(dialog).getByRole('textbox', { name: translations.nameLabel });
      const save = within(dialog).getByRole('button', { name: translations.save });
      expect(input).toHaveValue(bm1.name);
      fireEvent.change(input, { target: { value: '  ' } });
      expect(save).toBeDisabled();
      fireEvent.change(input, { target: { value: '  Release notes  ' } });
      const rename = vi.spyOn(bookmarkStore, 'rename').mockReturnValueOnce(false);
      fireEvent.click(save);
      expect(dialog).toBeInTheDocument();
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({
        detail: { tone: 'error', message: translations.renameFailed.replace('{reason}', translations.storageUnavailable) },
      }));
      fireEvent.click(save);
      expect(rename).toHaveBeenLastCalledWith(bm1.id, 'Release notes');
      expect(dialog).not.toBeInTheDocument();
      expect(item).toHaveTextContent('Release notes');
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { tone: 'success', message: translations.renamedSuccess } }));
      fireEvent.contextMenu(item);
      fireEvent.click(screen.getByRole('menuitem', { name: translations.delete }));
      expect(item).not.toBeInTheDocument();
      expect(bookmarkStore.getSnapshot().items).toHaveLength(0);
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it('sorts all stored bookmarks within a group and allows selecting by keyboard', () => {
    bookmarkStore.add(bm1);
    bookmarkStore.add({ ...bm1, id: 'b-3', name: 'Appendix', createdAt: 3000, updatedAt: 3000 });
    const onNavigate = vi.fn();
    const { container } = render(<BookmarksPanel visible viewMode="tabs" workspaces={workspaces} activeWorkspaceKey="/ws/alpha" translations={translations} onNavigate={onNavigate} />);
    const group = screen.getByRole('button', { name: /Alpha/ });
    fireEvent.click(group);
    expect(screen.queryByText(bm1.name)).not.toBeInTheDocument();
    fireEvent.click(group);
    for (const [sort, names] of [
      [translations.sortNameAsc, ['Appendix', bm1.name]],
      [translations.sortNewest, ['Appendix', bm1.name]],
      [translations.sortOldest, [bm1.name, 'Appendix']],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: translations.sortLabel }));
      fireEvent.click(screen.getByRole('menuitem', { name: sort }));
      expect(Array.from(container.querySelectorAll('.bookmark-item__name'), (element) => element.textContent)).toEqual(names);
    }
    fireEvent.click(screen.getByRole('button', { name: translations.toggleSelection }));
    const item = screen.getByText(bm1.name).closest('.bookmark-item')!;
    const checkbox = within(item as HTMLElement).getByRole('checkbox');
    fireEvent.keyDown(item, { key: ' ' });
    expect(checkbox).toBeChecked();
    fireEvent.doubleClick(item);
    fireEvent.contextMenu(item);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(checkbox).not.toBeChecked();
  });

  it('clears selection mode and open menus when panel visibility is toggled off', () => {
    bookmarkStore.add(bm1);

    const { rerender } = render(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    const toggleSelectBtn = screen.getByRole('button', { name: translations.toggleSelection });
    fireEvent.click(toggleSelectBtn);
    expect(toggleSelectBtn).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <BookmarksPanel
        visible={false}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    rerender(
      <BookmarksPanel
        visible={true}
        viewMode="focus"
        workspaces={workspaces}
        activeWorkspaceKey="/ws/alpha"
        translations={translations}
        onNavigate={vi.fn()}
      />,
    );

    const reopenedToggle = screen.getByRole('button', { name: translations.toggleSelection });
    expect(reopenedToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
