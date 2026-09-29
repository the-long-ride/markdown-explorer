import { render, screen } from '@testing-library/react';
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
  });
});
