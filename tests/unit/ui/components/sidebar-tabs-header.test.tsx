import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarTabsHeader } from '../../../../ui/src/components/Sidebar/SidebarTabsHeader';

const tabs = [
  { id: 'files', label: 'Files', icon: <span aria-hidden="true">F</span>, count: 12 },
  { id: 'search', label: 'Search', icon: <span aria-hidden="true">S</span> },
  { id: 'bookmarks', label: 'Bookmarks', icon: <span aria-hidden="true">B</span> },
  { id: 'history', label: 'History', icon: <span aria-hidden="true">H</span> },
] as any;

const idleStatus = { isSearching: false, resultCount: 0, showCount: false };

describe('SidebarTabsHeader tooltips', () => {
  it('uses the shared tooltip UI for every icon-only sidebar tab', () => {
    render(
      <SidebarTabsHeader
        activeTab="files"
        tabs={tabs}
        searchStatus={idleStatus}
        onSelect={vi.fn()}
      />,
    );

    for (const label of ['Files', 'Search', 'Bookmarks', 'History']) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveClass('tooltip-container');
      expect(button.querySelector('.tooltip-text')).toHaveTextContent(label);
    }
    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('data-tooltip-align', 'left');
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('data-tooltip-align', 'center');
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('data-tooltip-align', 'right');
  });

  it('renders keyboard shortcut keycaps in Search and Bookmarks tab tooltips when bound', () => {
    const tabsWithShortcuts = [
      { id: 'files', label: 'Files', icon: <span aria-hidden="true">F</span>, count: 12 },
      { id: 'search', label: 'Search', icon: <span aria-hidden="true">S</span>, shortcut: 'Ctrl+K' },
      { id: 'bookmarks', label: 'Bookmarks', icon: <span aria-hidden="true">B</span>, shortcut: 'Alt+Shift+B' },
    ] as any;

    render(
      <SidebarTabsHeader
        activeTab="files"
        tabs={tabsWithShortcuts}
        searchStatus={idleStatus}
        onSelect={vi.fn()}
      />,
    );

    const searchTip = screen.getByRole('button', { name: 'Search' }).querySelector('.tooltip-text');
    expect(searchTip).toHaveTextContent('Search');
    expect(searchTip).toHaveTextContent('Ctrl');
    expect(searchTip).toHaveTextContent('K');

    const bookmarksTip = screen.getByRole('button', { name: 'Bookmarks' }).querySelector('.tooltip-text');
    expect(bookmarksTip).toHaveTextContent('Bookmarks');
    expect(bookmarksTip).toHaveTextContent('Alt');
    expect(bookmarksTip).toHaveTextContent('Shift');
    expect(bookmarksTip).toHaveTextContent('B');
  });

  it('keeps the tab strip usable after the active descriptor is removed', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<SidebarTabsHeader activeTab="history" tabs={tabs} searchStatus={idleStatus} onSelect={onSelect} />);
    rerender(<SidebarTabsHeader activeTab="history" tabs={tabs.slice(0, 3)} searchStatus={idleStatus} onSelect={onSelect} />);
    fireEvent.resize(window);
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('files');
  });

  it('does not show the download action or file count ID for a non-files tab with a count', () => {
    const onDownload = vi.fn();
    const withCounts = tabs.map((tab: { id: string }) => tab.id === 'bookmarks' ? { ...tab, count: 3 } : tab);
    render(<SidebarTabsHeader activeTab="bookmarks" tabs={withCounts} searchStatus={idleStatus} onSelect={vi.fn()} onDownloadWorkspaceZip={onDownload} />);
    expect(screen.getByText('3')).not.toHaveAttribute('id');
    expect(screen.queryByTestId('sidebar-download-workspace-zip')).not.toBeInTheDocument();
  });
});
