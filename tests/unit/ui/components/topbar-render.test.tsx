import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Topbar } from '../../../../ui/src/components/Topbar/Topbar';

const mockBack = vi.fn();
const mockForward = vi.fn();
const mockNavigate = vi.fn();
const mockToggleTheme = vi.fn();
const mockToggleSidebar = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();
const mockOpenInEditor = vi.fn();
const mockRefresh = vi.fn();
const mockDispatch = vi.fn();
const mockPostMessage = vi.fn();
const mockBridge = { postMessage: mockPostMessage, getState: vi.fn(() => ({})), onMessage: vi.fn(() => vi.fn()) };

let mockState: any;
let mockCanGoBack = true;
let mockCanGoForward = false;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    navigate: mockNavigate,
    dispatch: mockDispatch,
    toggleTheme: mockToggleTheme,
    toggleSidebar: mockToggleSidebar,
    toggleToc: mockToggleToc,
    toggleFocusMode: mockToggleFocusMode,
    openInEditor: mockOpenInEditor,
    refresh: mockRefresh,
  }),
}));

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => ({
    back: mockBack,
    forward: mockForward,
    canGoBack: mockCanGoBack,
    canGoForward: mockCanGoForward,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => mockBridge,
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    topbar: {
      switchToLightMode: 'Switch to Light',
      switchToDarkMode: 'Switch to Dark',
      welcomePage: 'Welcome',
      goBack: 'Go Back',
      goForward: 'Go Forward',
      refresh: 'Refresh',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All',
      copy: 'Copy',
      moreActions: 'More',
      home: 'Home',
      settings: 'Settings',
      settingsUpdate: 'Update Available',
      editLabel: 'Edit',
      edit: 'Edit in Editor',
      closeFolder: 'Close Folder',
    },
    tooltips: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      closeApp: 'Close',
    },
    actions: {
      toggleSidebar: 'Toggle Sidebar',
      toggleToc: 'Toggle TOC',
      toggleFocusMode: 'Focus Mode',
    },
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, disabled, tooltip, children, className, shortcut, icon, ...props }: any) =>
    React.createElement(
      'button',
      { onClick, disabled, title: tooltip, className, 'data-shortcut': shortcut, ...props },
      icon,
      children,
    ),
}));

vi.mock('../../../../ui/src/components/shared/ToolbarActionMenu', () => ({
  ToolbarActionMenu: ({ onHome, onTheme, onSettings, hasUpdate, isDark, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'toolbar-action-menu', 'data-has-update': String(hasUpdate), 'data-is-dark': String(isDark) },
      React.createElement('button', { onClick: onHome, 'data-testid': 'menu-home' }, 'Home'),
      React.createElement('button', { onClick: onTheme, 'data-testid': 'menu-theme' }, 'Theme'),
      React.createElement('button', { onClick: onSettings, 'data-testid': 'menu-settings' }, 'Settings'),
    ),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  ChevronLeftIcon: () => React.createElement('span', { 'data-testid': 'chevron-left-icon' }),
  ChevronRightIcon: () => React.createElement('span', { 'data-testid': 'chevron-right-icon' }),
  ExpandIcon: () => React.createElement('span', { 'data-testid': 'expand-icon' }),
  CollapseIcon: () => React.createElement('span', { 'data-testid': 'collapse-icon' }),
  CopyIcon: () => React.createElement('span', { 'data-testid': 'copy-icon' }),
  RefreshIcon: () => React.createElement('span', { 'data-testid': 'refresh-icon' }),
}));

vi.mock('../../../../ui/src/assets/logos/logo-128.png', () => ({
  default: 'logo.png',
}));

const defaultProps = {
  onSettingsOpen: vi.fn(),
  onExpandAll: vi.fn(),
  onCollapseAll: vi.fn(),
  onCopyFile: vi.fn(),
  hasUpdate: false,
};

describe('Topbar render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).electronAPI;
    mockCanGoBack = true;
    mockCanGoForward = false;
    mockState = {
      theme: 'light',
      isMaximized: false,
      relativePath: 'docs/guide/getting-started.md',
      currentFile: '/project/docs/guide/getting-started.md',
      appRuntime: 'web',
      settings: { language: 'en', keybindings: { back: 'Alt+Left', forward: 'Alt+Right', refresh: 'F5', expandAll: 'Ctrl+E', collapseAll: 'Ctrl+Shift+E', toggleTheme: 'Ctrl+T', settings: 'Ctrl+,', toggleSidebar: 'Ctrl+B', toggleToc: 'Ctrl+Shift+T', toggleFocusMode: 'F9', welcome: 'Ctrl+H' } },
      sidebarCollapsed: false,
      tocCollapsed: true,
      focusMode: false,
      toc: [],
      defaultExpanded: true,
      recentWorkspaces: [],
    };
  });

  it('renders the topbar header container', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    expect(container.querySelector('header.topbar')).toBeInTheDocument();
  });

  it('renders the logo image', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const img = container.querySelector('.topbar__logo-img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toBe('logo.png');
  });

  it('renders Markdown Explorer title text', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByText('Markdown Explorer')).toBeInTheDocument();
  });

  it('renders the-long-ride link in subtitle', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByText('the-long-ride')).toBeInTheDocument();
  });

  it('renders breadcrumb container with file path parts', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const breadcrumb = container.querySelector('.topbar__breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
    const parts = container.querySelectorAll('.topbar__breadcrumb-part');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the last breadcrumb part as bold', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const boldParts = container.querySelectorAll('.topbar__breadcrumb-part--bold');
    expect(boldParts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders breadcrumb separators', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const seps = container.querySelectorAll('.sep');
    expect(seps.length).toBeGreaterThanOrEqual(1);
  });

  it('renders no breadcrumb items for empty relativePath', () => {
    mockState.relativePath = '';
    mockState.currentFile = '';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const parts = container.querySelectorAll('.topbar__breadcrumb-part');
    expect(parts).toHaveLength(0);
  });

  it('renders Welcome Page breadcrumb for Welcome Page', () => {
    mockState.relativePath = 'Welcome Page';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const parts = container.querySelectorAll('.topbar__breadcrumb-part');
    expect(parts).toHaveLength(1);
    expect(parts[0].textContent).toBe('Welcome');
  });

  it('renders back navigation button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('chevron-left-icon')).toBeInTheDocument();
  });

  it('renders forward navigation button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
  });

  it('calls back when back button is clicked', () => {
    render(React.createElement(Topbar, defaultProps));
    const backIcon = screen.getByTestId('chevron-left-icon');
    fireEvent.click(backIcon.closest('button')!);
    expect(mockBack).toHaveBeenCalled();
  });

  it('calls forward when forward button is clicked', () => {
    mockCanGoForward = true;
    render(React.createElement(Topbar, defaultProps));
    const forwardIcon = screen.getByTestId('chevron-right-icon');
    fireEvent.click(forwardIcon.closest('button')!);
    expect(mockForward).toHaveBeenCalled();
  });

  it('disables back button when canGoBack is false', () => {
    mockCanGoBack = false;
    render(React.createElement(Topbar, defaultProps));
    const backIcon = screen.getByTestId('chevron-left-icon');
    const btn = backIcon.closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('disables forward button when canGoForward is false', () => {
    mockCanGoForward = false;
    render(React.createElement(Topbar, defaultProps));
    const forwardIcon = screen.getByTestId('chevron-right-icon');
    const btn = forwardIcon.closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('enables forward button when canGoForward is true', () => {
    mockCanGoForward = true;
    render(React.createElement(Topbar, defaultProps));
    const forwardIcon = screen.getByTestId('chevron-right-icon');
    const btn = forwardIcon.closest('button')!;
    expect(btn.disabled).toBe(false);
  });

  it('renders refresh button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });

  it('calls refresh when refresh button is clicked', () => {
    render(React.createElement(Topbar, defaultProps));
    const refreshIcon = screen.getByTestId('refresh-icon');
    fireEvent.click(refreshIcon.closest('button')!);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('renders the ToolbarActionMenu', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('toolbar-action-menu')).toBeInTheDocument();
  });

  it('calls toggleTheme via action menu theme button', () => {
    render(React.createElement(Topbar, defaultProps));
    fireEvent.click(screen.getByTestId('menu-theme'));
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('calls onSettingsOpen via action menu settings button', () => {
    render(React.createElement(Topbar, defaultProps));
    fireEvent.click(screen.getByTestId('menu-settings'));
    expect(defaultProps.onSettingsOpen).toHaveBeenCalled();
  });

  it('calls navigate(null) via action menu home button', () => {
    render(React.createElement(Topbar, defaultProps));
    fireEvent.click(screen.getByTestId('menu-home'));
    expect(mockNavigate).toHaveBeenCalledWith(null);
  });

  it('renders expand all button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('expand-icon')).toBeInTheDocument();
  });

  it('renders collapse all button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('collapse-icon')).toBeInTheDocument();
  });

  it('calls onExpandAll when expand button clicked', () => {
    render(React.createElement(Topbar, defaultProps));
    const expandIcon = screen.getByTestId('expand-icon');
    fireEvent.click(expandIcon.closest('button')!);
    expect(defaultProps.onExpandAll).toHaveBeenCalled();
  });

  it('calls onCollapseAll when collapse button clicked', () => {
    render(React.createElement(Topbar, defaultProps));
    const collapseIcon = screen.getByTestId('collapse-icon');
    fireEvent.click(collapseIcon.closest('button')!);
    expect(defaultProps.onCollapseAll).toHaveBeenCalled();
  });

  it('renders copy button', () => {
    render(React.createElement(Topbar, defaultProps));
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
  });

  it('calls onCopyFile when copy button clicked', () => {
    render(React.createElement(Topbar, defaultProps));
    const copyIcon = screen.getByTestId('copy-icon');
    fireEvent.click(copyIcon.closest('button')!);
    expect(defaultProps.onCopyFile).toHaveBeenCalled();
  });

  it('does not render window controls in web runtime', () => {
    mockState.appRuntime = 'web';
    const { container } = render(React.createElement(Topbar, defaultProps));
    expect(container.querySelector('.window-controls')).not.toBeInTheDocument();
  });

  it('renders window controls when running as desktop electron', () => {
    (window as any).electronAPI = {};
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    expect(container.querySelector('.window-controls')).toBeInTheDocument();
    delete (window as any).electronAPI;
  });

  it('sends window-minimize message on minimize click', () => {
    (window as any).electronAPI = {};
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const btns = container.querySelectorAll('.window-control-btn');
    fireEvent.click(btns[0]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-minimize' });
    delete (window as any).electronAPI;
  });

  it('sends window-maximize message on maximize click', () => {
    (window as any).electronAPI = {};
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const btns = container.querySelectorAll('.window-control-btn');
    fireEvent.click(btns[1]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-maximize' });
    delete (window as any).electronAPI;
  });

  it('sends window-close message on close click', () => {
    (window as any).electronAPI = {};
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const btns = container.querySelectorAll('.window-control-btn');
    fireEvent.click(btns[2]);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-close' });
    delete (window as any).electronAPI;
  });

  it('renders Close Folder button in desktop runtime', () => {
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const closeFolders = container.querySelectorAll('button[title="Close Folder"]');
    expect(closeFolders.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Close Folder button in chrome runtime', () => {
    mockState.appRuntime = 'chrome';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const closeFolders = container.querySelectorAll('button[title="Close Folder"]');
    expect(closeFolders.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render Close Folder button in web runtime', () => {
    mockState.appRuntime = 'web';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const closeFolders = container.querySelectorAll('button[title="Close Folder"]');
    expect(closeFolders).toHaveLength(0);
  });

  it('dispatches READY_ACK and sends closeWorkspace on Close Folder click', () => {
    mockState.appRuntime = 'desktop';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const btn = container.querySelector('button[title="Close Folder"]') as HTMLElement;
    fireEvent.click(btn);
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
  });

  it('renders is-dark true when theme is dark', () => {
    mockState.theme = 'dark';
    render(React.createElement(Topbar, defaultProps));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-is-dark')).toBe('true');
  });

  it('renders is-dark false when theme is light', () => {
    mockState.theme = 'light';
    render(React.createElement(Topbar, defaultProps));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-is-dark')).toBe('false');
  });

  it('detects dark mode from auto theme with prefers-color-scheme dark', () => {
    mockState.theme = 'auto';
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    render(React.createElement(Topbar, defaultProps));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-is-dark')).toBe('true');
  });

  it('detects light mode from auto theme with prefers-color-scheme light', () => {
    mockState.theme = 'auto';
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
    render(React.createElement(Topbar, defaultProps));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-is-dark')).toBe('false');
  });

  it('passes hasUpdate=true to ToolbarActionMenu', () => {
    render(React.createElement(Topbar, { ...defaultProps, hasUpdate: true }));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-has-update')).toBe('true');
  });

  it('passes hasUpdate=false by default', () => {
    render(React.createElement(Topbar, defaultProps));
    const menu = screen.getByTestId('toolbar-action-menu');
    expect(menu.getAttribute('data-has-update')).toBe('false');
  });

  it('renders tooltip text for breakable path', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const tooltip = container.querySelector('.tooltip-text');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip?.textContent).toContain('getting-started.md');
  });

  it('does not render tooltip text for Welcome Page', () => {
    mockState.relativePath = 'Welcome Page';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const tooltip = container.querySelector('.tooltip-text');
    expect(tooltip).not.toBeInTheDocument();
  });

  it('does not render tooltip text for empty relativePath', () => {
    mockState.relativePath = '';
    mockState.currentFile = '';
    const { container } = render(React.createElement(Topbar, defaultProps));
    const tooltip = container.querySelector('.tooltip-text');
    expect(tooltip).not.toBeInTheDocument();
  });

  it('renders divider elements between button groups', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    const dividers = container.querySelectorAll('.topbar__divider');
    expect(dividers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders breadcrumb container element', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    expect(container.querySelector('.topbar__breadcrumb-container')).toBeInTheDocument();
  });

  it('renders actions container', () => {
    const { container } = render(React.createElement(Topbar, defaultProps));
    expect(container.querySelector('.topbar__actions')).toBeInTheDocument();
  });
});
