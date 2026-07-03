import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesktopTabBar } from '../../../../ui/src/components/Desktop/DesktopTabBar';
import { FloatingTabToolbar } from '../../../../ui/src/components/Desktop/FloatingTabToolbar';

const mockPostMessage = vi.fn();
const mockBridge = { postMessage: mockPostMessage, getState: vi.fn(() => ({})), onMessage: vi.fn(() => vi.fn()) };

let mockState: any = {
  theme: 'dark',
  isMaximized: false,
  settings: { language: 'en', keybindings: {} },
  currentFile: '/docs/readme.md',
  sidebarCollapsed: false,
  tocCollapsed: true,
  focusMode: false,
  toc: [],
  fileList: [],
  contentTabs: [],
  activeContentTabPath: null,
};

const mockOpenInEditor = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: vi.fn(),
    openInEditor: mockOpenInEditor,
    toggleToc: mockToggleToc,
    toggleFocusMode: mockToggleFocusMode,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => mockBridge,
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    topbar: {
      switchToLightMode: 'Light',
      switchToDarkMode: 'Dark',
      home: 'Home',
      settings: 'Settings',
      welcomePage: 'Welcome',
      moreActions: 'More',
      editLabel: 'Edit',
      edit: 'Edit',
      settingsUpdate: 'Update',
      goBack: 'Back',
      goForward: 'Forward',
      refresh: 'Refresh',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      copy: 'Copy',
    },
    tooltips: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      closeApp: 'Close',
      closeTab: 'Close tab',
      close: 'Close',
      newTab: 'New tab',
      moveToolbar: 'Move',
      showToolbar: 'Show toolbar',
      minimizeToolbar: 'Minimize toolbar',
    },
    tabContextMenu: {
      closeThisTab: 'Close',
      closeTabsToRight: 'Close to right',
      closeOtherTabs: 'Close others',
      closeAllTabs: 'Close all',
    },
    actions: {
      toggleSidebar: 'Sidebar',
      toggleToc: 'TOC',
      toggleFocusMode: 'Focus',
    },
  }),
}));

vi.mock('../../../../ui/src/desktop/desktopTabs', () => ({
  getTabLabel: (tab: any) => tab.alias || tab.workspaceName || (tab.kind === 'home' ? 'Home' : 'New'),
  clampFloatingToolbarPosition: (pos: any) => pos,
}));

vi.mock('../../../../ui/src/desktop/constants', () => ({
  FALLBACK_FLOATING_TOOLBAR_SIZE: { width: 320, height: 52 },
  FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY: 'test-key',
  FLOATING_TOOLBAR_VIEWPORT_MARGIN: 8,
}));

function MockTooltipButton({ onClick, children, tooltip, disabled, ...props }: any) {
  return React.createElement('button', { onClick, disabled, 'aria-label': tooltip, 'data-tooltip': tooltip, ...props }, children);
}

function MockToolbarActionMenu() {
  return React.createElement('div', { 'data-testid': 'toolbar-action-menu' });
}

function MockTabContextMenu({ onAction, onClose }: any) {
  return React.createElement('div', { 'data-testid': 'tab-context-menu' },
    React.createElement('button', { onClick: () => onAction('closeThisTab') }, 'Close Tab'),
    React.createElement('button', { onClick: onClose }, 'Dismiss'),
  );
}

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: (props: any) => MockTooltipButton(props),
}));

vi.mock('../../../../ui/src/components/shared/ToolbarActionMenu', () => ({
  ToolbarActionMenu: (props: any) => MockToolbarActionMenu(),
}));

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({
  TabContextMenu: (props: any) => MockTabContextMenu(props),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => {
  const e = React.createElement;
  return {
    CloseIcon: () => e('span', { 'data-testid': 'close-icon' }, '\u00d7'),
    PlusIcon: () => e('span', { 'data-testid': 'plus-icon' }, '+'),
    ChevronLeftIcon: () => e('span', { 'data-testid': 'chevron-left' }, '<'),
    ChevronRightIcon: () => e('span', { 'data-testid': 'chevron-right' }, '>'),
    CollapseIcon: () => e('span', { 'data-testid': 'collapse-icon' }, 'col'),
    CopyIcon: () => e('span', { 'data-testid': 'copy-icon' }, 'copy'),
    ExpandIcon: () => e('span', { 'data-testid': 'expand-icon' }, 'exp'),
    RefreshIcon: () => e('span', { 'data-testid': 'refresh-icon' }, 'ref'),
  };
});

vi.mock('../../../../ui/src/assets/logos/logo-128.png', () => ({
  default: 'logo.png',
}));

const createTab = (id: string, kind: 'home' | 'workspace' = 'workspace', name = 'Docs') => ({
  id,
  kind,
  workspaceName: name,
  workspacePath: `/${name.toLowerCase()}`,
  alias: '',
  fileList: [],
  tree: null,
  currentFile: null,
  contentHtml: '',
  markdownSource: null,
  frontmatter: {},
  toc: [],
  previewInfo: null,
  relativePath: '',
  isLoading: false,
  notFoundHref: null,
  workspaceUnavailablePath: null,
  workspaceUnavailableReason: null,
  contentTabs: [],
  activeContentTabPath: null,
});

describe('DesktopTabBar', () => {
  const defaultTabBarProps = {
    tabs: [createTab('home', 'home', 'Home'), createTab('tab1', 'workspace', 'Docs')],
    activeTabId: 'tab1',
    onSelectTab: vi.fn(),
    onNewTab: vi.fn(),
    onCloseTab: vi.fn(),
    onCloseTabsToRight: vi.fn(),
    onCloseOtherTabs: vi.fn(),
    onCloseAllTabs: vi.fn(),
    onAliasChange: vi.fn(),
    onThemeToggle: vi.fn(),
    onSettingsOpen: vi.fn(),
    onSidebarToggle: vi.fn(),
    isDark: true,
    isMaximized: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tab bar header element', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const header = container.querySelector('.desktop-tabbar');
    expect(header).toBeInTheDocument();
  });

  it('renders workspace tabs only (excludes home)', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const tabButtons = container.querySelectorAll('[role="tab"]');
    expect(tabButtons).toHaveLength(1);
  });

  it('renders active tab with is-active class', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const activeTab = container.querySelector('.desktop-tab.is-active');
    expect(activeTab).toBeInTheDocument();
  });

  it('calls onSelectTab when tab is clicked', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const tab = container.querySelector('[role="tab"]') as HTMLElement;
    fireEvent.click(tab);
    expect(defaultTabBarProps.onSelectTab).toHaveBeenCalledWith('tab1');
  });

  it('calls onCloseTab when tab close button is clicked', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const closeBtn = container.querySelector('.desktop-tab__close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(defaultTabBarProps.onCloseTab).toHaveBeenCalledWith('tab1');
  });

  it('renders new tab button', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const newTabBtn = container.querySelector('.desktop-tabbar__new');
    expect(newTabBtn).toBeInTheDocument();
  });

  it('calls onNewTab when new tab button clicked', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const newTabBtn = container.querySelector('.desktop-tabbar__new') as HTMLElement;
    fireEvent.click(newTabBtn);
    expect(defaultTabBarProps.onNewTab).toHaveBeenCalled();
  });

  it('renders multiple workspace tabs', () => {
    const tabs = [
      createTab('home', 'home', 'Home'),
      createTab('tab1', 'workspace', 'Docs'),
      createTab('tab2', 'workspace', 'Guides'),
    ];
    const { container } = render(React.createElement(DesktopTabBar, { ...defaultTabBarProps, tabs }));
    const tabsEl = container.querySelectorAll('[role="tab"]');
    expect(tabsEl).toHaveLength(2);
  });

  it('renders tab labels from getTabLabel', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    expect(container.querySelector('.desktop-tab__label')?.textContent).toBe('Docs');
  });

  it('renders window controls section', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const windowControls = container.querySelector('.desktop-tabbar__window-controls');
    expect(windowControls).toBeInTheDocument();
  });

  it('window minimize button sends bridge message', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const windowControls = container.querySelector('.desktop-tabbar__window-controls')!;
    const buttons = windowControls.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-minimize' });
  });

  it('window maximize button sends bridge message', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const windowControls = container.querySelector('.desktop-tabbar__window-controls')!;
    const buttons = windowControls.querySelectorAll('button');
    fireEvent.click(buttons[1]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-maximize' });
  });

  it('window close button sends bridge message', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const windowControls = container.querySelector('.desktop-tabbar__window-controls')!;
    const buttons = windowControls.querySelectorAll('button');
    fireEvent.click(buttons[2]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-close' });
  });

  it('renders brand section with title', () => {
    render(React.createElement(DesktopTabBar, defaultTabBarProps));
    expect(screen.getByText('Markdown Explorer')).toBeInTheDocument();
  });

  it('renders tablist with aria-label', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toHaveAttribute('aria-label', 'Workspace tabs');
  });

  it('renders toolbar action menu', () => {
    render(React.createElement(DesktopTabBar, defaultTabBarProps));
    expect(screen.getByTestId('toolbar-action-menu')).toBeInTheDocument();
  });

  it('shows context menu on right-click of tab', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const tab = container.querySelector('[role="tab"]') as HTMLElement;
    fireEvent.contextMenu(tab);
    expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
  });

  it('calls closeTab from context menu action', () => {
    const { container } = render(React.createElement(DesktopTabBar, defaultTabBarProps));
    const tab = container.querySelector('[role="tab"]') as HTMLElement;
    fireEvent.contextMenu(tab);
    fireEvent.click(screen.getByText('Close Tab'));
    expect(defaultTabBarProps.onCloseTab).toHaveBeenCalledWith('tab1');
  });
});

describe('FloatingTabToolbar', () => {
  const defaultFloatingProps = {
    position: { x: 36, y: 36 },
    onPositionChange: vi.fn(),
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onCopyFile: vi.fn(),
    onRefresh: vi.fn(),
    onBack: vi.fn(),
    onForward: vi.fn(),
    canGoBack: true,
    canGoForward: true,
    canEdit: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders toolbar container', () => {
    const { container } = render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    const toolbar = container.querySelector('.tab-floating-toolbar');
    expect(toolbar).toBeInTheDocument();
  });

  it('renders drag handle button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Move toolbar')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Back')).toBeInTheDocument();
  });

  it('renders forward button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Forward')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
  });

  it('renders expand all button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Expand all')).toBeInTheDocument();
  });

  it('renders collapse all button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Collapse all')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    expect(screen.getByLabelText('Copy')).toBeInTheDocument();
  });

  it('disables back button when canGoBack is false', () => {
    render(React.createElement(FloatingTabToolbar, { ...defaultFloatingProps, canGoBack: false }));
    expect(screen.getByLabelText('Back')).toBeDisabled();
  });

  it('disables forward button when canGoForward is false', () => {
    render(React.createElement(FloatingTabToolbar, { ...defaultFloatingProps, canGoForward: false }));
    expect(screen.getByLabelText('Forward')).toBeDisabled();
  });

  it('disables copy button when canEdit is false', () => {
    render(React.createElement(FloatingTabToolbar, { ...defaultFloatingProps, canEdit: false }));
    expect(screen.getByLabelText('Copy')).toBeDisabled();
  });

  it('calls onBack when back button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Back'));
    expect(defaultFloatingProps.onBack).toHaveBeenCalled();
  });

  it('calls onForward when forward button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Forward'));
    expect(defaultFloatingProps.onForward).toHaveBeenCalled();
  });

  it('calls onRefresh when refresh button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Refresh'));
    expect(defaultFloatingProps.onRefresh).toHaveBeenCalled();
  });

  it('calls onExpandAll when expand button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(defaultFloatingProps.onExpandAll).toHaveBeenCalled();
  });

  it('calls onCollapseAll when collapse button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Collapse all'));
    expect(defaultFloatingProps.onCollapseAll).toHaveBeenCalled();
  });

  it('renders toggle button for collapsing actions', () => {
    const { container } = render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    const toggleBtn = container.querySelector('.tab-floating-toolbar__toggle');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('adds is-actions-collapsed class when toggle clicked', () => {
    const { container } = render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    const toggleBtn = container.querySelector('.tab-floating-toolbar__toggle') as HTMLElement;
    fireEvent.click(toggleBtn);
    const toolbar = container.querySelector('.tab-floating-toolbar');
    expect(toolbar?.className).toContain('is-actions-collapsed');
  });

  it('sets position style from props', () => {
    const { container } = render(React.createElement(FloatingTabToolbar, { ...defaultFloatingProps, position: { x: 100, y: 200 } }));
    const toolbar = container.querySelector('.tab-floating-toolbar') as HTMLElement;
    expect(toolbar.style.right).toBe('100px');
    expect(toolbar.style.bottom).toBe('200px');
  });

  it('calls onCopyFile when copy button clicked', () => {
    render(React.createElement(FloatingTabToolbar, defaultFloatingProps));
    fireEvent.click(screen.getByLabelText('Copy'));
    expect(defaultFloatingProps.onCopyFile).toHaveBeenCalled();
  });
});
