import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarksPanel } from '../../../../ui/src/components/Bookmarks/BookmarksPanel.tsx';
import { bookmarkStore } from '../../../../ui/src/bookmarks/bookmarkStore.ts';
import { getTranslations } from '../../../../ui/src/contexts/translations.ts';
import type { BookmarkRecord, OpenBookmarkWorkspace } from '../../../../ui/src/bookmarks/types.ts';

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
