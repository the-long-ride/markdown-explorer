import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceSelection } from '../../../../ui/src/components/Workspace/WorkspaceSelection';
import { RecentWorkspaceItem } from '../../../../ui/src/components/Workspace/RecentWorkspaceItem';
import { RecentWorkspacesModal } from '../../../../ui/src/components/Workspace/RecentWorkspacesModal';
import { WorkspaceWindowControls } from '../../../../ui/src/components/Workspace/WorkspaceWindowControls';
import { BrowserFlagGuideModal } from '../../../../ui/src/components/Workspace/BrowserFlagGuideModal';

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
  TooltipButton: ({ onClick, children, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) =>
    React.createElement('button', { onClick, ...props }, children),
}));

vi.mock('../../../../ui/src/contexts/translations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      topbar: { ...en.topbar, switchToLightMode: 'Light', switchToDarkMode: 'Dark', home: 'Home', settings: 'Settings', welcomePage: 'Welcome', moreActions: 'More', editLabel: 'Edit', edit: 'Edit', settingsUpdate: 'Update' },
      tooltips: { ...en.tooltips, minimize: 'Min', maximize: 'Max', restore: 'Restore', closeApp: 'Close', close: 'Close', removeFromRecents: 'Remove', newTab: 'New tab', closeTab: 'Close tab' },
      recentWorkspaces: { ...en.recentWorkspaces, title: 'Recent', subtitle: 'Workspaces', searchPlaceholder: 'Search...', noWorkspaces: 'None', lastOpened: 'Last' },
      actions: { ...en.actions, toggleSidebar: 'Sidebar', toggleToc: 'TOC', toggleFocusMode: 'Focus' },
      tabContextMenu: { ...en.tabContextMenu, closeThisTab: 'Close', closeTabsToRight: 'Close right', closeOtherTabs: 'Close others', closeAllTabs: 'Close all' },
    }),
  };
});

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

function MockWorkspaceWindowControls({ onToggleTheme, onOpenHomepage, theme, isMaximized, embeddedInTabs }: any) {
  return React.createElement('div', {
    'data-testid': 'window-controls',
    'data-theme': theme,
    'data-maximized': String(isMaximized),
    'data-embedded': String(embeddedInTabs),
  },
    onOpenHomepage
      ? React.createElement(
          'button',
          {
            'data-testid': 'workspace-open-homepage-btn',
            'aria-label': 'Home',
            onClick: onOpenHomepage,
          },
          React.createElement('svg', null),
        )
      : null,
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

  it('shows macOS guidance and forwards recent workspace alias changes from an embedded desktop tab', () => {
    mockState.settings.language = '';
    mockState.hostPlatform = 'macos';
    mockState.recentWorkspaces = [{ path: '/docs', name: 'Docs' }];
    vi.stubGlobal('electronAPI', {});
    try {
      const onWorkspaceAliasChange = vi.fn();
      const { container } = render(React.createElement(WorkspaceSelection, {
        embeddedInTabs: true, workspaceAliases: { '/docs': '  Project Notes  ' }, onWorkspaceAliasChange,
      }));
      expect(container.querySelector('.workspace-selection__guide--mac')).toHaveTextContent(/macOS/i);
      expect(container.querySelector('.workspace-selection__recents-note')).toBeInTheDocument();
      expect(screen.getByText('Project Notes')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      expect(onWorkspaceAliasChange).toHaveBeenCalledWith('/docs', 'new-name', 'Docs');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders an empty workspace selection when a legacy host omits its recents list', () => {
    delete mockState.recentWorkspaces;
    render(React.createElement(WorkspaceSelection));
    const dismiss = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    expect(document.dispatchEvent(dismiss)).toBe(true);
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument();
    expect(screen.queryByTestId('recent-workspace-item')).not.toBeInTheDocument();
  });

  it('renders recent workspaces when present', () => {
    mockState.recentWorkspaces = [
      { name: 'Project A', path: '/a', lastOpened: Date.now() },
    ];
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByTestId('recent-workspace-item')).toBeInTheDocument();
  });

  it('renders all recent workspaces directly in the right panel', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
      { name: 'D', path: '/d' },
      { name: 'E', path: '/e' },
      { name: 'F', path: '/f' },
    ];
    render(React.createElement(WorkspaceSelection));
    expect(screen.getAllByTestId('recent-workspace-item')).toHaveLength(6);
  });

  it('does not apply scrollable modifier when recent workspaces count is 5 or fewer', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
      { name: 'D', path: '/d' },
      { name: 'E', path: '/e' },
    ];
    const { container } = render(React.createElement(WorkspaceSelection));
    const list = container.querySelector('.workspace-selection__recent-list');
    expect(list).toBeInTheDocument();
    expect(list).not.toHaveClass('workspace-selection__recent-list--scrollable');
  });

  it('applies scrollable modifier when recent workspaces count exceeds 5', () => {
    mockState.recentWorkspaces = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
      { name: 'D', path: '/d' },
      { name: 'E', path: '/e' },
      { name: 'F', path: '/f' },
    ];
    const { container } = render(React.createElement(WorkspaceSelection));
    const list = container.querySelector('.workspace-selection__recent-list');
    expect(list).toBeInTheDocument();
    expect(list).toHaveClass('workspace-selection__recent-list--scrollable');
  });

  it('filters recent workspaces directly in the right panel search input and clears search', () => {
    mockState.recentWorkspaces = [
      { name: 'Alpha', path: '/alpha' },
      { name: 'Beta', path: '/beta' },
    ];
    render(React.createElement(WorkspaceSelection));
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'beta' } });
    expect(screen.getAllByTestId('recent-workspace-item')).toHaveLength(1);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows empty state when search query matches no recent workspaces', () => {
    mockState.recentWorkspaces = [
      { name: 'Alpha', path: '/alpha' },
    ];
    render(React.createElement(WorkspaceSelection));
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.queryByTestId('recent-workspace-item')).not.toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(React.createElement(WorkspaceSelection));
    expect(screen.getByText('All-in-one Markdown workspace — read, edit, diagram, analyze & export')).toBeInTheDocument();
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

  it('shows Open File button with secondary style in desktop mode', () => {
    (window as any).electronAPI = {};
    render(React.createElement(WorkspaceSelection));
    const btn = screen.getByText('Open File').closest('button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('workspace-selection__open-file');
    delete (window as any).electronAPI;
  });

  it('shows Open File button with secondary style in web demo file mode', () => {
    (window as any).__webBus = new EventTarget();
    window.history.pushState({}, '', '?mode=web');
    render(React.createElement(WorkspaceSelection));
    const btn = screen.getByText('Open File').closest('button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('workspace-selection__open-file');
    delete (window as any).__webBus;
    window.history.pushState({}, '', '/');
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

  it('renders top-right Open Homepage button as SVG icon-only next to theme toggle and triggers onOpenHomepage on click', () => {
    const onOpenHomepage = vi.fn();
    render(React.createElement(WorkspaceSelection, { onOpenHomepage }));
    const homeBtn = screen.getByTestId('workspace-open-homepage-btn');
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).toHaveAttribute('aria-label', 'Home');
    expect(homeBtn.querySelector('svg')).toBeInTheDocument();
    expect(homeBtn).toHaveTextContent('');
    fireEvent.click(homeBtn);
    expect(onOpenHomepage).toHaveBeenCalledTimes(1);
  });

  it('does not render browser flag hint by default or on desktop', () => {
    (window as any).electronAPI = {};
    const { unmount } = render(React.createElement(WorkspaceSelection));
    expect(screen.queryByTestId('open-folder-flag-hint')).not.toBeInTheDocument();
    unmount();

    delete (window as any).electronAPI;
    mockState.appRuntime = 'desktop';
    render(React.createElement(WorkspaceSelection));
    expect(screen.queryByTestId('open-folder-flag-hint')).not.toBeInTheDocument();
  });

  it('does not render browser flag hint on VS Code', () => {
    mockState.appRuntime = 'vscode';
    render(React.createElement(WorkspaceSelection));
    expect(screen.queryByTestId('open-folder-flag-hint')).not.toBeInTheDocument();
  });

  it('renders browser flag hint and opens guideline modal in web demo', () => {
    (window as any).__webBus = new EventTarget();
    try {
      render(React.createElement(WorkspaceSelection));
      const hint = screen.getByTestId('open-folder-flag-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('Enable the File System Access flag to open folders.');

      const guideLink = screen.getByTestId('open-folder-flag-guide-link');
      expect(guideLink).toBeInTheDocument();
      expect(screen.queryByTestId('browser-flag-guide-modal')).not.toBeInTheDocument();

      fireEvent.click(guideLink);
      expect(screen.getByTestId('browser-flag-guide-modal')).toBeInTheDocument();
      expect(screen.getByText('Browser Configuration Guide')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId('browser-flag-guide-modal')).not.toBeInTheDocument();
    } finally {
      delete (window as any).__webBus;
    }
  });

  it('renders browser flag hint in web runtime and closes modal on Escape', () => {
    mockState.appRuntime = 'web';
    render(React.createElement(WorkspaceSelection));
    const hint = screen.getByTestId('open-folder-flag-hint');
    expect(hint).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-folder-flag-guide-link'));
    expect(screen.getByTestId('browser-flag-guide-modal')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('browser-flag-guide-modal')).not.toBeInTheDocument();
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


describe('BrowserFlagGuideModal', () => {
  it('renders guide contents when isOpen is true', () => {
    const handleClose = vi.fn();
    const t = {
      workspaceSelection: {
        browserConfigTitle: 'Browser configuration required',
        browserConfigIntro: 'Follow these steps',
        browserConfigOpen: 'Open',
        browserConfigOr: 'or',
        browserConfigSearch: 'Search for',
        browserConfigEnable: 'Enable it',
      },
      tooltips: {
        close: 'Close',
      },
    };

    render(React.createElement(BrowserFlagGuideModal, { isOpen: true, onClose: handleClose, t }));
    expect(screen.getByTestId('browser-flag-guide-modal')).toBeInTheDocument();
    expect(screen.getByText('Browser configuration required')).toBeInTheDocument();
    expect(screen.getByText('Follow these steps')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    const handleClose = vi.fn();
    render(React.createElement(BrowserFlagGuideModal, { isOpen: false, onClose: handleClose, t: {} }));
    expect(screen.queryByTestId('browser-flag-guide-modal')).toBeNull();
  });

  it('closes on Escape key and backdrop click', () => {
    const handleClose = vi.fn();
    render(React.createElement(BrowserFlagGuideModal, { isOpen: true, onClose: handleClose, t: {} }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    const overlay = screen.getByTestId('browser-flag-guide-modal');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
