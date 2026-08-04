import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarSearch } from '../../../../ui/src/components/Sidebar/SidebarSearch';

const mockPostMessage = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnMessage = vi.fn(() => mockUnsubscribe);
let mockState: any;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState }),
}));

const stableBridge = {
  postMessage: mockPostMessage,
  onMessage: mockOnMessage,
  getState: () => undefined,
  setState: () => {},
  copyToClipboard: () => {},
};

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => stableBridge,
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  SearchIcon: () => <span>search-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  FolderChevronIcon: () => <span>chevron-icon</span>,
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltip, ...props }: any) => (
    <button onClick={onClick} aria-label={props['aria-label'] || tooltip} {...props}>
      {icon}{children}
    </button>
  ),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    search: {
      sidebarPlaceholder: 'Search files...',
      sidebarInputLabel: 'Search files',
      matchCase: 'Match case',
      statusOn: 'On',
      statusOff: 'Off',
      minimumCharacters: 'Enter at least 2 characters to search.',
      searchingWorkspace: 'Searching workspace content...',
      noMatches: 'No matches found.',
    },
  }),
}));

vi.mock('../../../../ui/src/utils/unicodeSearch', () => ({
  unicodeIndexOf: (text: string, needle: string, fromIndex: number) => {
    const index = text.toLowerCase().indexOf(needle.toLowerCase(), fromIndex);
    return index < 0 ? null : { index, matchLength: needle.length };
  },
}));

describe('SidebarSearch', () => {
  beforeEach(() => {
    mockState = {
      settings: {
        language: 'en',
        showTitle: true,
        keybindings: {},
        searchScopeFocus: { '/docs': ['/docs/readme.md'] },
      },
    };
    mockPostMessage.mockClear();
    mockOnMessage.mockClear();
  });

  it('renders the workspace search input and minimum-character hint', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(screen.getByRole('textbox', { name: 'Search files' })).toHaveAttribute(
      'placeholder',
      'Search files...',
    );
    expect(screen.getByText('Enter at least 2 characters to search.')).toBeInTheDocument();
  });

  it('renders no Scope Focus controls or alternate scope tree', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(document.querySelector('.sidebar__scope')).toBeNull();
    expect(document.getElementById('searchScopeTree')).toBeNull();
    expect(document.getElementById('searchResultsTree')).toBeInTheDocument();
  });

  it('searches the full workspace without an items payload even with legacy scope settings', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'read' } });
    act(() => { vi.advanceTimersByTime(300); });

    const request = mockPostMessage.mock.calls.find(
      ([message]) => message.command === 'searchWorkspace',
    )?.[0];
    expect(request).toEqual(expect.objectContaining({
      command: 'searchWorkspace',
      query: 'read',
      matchCase: false,
    }));
    expect(request).not.toHaveProperty('items');
    vi.useRealTimers();
  });

  it('sends matchCase for workspace searches', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Match case' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Read' } });
    act(() => { vi.advanceTimersByTime(300); });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'searchWorkspace', query: 'Read', matchCase: true }),
    );
    vi.useRealTimers();
  });

  it('does not search queries shorter than two characters', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'r' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockPostMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reports status changes to the parent', () => {
    const onStatusChange = vi.fn();
    render(<SidebarSearch isVisible={true} onStatusChange={onStatusChange} />);
    expect(onStatusChange).toHaveBeenCalledWith({
      isSearching: false,
      resultCount: 0,
      showCount: false,
    });
  });

  it('registers the workspace result listener', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
  });

  it('shows the searching state after a valid query', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 're' } });
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByText('Searching workspace content...')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
