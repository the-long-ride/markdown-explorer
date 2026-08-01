import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceSelection } from '../../../../ui/src/components/Workspace/WorkspaceSelection';
import { RecentWorkspaceItem } from '../../../../ui/src/components/Workspace/RecentWorkspaceItem';
import { RecentWorkspacesModal } from '../../../../ui/src/components/Workspace/RecentWorkspacesModal';
import { WorkspaceWindowControls } from '../../../../ui/src/components/Workspace/WorkspaceWindowControls';

const mockPostMessage = vi.fn();
const mockBridge = { postMessage: mockPostMessage, getState: vi.fn(() => ({})), onMessage: vi.fn(() => vi.fn()) };

let mockState: any = {
  theme: 'light',
  isMaximized: false,
  recentWorkspaces: [],
  settings: { language: 'en', keybindings: {} },
  hostPlatform: 'windows',
  sidebarCollapsed: false,
  tocCollapsed: true,
  focusMode: false,
  currentFile: null,
  toc: [],
};

const mockToggleTheme = vi.fn();
const mockOpenInEditor = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: vi.fn(),
    toggleTheme: mockToggleTheme,
    openInEditor: mockOpenInEditor,
    toggleToc: mockToggleToc,
    toggleFocusMode: mockToggleFocusMode,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => mockBridge,
}));

vi.mock('../../../../ui/src/components/shared/InteractiveBackground', () => ({
  InteractiveBackground: () => React.createElement('div', { 'data-testid': 'interactive-bg' }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  FolderIcon: () => React.createElement('span', null, 'folder'),
  EditIcon: () => React.createElement('span', null, 'edit'),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, ...props }: any) =>
    React.createElement('button', { onClick, ...props }, children),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    topbar: { switchToLightMode: 'Light', switchToDarkMode: 'Dark', home: 'Home', settings: 'Settings', welcomePage: 'Welcome', moreActions: 'More', editLabel: 'Edit', edit: 'Edit', settingsUpdate: 'Update' },
    tooltips: { minimize: 'Min', maximize: 'Max', restore: 'Restore', closeApp: 'Close', close: 'Close', removeFromRecents: 'Remove', newTab: 'New tab', closeTab: 'Close tab' },
    recentWorkspaces: { title: 'Recent', subtitle: 'Workspaces', searchPlaceholder: 'Search...', noWorkspaces: 'None', lastOpened: 'Last' },
    actions: { toggleSidebar: 'Sidebar', toggleToc: 'TOC', toggleFocusMode: 'Focus' },
    tabContextMenu: { closeThisTab: 'Close', closeTabsToRight: 'Close right', closeOtherTabs: 'Close others', closeAllTabs: 'Close all' },
  }),
}));

vi.mock('../../../../ui/src/contexts/welcomeTranslations', () => ({
  getWelcomeTranslations: () => ({ hero: { macosInstallBtn: 'Install' } }),
}));

vi.mock('../../../../ui/src/components/Workspace/workspaceSelectionUtils', () => ({
  isDesktopRuntime: () => false,
  formatLastOpened: () => '1m ago',
}));

vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({
  default: 'logo.png',
}));

function MockWorkspaceWindowControls({ onToggleTheme, theme, isMaximized, embeddedInTabs }: any) {
  return React.createElement('div', {
    'data-testid': 'window-controls',
    'data-theme': theme,
    'data-maximized': String(isMaximized),
    'data-embedded': String(embeddedInTabs),
  },
    React.createElement('button', { onClick: onToggleTheme }, 'Toggle Theme'),
  );
}

function MockRecentWorkspaceItem({ item, displayName, onOpen, onDelete, onRename }: any) {
  return React.createElement('div', { 'data-testid': 'recent-workspace-item', 'data-path': item.path },
    React.createElement('span', null, displayName),
    React.createElement('button', { onClick: onOpen }, 'Open'),
    React.createElement('button', { onClick: onDelete }, 'Delete'),
    onRename ? React.createElement('button', { onClick: () => onRename('new-name') }, 'Rename') : null,
  );
}

function MockRecentWorkspacesModal({ recents, onClose, onOpenRecent, onDeleteRecent, searchQuery, onSearchChange, getDisplayName }: any) {
  return React.createElement('div', { 'data-testid': 'workspaces-modal' },
    React.createElement('button', { onClick: onClose }, 'Close Modal'),
    recents.map((r: any) =>
      React.createElement('div', { key: r.path, 'data-testid': 'modal-item' },
        React.createElement('span', null, r.name),
        React.createElement('button', { onClick: () => onOpenRecent(r.path) }, 'Open'),
        React.createElement('button', { onClick: () => onDeleteRecent(r.path) }, 'Delete'),
      )
    ),
  );
}

vi.mock('../../../../ui/src/components/Workspace/WorkspaceWindowControls', () => ({
  WorkspaceWindowControls: (props: any) => MockWorkspaceWindowControls(props),
}));

vi.mock('../../../../ui/src/components/Workspace/RecentWorkspaceItem', () => ({
  RecentWorkspaceItem: (props: any) => MockRecentWorkspaceItem(props),
}));

vi.mock('../../../../ui/src/components/Workspace/RecentWorkspacesModal', () => ({
  RecentWorkspacesModal: (props: any) => MockRecentWorkspacesModal(props),
}));

describe('WorkspaceSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      theme: 'light',
      isMaximized: false,
      recentWorkspaces: [],
      settings: { language: 'en', keybindings: {} },
      hostPlatform: 'windows',
      sidebarCollapsed: false,
      tocCollapsed: true,
      focusMode: false,
      currentFile: null,
      toc: [],
    };
    delete (window as any).electronAPI;
  });

  it('prevents F5 from refreshing while the workspace selection screen is mounted', () => {
    render(React.createElement(WorkspaceSelection));
    const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders the workspace selection container with title', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByText('Markdown Explorer')).toBeInTheDocument();
  });

  it('renders the Open Folder button', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
  });

  it('calls bridge.postMessage with openFolder on Open Folder click', () => {
    render(React.createElement(WorkspaceSelection));
    fireEvent.click(screen.getByText('Open Folder'));
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'openFolder', openFirstFile: false });
  });

  it('calls onBeforeOpenWorkspace before sending openFolder message', () => {
    const onBefore = vi.fn();
    render(React.createElement(WorkspaceSelection, { onBeforeOpenWorkspace: onBefore }));
    fireEvent.click(screen.getByText('Open Folder'));
    expect(onBefore).toHaveBeenCalled();
  });

  it('renders recent workspaces when present', () => {
    mockState.recentWorkspaces = [
      { name: 'Project A', path: '/a', lastOpened: Date.now() },
    ];
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByTestId('recent-workspace-item')).toBeInTheDocument();
  });

  it('renders up to 3 recent workspaces by default', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
      { name: 'D', path: '/d' },
    ];
    render(React.createElement(WorkspaceSelection));
    expect(screen.getAllByTestId('recent-workspace-item')).toHaveLength(3);
  });

  it('shows Show More link button when recent workspaces are present', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
    ];
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByRole('button', { name: 'Show More...' })).toHaveClass('workspace-selection__show-more');
  });

  it('opens modal when Show More clicked', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
      { name: 'D', path: '/d' },
    ];
    render(React.createElement(WorkspaceSelection));
    fireEvent.click(screen.getByText('Show More...'));
    expect(screen.getByTestId('workspaces-modal')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByText('Documentation viewer & navigator')).toBeInTheDocument();
  });

  it('renders the InteractiveBackground', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByTestId('interactive-bg')).toBeInTheDocument();
  });

  it('renders window controls', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByTestId('window-controls')).toBeInTheDocument();
  });

  it('does not show Open File button in non-desktop mode', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
  });

  it('shows Open File button in desktop mode', () => {
    (window as any).electronAPI = {};
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByText('Open File')).toBeInTheDocument();
    delete (window as any).electronAPI;
  });

  it('sends openFile command when Open File clicked in desktop mode', () => {
    (window as any).electronAPI = {};
    render(React.createElement(WorkspaceSelection));
    fireEvent.click(screen.getByText('Open File'));
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'openFile' });
    delete (window as any).electronAPI;
  });

  it('calls onOpenRecent via RecentWorkspaceItem open button', () => {
    mockState.recentWorkspaces = [{ name: 'Proj', path: '/p', lastOpened: Date.now() }];
    render(React.createElement(WorkspaceSelection));
    fireEvent.click(screen.getByText('Open'));
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'openRecentWorkspace', path: '/p', openFirstFile: false });
  });

  it('calls deleteRecentWorkspace via RecentWorkspaceItem delete button', () => {
    mockState.recentWorkspaces = [{ name: 'Proj', path: '/p', lastOpened: Date.now() }];
    render(React.createElement(WorkspaceSelection));
    fireEvent.click(screen.getByText('Delete'));
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'deleteRecentWorkspace', path: '/p' });
  });
});

describe('RecentWorkspaceItem', () => {
  const mockAppState = { state: { settings: { language: 'en', keybindings: {} } } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workspace display name', () => {
    const item = { name: 'MyProject', path: '/my/project', lastOpened: Date.now() };
    render(React.createElement(RecentWorkspaceItem as any, {
      item,
      displayName: 'CustomName',
      onOpen: vi.fn(),
      onDelete: vi.fn(),
    }));
    expect(screen.getByText('CustomName')).toBeInTheDocument();
  });

  it('renders workspace path', () => {
    const item = { name: 'X', path: '/x/y', lastOpened: Date.now() };
    const { container } = render(React.createElement(RecentWorkspaceItem as any, {
      item,
      displayName: item.name,
      onOpen: vi.fn(),
      onDelete: vi.fn(),
    }));
    expect(container.innerHTML).toContain('/x/y');
  });

  it('calls onOpen when the item div is clicked', () => {
    const onOpen = vi.fn();
    const item = { name: 'A', path: '/a' };
    render(React.createElement(RecentWorkspaceItem as any, {
      item,
      displayName: item.name,
      onOpen,
      onDelete: vi.fn(),
    }));
    fireEvent.click(screen.getByText('Open'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    const item = { name: 'A', path: '/a' };
    render(React.createElement(RecentWorkspaceItem as any, {
      item,
      displayName: item.name,
      onOpen: vi.fn(),
      onDelete,
    }));
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('RecentWorkspacesModal', () => {
  const defaultProps = {
    recents: [
      { name: 'Proj1', path: '/p1', lastOpened: Date.now() },
      { name: 'Proj2', path: '/p2' },
    ],
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
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    expect(screen.getByTestId('workspaces-modal')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    expect(screen.getByText('Close Modal')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    fireEvent.click(screen.getByText('Close Modal'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders workspace items', () => {
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    const items = screen.getAllByTestId('modal-item');
    expect(items).toHaveLength(2);
  });

  it('calls onOpenRecent when open clicked', () => {
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    const openButtons = screen.getAllByText('Open');
    fireEvent.click(openButtons[0]);
    expect(defaultProps.onOpenRecent).toHaveBeenCalledWith('/p1');
  });

  it('calls onDeleteRecent when delete clicked', () => {
    render(React.createElement(RecentWorkspacesModal as any, defaultProps));
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[1]);
    expect(defaultProps.onDeleteRecent).toHaveBeenCalledWith('/p2');
  });

  it('renders with empty recents', () => {
    render(React.createElement(RecentWorkspacesModal as any, { ...defaultProps, recents: [] }));
    expect(screen.getByTestId('workspaces-modal')).toBeInTheDocument();
  });
});

describe('WorkspaceWindowControls', () => {
  const defaultControlsProps = {
    embeddedInTabs: false,
    theme: 'light' as const,
    isMaximized: false,
    onToggleTheme: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders window controls container', () => {
    render(React.createElement(WorkspaceWindowControls, defaultControlsProps));
    expect(screen.getByTestId('window-controls')).toBeInTheDocument();
  });

  it('passes theme prop', () => {
    render(React.createElement(WorkspaceWindowControls, { ...defaultControlsProps, theme: 'dark' }));
    expect(screen.getByTestId('window-controls')).toHaveAttribute('data-theme', 'dark');
  });

  it('passes isMaximized prop', () => {
    render(React.createElement(WorkspaceWindowControls, { ...defaultControlsProps, isMaximized: true }));
    expect(screen.getByTestId('window-controls')).toHaveAttribute('data-maximized', 'true');
  });

  it('passes embeddedInTabs prop', () => {
    render(React.createElement(WorkspaceWindowControls, { ...defaultControlsProps, embeddedInTabs: true }));
    expect(screen.getByTestId('window-controls')).toHaveAttribute('data-embedded', 'true');
  });

  it('calls onToggleTheme when theme button clicked', () => {
    render(React.createElement(WorkspaceWindowControls, defaultControlsProps));
    fireEvent.click(screen.getByText('Toggle Theme'));
    expect(defaultControlsProps.onToggleTheme).toHaveBeenCalled();
  });
});
