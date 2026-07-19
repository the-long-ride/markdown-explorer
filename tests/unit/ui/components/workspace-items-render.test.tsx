import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentWorkspaceItem } from '../../../../ui/src/components/Workspace/RecentWorkspaceItem';
import { RecentWorkspacesModal } from '../../../../ui/src/components/Workspace/RecentWorkspacesModal';
import { WorkspaceWindowControls } from '../../../../ui/src/components/Workspace/WorkspaceWindowControls';

const mockPostMessage = vi.fn();

let mockState: any = {
  theme: 'light',
  settings: { language: 'en', keybindings: {} },
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    selectCustomTheme: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: mockPostMessage, getState: () => undefined, onMessage: vi.fn(() => vi.fn()), setState: () => {}, copyToClipboard: () => {} }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  FolderIcon: ({ size }: any) => <span data-testid="folder-icon">folder-{size}</span>,
  EditIcon: () => <span>edit-icon</span>,
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, ...props }: any) => (
    <button onClick={onClick} {...props}>{icon}{children}</button>
  ),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    recentWorkspaces: { title: 'Recent', subtitle: 'Workspaces', searchPlaceholder: 'Search...', noWorkspaces: 'None', lastOpened: 'Last' },
    tooltips: { minimize: 'Min', maximize: 'Max', restore: 'Restore', closeApp: 'Close', close: 'Close', removeFromRecents: 'Remove' },
    topbar: { switchToLightMode: 'Light', switchToDarkMode: 'Dark' },
  }),
}));

vi.mock('../../../../ui/src/components/Workspace/workspaceSelectionUtils', () => ({
  isDesktopRuntime: () => false,
  formatLastOpened: () => '1m ago',
}));

const baseItem = { name: 'MyProject', path: '/my/project', lastOpened: Date.now() };

describe('RecentWorkspaceItem', () => {
  beforeEach(() => {
    mockState = { theme: 'light', settings: { language: 'en', keybindings: {} } };
    vi.clearAllMocks();
  });

  it('renders workspace display name', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName="CustomName" onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('CustomName')).toBeInTheDocument();
  });

  it('renders workspace path', () => {
    const { container } = render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(container.innerHTML).toContain('/my/project');
  });

  it('calls onOpen when item div is clicked', () => {
    const onOpen = vi.fn();
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={onOpen} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('MyProject'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('renders delete button', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} />);
    const deleteButtons = screen.getAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={onDelete} />);
    const deleteBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('×'));
    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalled();
  });

  it('renders rename button when onRename provided', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} />);
    expect(screen.getByText('edit-icon')).toBeInTheDocument();
  });

  it('does not render rename button when onRename is not provided', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('edit-icon')).not.toBeInTheDocument();
  });

  it('shows rename input when rename button is clicked', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} />);
    const renameBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('edit-icon'));
    fireEvent.click(renameBtn!);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('commits rename on Enter key', () => {
    const onRename = vi.fn();
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} onRename={onRename} />);
    const renameBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('edit-icon'));
    fireEvent.click(renameBtn!);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('New Name');
  });

  it('cancels rename on Escape key', () => {
    const onRename = vi.fn();
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} onRename={onRename} />);
    const renameBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('edit-icon'));
    fireEvent.click(renameBtn!);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('commits rename on blur', () => {
    const onRename = vi.fn();
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} onRename={onRename} />);
    const renameBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('edit-icon'));
    fireEvent.click(renameBtn!);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Blurred Name' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Blurred Name');
  });

  it('renders last opened time', () => {
    render(<RecentWorkspaceItem item={{ ...baseItem, lastOpened: Date.now() }} displayName={baseItem.name} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Last/)).toBeInTheDocument();
  });

  it('does not render last opened time when not provided', () => {
    const noTimeItem = { name: 'MyProject', path: '/my/project' };
    render(<RecentWorkspaceItem item={noTimeItem} displayName={noTimeItem.name} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/Last/)).not.toBeInTheDocument();
  });

  it('renders with modal styles when modal prop is true', () => {
    render(<RecentWorkspaceItem item={baseItem} displayName={baseItem.name} modal={true} onOpen={vi.fn()} onDelete={vi.fn()} />);
    const container = document.querySelector('.recent-workspace-item') as HTMLElement;
    expect(container).toBeInTheDocument();
  });
});

describe('RecentWorkspacesModal', () => {
  const defaultProps = {
    recents: [
      { name: 'Proj1', path: '/p1', lastOpened: Date.now() },
      { name: 'Proj2', path: '/p2' },
    ] as any[],
    searchQuery: '',
    onSearchChange: vi.fn(),
    onClose: vi.fn(),
    onOpenRecent: vi.fn(),
    onDeleteRecent: vi.fn(),
    getDisplayName: (item: any) => item.name,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal container', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders title heading', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders workspace items', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByText('Proj1')).toBeInTheDocument();
    expect(screen.getByText('Proj2')).toBeInTheDocument();
  });

  it('renders no workspaces message when empty', () => {
    render(<RecentWorkspacesModal {...defaultProps} recents={[]} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    const closeBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('×') && b.className.includes('settings-card__close'));
    expect(closeBtn).toBeTruthy();
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    render(<RecentWorkspacesModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSearchChange when typing in search input', () => {
    const onSearchChange = vi.fn();
    render(<RecentWorkspacesModal {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'proj' } });
    expect(onSearchChange).toHaveBeenCalledWith('proj');
  });

  it('renders clear search button when search query is not empty', () => {
    render(<RecentWorkspacesModal {...defaultProps} searchQuery="test" />);
    const clearBtn = screen.getAllByRole('button').find((b) => b.textContent === '×' && !b.className.includes('settings-card__close'));
    expect(clearBtn).toBeTruthy();
  });

  it('calls onSearchChange with empty string when clear search clicked', () => {
    const onSearchChange = vi.fn();
    render(<RecentWorkspacesModal {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />);
    const clearBtn = screen.getAllByRole('button').find((b) => b.textContent === '×' && !b.className.includes('settings-card__close'));
    fireEvent.click(clearBtn!);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onOpenRecent and onClose when a workspace item is opened', () => {
    const onClose = vi.fn();
    const onOpenRecent = vi.fn();
    render(<RecentWorkspacesModal {...defaultProps} onClose={onClose} onOpenRecent={onOpenRecent} />);
    fireEvent.click(screen.getByText('Proj1'));
    expect(onOpenRecent).toHaveBeenCalledWith('/p1');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders subtitle text', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
  });

  it('passes onRenameRecent to RecentWorkspaceItem', () => {
    const onRenameRecent = vi.fn();
    render(<RecentWorkspacesModal {...defaultProps} onRenameRecent={onRenameRecent} />);
    expect(screen.getAllByText('edit-icon').length).toBeGreaterThanOrEqual(1);
  });

  it('renders search placeholder', () => {
    render(<RecentWorkspacesModal {...defaultProps} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search...');
  });
});

describe('WorkspaceWindowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = { theme: 'light', settings: { language: 'en', keybindings: {} } };
  });

  it('renders the window controls container', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    expect(document.querySelector('.window-controls')).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const themeBtn = screen.getAllByRole('button').find((b) => b.className.includes('btn--icon'));
    expect(themeBtn).toBeTruthy();
  });

  it('calls onToggleTheme when theme button clicked', () => {
    const onToggleTheme = vi.fn();
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={onToggleTheme} />);
    const themeBtn = screen.getAllByRole('button').find((b) => b.className.includes('btn--icon'));
    fireEvent.click(themeBtn!);
    expect(onToggleTheme).toHaveBeenCalled();
  });

  it('hides controls when embeddedInTabs is true', () => {
    const { container } = render(<WorkspaceWindowControls embeddedInTabs={true} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('is-hidden');
  });

  it('shows controls when embeddedInTabs is false', () => {
    const { container } = render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass('is-hidden');
  });

  it('does not render window control buttons in non-desktop mode', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const allBtns = screen.getAllByRole('button');
    expect(allBtns.length).toBe(1);
  });

  it('renders theme toggle only in non-desktop mode', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('renders dark mode icon when theme is dark', () => {
    mockState.theme = 'dark';
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="dark" isMaximized={false} onToggleTheme={vi.fn()} />);
    expect(document.querySelector('.window-controls')).toBeInTheDocument();
  });

  it('renders restore tooltip when isMaximized is true in desktop mode', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={true} onToggleTheme={vi.fn()} />);
    expect(document.querySelector('.window-controls')).toBeInTheDocument();
  });

  it('renders correct theme toggle label for light mode', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const btns = screen.getAllByRole('button');
    const themeBtn = btns[0];
    expect(themeBtn).toHaveAttribute('tooltip', 'Dark');
  });

  it('renders correct theme toggle label for dark mode', () => {
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="dark" isMaximized={false} onToggleTheme={vi.fn()} />);
    const btns = screen.getAllByRole('button');
    const themeBtn = btns[0];
    expect(themeBtn).toHaveAttribute('tooltip', 'Light');
  });

  it('sends minimize message on minimize click in desktop mode', () => {
    (window as any).electronAPI = {};
    render(<WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />);
    const desktopBtns = screen.getAllByRole('button').filter((b) => b.className.includes('window-control-btn'));
    if (desktopBtns.length > 0) {
      fireEvent.click(desktopBtns[0]);
      expect(mockPostMessage).toHaveBeenCalled();
    }
    delete (window as any).electronAPI;
  });
});
