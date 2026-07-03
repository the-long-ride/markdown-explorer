import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarSearch } from '../../../../ui/src/components/Sidebar/SidebarSearch';

const mockNavigate = vi.fn();
const mockUpdateSettings = vi.fn();
const mockPostMessage = vi.fn();
const mockUnsub = vi.fn();
const mockOnMessage = vi.fn(() => mockUnsub);

let mockState: any;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState, navigate: mockNavigate, updateSettings: mockUpdateSettings }),
}));

const stableBridge = { postMessage: mockPostMessage, onMessage: mockOnMessage, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} };

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => stableBridge,
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CloseIcon: () => <span>close-icon</span>,
  SearchIcon: () => <span>search-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  FolderChevronIcon: () => <span>chevron-icon</span>,
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, ...props }: any) => (
    <button onClick={onClick} {...props}>{icon}{children}</button>
  ),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    sidebar: {
      filterPlaceholder: 'Search...',
      scopeFocus: 'Scope',
      clearScopeFocus: 'Clear',
    },
    tooltips: { removeFromRecents: 'Remove' },
  }),
}));

vi.mock('../../../../ui/src/utils/unicodeSearch', () => ({
  unicodeIndexOf: (text: string, needle: string, fromIndex: number) => {
    const normalized = text.toLowerCase();
    const normalNeedle = needle.toLowerCase();
    const idx = normalized.indexOf(normalNeedle, fromIndex);
    if (idx === -1) return null;
    return { index: idx, matchLength: normalNeedle.length };
  },
}));

describe('SidebarSearch', () => {
  beforeEach(() => {
    mockState = {
      currentFile: null,
      workspacePath: '/docs',
      workspaceName: 'Docs',
      settings: { language: 'en', searchScopeFocus: {}, showTitle: true, keybindings: {} },
      fileList: [
        { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
        { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
      ],
      tree: {
        name: 'Docs',
        path: '/docs',
        files: [
          { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
          { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
        ],
        children: [],
      },
    };
    mockPostMessage.mockClear();
    mockUpdateSettings.mockClear();
    mockOnMessage.mockClear();
    mockNavigate.mockClear();
  });

  it('renders search input', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders search input with aria-label', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search files');
  });

  it('updates query on typing', () => {
    render(<SidebarSearch isVisible={true} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });
    expect(input).toHaveValue('test query');
  });

  it('shows minimum character message when query is less than 2 chars', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(screen.getByText('Enter at least 2 characters to search.')).toBeInTheDocument();
  });

  it('renders scope focus button', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    expect(scopeBtn).toBeTruthy();
    expect(scopeBtn!.textContent).toContain('Scope');
  });

  it('renders scope count showing total files', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    const countSpan = scopeBtn!.querySelector('.sidebar__scope-count');
    expect(countSpan).toHaveTextContent('2/2');
  });

  it('toggles scope focus editing on button click', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    expect(scopeBtn!.className).toContain('is-active');
    fireEvent.click(scopeBtn!);
    expect(scopeBtn!.className).not.toContain('is-active');
  });

  it('renders scope tree when editing mode active', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    expect(document.getElementById('searchScopeTree')).toBeInTheDocument();
  });

  it('renders results tree when not in editing mode', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(document.getElementById('searchResultsTree')).toBeInTheDocument();
  });

  it('calls onStatusChange callback', () => {
    const onStatusChange = vi.fn();
    render(<SidebarSearch isVisible={true} onStatusChange={onStatusChange} />);
    expect(onStatusChange).toHaveBeenCalled();
  });

  it('renders clear scope button when search scope entry exists', () => {
    mockState.settings.searchScopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<SidebarSearch isVisible={true} />);
    const clearBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-clear'));
    expect(clearBtn).toBeTruthy();
  });

  it('calls updateSettings when clear scope clicked', () => {
    mockState.settings.searchScopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<SidebarSearch isVisible={true} />);
    const clearBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-clear'));
    fireEvent.click(clearBtn!);
    expect(mockUpdateSettings).toHaveBeenCalled();
  });

  it('renders scope count with filtered files when scope entry exists', () => {
    mockState.settings.searchScopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    const countSpan = scopeBtn!.querySelector('.sidebar__scope-count');
    expect(countSpan).toHaveTextContent('1/2');
  });

  it('sets aria-pressed on scope button', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    expect(scopeBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(scopeBtn!);
    expect(scopeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not render clear scope button when no scope entry exists', () => {
    render(<SidebarSearch isVisible={true} />);
    const clearBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-clear'));
    expect(clearBtn).toBeFalsy();
  });

  it('renders scope editing mode with tree', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    const scopeTree = document.getElementById('searchScopeTree');
    expect(scopeTree).toBeInTheDocument();
    expect(scopeTree!.getAttribute('role')).toBe('tree');
  });

  it('renders file nodes in scope tree', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    const treeItems = document.querySelectorAll('[data-sidebar-kind="file"]');
    expect(treeItems.length).toBeGreaterThan(0);
  });

  it('renders folder nodes in scope tree with nested children', () => {
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: [],
      children: [{
        name: 'guides',
        path: '/docs/guides',
        files: [{ fsPath: '/docs/guides/intro.md', relativePath: 'guides/intro.md', fileName: 'intro.md', title: 'Intro' }],
        children: [],
      }],
    };
    mockState.fileList = [{ fsPath: '/docs/guides/intro.md', relativePath: 'guides/intro.md', fileName: 'intro.md', title: 'Intro' }];
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    expect(screen.getByText('guides')).toBeInTheDocument();
    expect(screen.getByText('Intro')).toBeInTheDocument();
  });

  it('renders onMessage handler registration', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(mockOnMessage).toHaveBeenCalled();
  });

  it('renders search icon', () => {
    render(<SidebarSearch isVisible={true} />);
    expect(screen.getByText('search-icon')).toBeInTheDocument();
  });

  it('renders scope button with correct text', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    expect(scopeBtn!.textContent).toContain('Scope');
    expect(scopeBtn!.textContent).toContain('2/2');
  });

  it('calls postMessage with searchWorkspace command after debounce', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'read' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'searchWorkspace', query: 'read' }),
    );
    vi.useRealTimers();
  });

  it('does not send search for query under 2 chars', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'r' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockPostMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows searching message when query is 2+ chars', () => {
    vi.useFakeTimers();
    render(<SidebarSearch isVisible={true} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 're' } });
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByText('Searching workspace content...')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders file scope checkboxes in editing mode', () => {
    render(<SidebarSearch isVisible={true} />);
    const scopeBtn = screen.getAllByRole('button').find((b) => b.className.includes('sidebar__scope-btn'));
    fireEvent.click(scopeBtn!);
    const checkboxes = document.querySelectorAll('.scope-focus-checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
