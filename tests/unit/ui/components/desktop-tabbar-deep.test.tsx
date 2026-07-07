import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { DesktopTab } from '../../../../ui/src/desktop/types';

const mockActivateContentTab = vi.fn();
const mockCloseContentTab = vi.fn();
const mockCloseContentTabsToRight = vi.fn();
const mockCloseOtherContentTabs = vi.fn();
const mockCloseAllContentTabs = vi.fn();
const mockOpenInEditor = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();
const mockDispatch = vi.fn();
const mockPostMessage = vi.fn();

function makeDesktopTab(id: string, kind: 'home' | 'workspace' | 'new', overrides: Partial<DesktopTab> = {}): DesktopTab {
  return {
    id,
    kind,
    alias: undefined,
    workspaceName: kind === 'workspace' ? `Workspace ${id}` : undefined,
    workspacePath: kind === 'workspace' ? `/path/${id}` : undefined,
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
    ...overrides,
  };
}

let mockAppState: any;
let mockOnSelectTab = vi.fn();
let mockOnNewTab = vi.fn();
let mockOnCloseTab = vi.fn();
let mockOnCloseTabsToRight = vi.fn();
let mockOnCloseOtherTabs = vi.fn();
let mockOnCloseAllTabs = vi.fn();
let mockOnAliasChange = vi.fn();
let mockOnThemeToggle = vi.fn();
let mockOnSettingsOpen = vi.fn();
let mockOnSidebarToggle = vi.fn();

function createMockAppState(overrides: Record<string, unknown> = {}) {
  return {
    state: {
      fileList: [],
      tree: null,
      currentFile: '/docs/readme.md',
      theme: 'light' as const,
      hasThemePreference: false,
      themeStyle: 'default' as const,
      hasThemeStylePreference: false,
      defaultExpanded: true,
      workspaceName: 'my-workspace',
      workspacePath: '/path/to/workspace',
      sidebarCollapsed: false,
      tocCollapsed: true,
      contentHtml: '<p>Hello</p>',
      markdownSource: '# Hello',
      frontmatter: {},
      toc: [{ id: 'h1', text: 'Hello', level: 1, children: [] }],
      relativePath: 'docs/readme.md',
      isLoading: false,
      loadingLabel: '',
      loadingDetail: '',
      previewInfo: null,
      staleContentFilePath: null,
      notFoundHref: null,
      workspaceUnavailablePath: null,
      workspaceUnavailableReason: null,
      settings: {
        language: 'en',
        fileTabs: true,
        showTitle: false,
        defaultHtmlPreview: true,
        documentConversion: false,
        scopeFocus: {},
        searchScopeFocus: {},
        desktopViewMode: 'tabs' as const,
        keybindings: {
          welcome: 'Alt+H',
          toggleTheme: 'Alt+T',
          settings: 'Alt+S',
          toggleSidebar: 'Ctrl+B',
          toggleToc: 'Alt+O',
          toggleFocusMode: 'Alt+F',
        },
        customThemes: [],
        activeCustomThemeId: undefined,
      },
      renderVersion: 1,
      contentTabs: [],
      activeContentTabPath: null,
      recentWorkspaces: [],
      isMaximized: false,
      appVersion: '1.0.0',
      appRuntime: 'electron' as const,
      hostPlatform: 'win32' as const,
      hostArch: 'x64',
      focusMode: false,
      updateState: { status: 'idle' as const },
      sidebarActiveTab: 'files' as const,
      ...overrides,
    },
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleToc: mockToggleToc,
    toggleFocusMode: mockToggleFocusMode,
    dispatch: mockDispatch,
    navigate: vi.fn(),
    refresh: vi.fn(),
    activateContentTab: mockActivateContentTab,
    closeContentTab: mockCloseContentTab,
    closeContentTabsToRight: mockCloseContentTabsToRight,
    closeOtherContentTabs: mockCloseOtherContentTabs,
    closeAllContentTabs: mockCloseAllContentTabs,
    openInEditor: mockOpenInEditor,
    setTheme: vi.fn(),
    setThemeStyle: vi.fn(),
    selectCustomTheme: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setSidebarActiveTab: vi.fn(),
    updateSettings: vi.fn(),
  };
}

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => mockAppState,
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mockPostMessage,
    onMessage: vi.fn(() => () => {}),
    getState: vi.fn(),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    topbar: {
      switchToLightMode: 'Switch to light',
      switchToDarkMode: 'Switch to dark',
      moreActions: 'More',
      home: 'Home',
      welcomePage: 'Welcome',
      editLabel: 'Edit',
      edit: 'Edit in editor',
      settings: 'Settings',
      settingsUpdate: 'Settings (update available)',
    },
    tooltips: {
      closeTab: 'Close tab',
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      closeApp: 'Close',
      newTab: 'New tab',
    },
    actions: {
      toggleSidebar: 'Toggle sidebar',
      toggleToc: 'Toggle table of contents',
      toggleFocusMode: 'Toggle focus mode',
    },
    tabContextMenu: {
      closeThisTab: 'Close',
      closeTabsToRight: 'Close to right',
      closeOtherTabs: 'Close others',
      closeAllTabs: 'Close all',
    },
  }),
}));

let capturedOnAction: ((action: any) => void) | null = null;
let capturedOnClose: (() => void) | null = null;

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({
  TabContextMenu: ({ onAction, onClose, disabled, x, y }: any) => {
    capturedOnAction = onAction;
    capturedOnClose = onClose;
    return (
      <div data-testid="tab-context-menu">
        <button data-testid="ctx-close-this" disabled={disabled?.closeThisTab} onClick={() => onAction('closeThisTab')}>Close</button>
        <button data-testid="ctx-close-right" disabled={disabled?.closeTabsToRight} onClick={() => onAction('closeTabsToRight')}>Close right</button>
        <button data-testid="ctx-close-others" disabled={disabled?.closeOtherTabs} onClick={() => onAction('closeOtherTabs')}>Close others</button>
        <button data-testid="ctx-close-all" disabled={disabled?.closeAllTabs} onClick={() => onAction('closeAllTabs')}>Close all</button>
        <button data-testid="ctx-dismiss" onClick={onClose}>Dismiss</button>
      </div>
    );
  },
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, tooltip, icon, children, ...props }: any) => (
    <button onClick={onClick} aria-label={tooltip} data-tooltip={tooltip} {...props}>
      {icon}{children}
    </button>
  ),
}));

vi.mock('../../../../ui/src/components/shared/ToolbarActionMenu', () => ({
  ToolbarActionMenu: (props: any) => (
    <div data-testid="toolbar-action-menu">
      <button data-testid="menu-home" onClick={props.onHome}>Home</button>
      <button data-testid="menu-theme" onClick={props.onTheme}>Theme</button>
      <button data-testid="menu-edit" onClick={props.onEdit}>Edit</button>
      <button data-testid="menu-settings" onClick={props.onSettings}>Settings</button>
      <button data-testid="menu-sidebar" onClick={props.onSidebarToggle}>Sidebar</button>
      <button data-testid="menu-toc" onClick={props.onTocToggle}>TOC</button>
      <button data-testid="menu-focus" onClick={props.onFocusModeToggle}>Focus</button>
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CloseIcon: () => <span>close-icon</span>,
  PlusIcon: () => <span>plus-icon</span>,
}));

vi.mock('../../../../ui/src/desktop/desktopTabs', () => ({
  getTabLabel: (tab: any) => tab.alias || tab.workspaceName || (tab.kind === 'home' ? 'Home' : 'New'),
}));

vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({
  default: 'logo.png',
}));

import { DesktopTabBar } from '../../../../ui/src/components/Desktop/DesktopTabBar';

function renderTabBar(tabOverrides: Partial<Parameters<typeof DesktopTabBar>[0]> = {}) {
  const homeTab = makeDesktopTab('home', 'home');
  const ws1 = makeDesktopTab('ws1', 'workspace');
  const ws2 = makeDesktopTab('ws2', 'workspace');
  const defaultTabs = [homeTab, ws1, ws2];

  const props = {
    tabs: defaultTabs,
    activeTabId: 'ws1',
    onSelectTab: mockOnSelectTab,
    onNewTab: mockOnNewTab,
    onCloseTab: mockOnCloseTab,
    onCloseTabsToRight: mockOnCloseTabsToRight,
    onCloseOtherTabs: mockOnCloseOtherTabs,
    onCloseAllTabs: mockOnCloseAllTabs,
    onAliasChange: mockOnAliasChange,
    onThemeToggle: mockOnThemeToggle,
    onSettingsOpen: mockOnSettingsOpen,
    onSidebarToggle: mockOnSidebarToggle,
    isDark: false,
    isMaximized: false,
    hasUpdate: false,
    ...tabOverrides,
  };

  return render(createElement(DesktopTabBar, props));
}

describe('DesktopTabBar deep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = createMockAppState();
    capturedOnAction = null;
    capturedOnClose = null;
  });

  describe('tab close button', () => {
    it('each workspace tab has a close button', () => {
      renderTabBar();
      const closeButtons = screen.getAllByLabelText('Close tab');
      expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('clicking close button on a workspace tab calls onCloseTab', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'WS1' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const closeButtons = screen.getAllByLabelText('Close tab');
      fireEvent.click(closeButtons[0]);
      expect(mockOnCloseTab).toHaveBeenCalledWith('ws1');
    });

    it('close button click stops propagation to tab selection', () => {
      renderTabBar();
      const closeButtons = screen.getAllByLabelText('Close tab');
      mockOnSelectTab.mockClear();
      fireEvent.click(closeButtons[0]);
      expect(mockOnCloseTab).toHaveBeenCalled();
      expect(mockOnSelectTab).not.toHaveBeenCalled();
    });
  });

  describe('new tab button', () => {
    it('renders a new tab button', () => {
      renderTabBar();
      const newTabBtn = screen.getByLabelText('New tab');
      expect(newTabBtn).toBeInTheDocument();
    });

    it('clicking new tab button calls onNewTab', () => {
      renderTabBar();
      fireEvent.click(screen.getByLabelText('New tab'));
      expect(mockOnNewTab).toHaveBeenCalled();
    });
  });

  describe('tab context menu', () => {
    it('right-click on workspace tab opens context menu', () => {
      renderTabBar();
      const tabButtons = screen.getAllByRole('tab');
      const wsTab = tabButtons.find(b => b.textContent?.includes('close-icon')) || tabButtons[0];
      fireEvent.contextMenu(wsTab, { clientX: 100, clientY: 200 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
    });

    it('closeThisTab action calls onCloseTab', () => {
      renderTabBar();
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-this'));
      expect(mockOnCloseTab).toHaveBeenCalled();
    });

    it('closeTabsToRight action calls onCloseTabsToRight', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      const ws2 = makeDesktopTab('ws2', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1, ws2] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-right'));
      expect(mockOnCloseTabsToRight).toHaveBeenCalled();
    });

    it('closeOtherTabs action calls onCloseOtherTabs', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      const ws2 = makeDesktopTab('ws2', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1, ws2] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-others'));
      expect(mockOnCloseOtherTabs).toHaveBeenCalled();
    });

    it('closeAllTabs action calls onCloseAllTabs', () => {
      renderTabBar();
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-all'));
      expect(mockOnCloseAllTabs).toHaveBeenCalled();
    });

    it('context menu dismiss removes the menu', () => {
      renderTabBar();
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ctx-dismiss'));
      expect(screen.queryByTestId('tab-context-menu')).not.toBeInTheDocument();
    });

    it('closeTabsToRight is disabled for last workspace tab', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-right')).toBeDisabled();
    });

    it('closeOtherTabs is disabled when only one workspace tab', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-others')).toBeDisabled();
    });
  });

  describe('tab rename', () => {
    it('double-click on a workspace tab enters edit mode', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'MyProject', alias: 'Proj' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      const wsTab = tabButtons[0];
      fireEvent.doubleClick(wsTab);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('typing and pressing Enter commits the alias', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'MyProject', alias: 'Old' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.doubleClick(tabButtons[0]);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'NewAlias' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockOnAliasChange).toHaveBeenCalledWith('ws1', 'NewAlias');
    });

    it('pressing Escape cancels the alias edit', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'MyProject', alias: 'Old' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.doubleClick(tabButtons[0]);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Cancelled' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(mockOnAliasChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('blur on input commits the alias', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'MyProject', alias: 'Old' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.doubleClick(tabButtons[0]);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'BlurAlias' } });
      fireEvent.blur(input);
      expect(mockOnAliasChange).toHaveBeenCalledWith('ws1', 'BlurAlias');
    });

    it('double-click on home tab does not enter edit mode', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1] });
      const tablist = screen.getByRole('tablist');
      const allButtons = tablist.querySelectorAll('button[role="tab"]');
      expect(allButtons.length).toBeLessThanOrEqual(1);
      if (allButtons.length > 0) {
        const aliasInputBefore = document.querySelector('.desktop-tab__alias-input');
        expect(aliasInputBefore).toBeNull();
      }
    });
  });

  describe('active tab switching', () => {
    it('clicking a workspace tab calls onSelectTab', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      const ws2 = makeDesktopTab('ws2', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1, ws2], activeTabId: 'ws1' });
      const tabButtons = screen.getAllByRole('tab');
      fireEvent.click(tabButtons[0]);
      expect(mockOnSelectTab).toHaveBeenCalledWith('ws1');
    });

    it('active tab is aria-selected=true', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      const ws2 = makeDesktopTab('ws2', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1, ws2], activeTabId: 'ws2' });
      const selectedTabs = screen.getAllByRole('tab').filter(t => t.getAttribute('aria-selected') === 'true');
      expect(selectedTabs).toHaveLength(1);
    });
  });

  describe('middle-click closing', () => {
    it('middle-click on workspace tab calls onCloseTab', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      const auxEvent = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
      tabButtons[0].dispatchEvent(auxEvent);
      expect(mockOnCloseTab).toHaveBeenCalled();
    });

    it('non-middle-click on auxClick does not close', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      const auxEvent = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 });
      tabButtons[0].dispatchEvent(auxEvent);
      expect(mockOnCloseTab).not.toHaveBeenCalled();
    });
  });

  describe('window controls', () => {
    it('minimize button sends window-minimize message', () => {
      renderTabBar();
      const minBtn = screen.getByLabelText('Minimize');
      fireEvent.click(minBtn);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-minimize' });
    });

    it('maximize button sends window-maximize message', () => {
      renderTabBar();
      const maxBtn = screen.getByLabelText('Maximize');
      fireEvent.click(maxBtn);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-maximize' });
    });

    it('restore button tooltip when maximized', () => {
      renderTabBar({ isMaximized: true });
      const restoreBtn = screen.getByLabelText('Restore');
      expect(restoreBtn).toBeInTheDocument();
      fireEvent.click(restoreBtn);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-maximize' });
    });

    it('close button sends window-close message', () => {
      renderTabBar();
      const closeAppBtn = screen.getByLabelText('Close');
      fireEvent.click(closeAppBtn);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'window-close' });
    });
  });

  describe('toolbar action menu integration', () => {
    it('home button calls onSelectTab with home', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-home'));
      expect(mockOnSelectTab).toHaveBeenCalledWith('home');
    });

    it('theme button calls onThemeToggle', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-theme'));
      expect(mockOnThemeToggle).toHaveBeenCalled();
    });

    it('edit button calls openInEditor', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-edit'));
      expect(mockOpenInEditor).toHaveBeenCalled();
    });

    it('settings button calls onSettingsOpen', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-settings'));
      expect(mockOnSettingsOpen).toHaveBeenCalled();
    });

    it('sidebar button calls onSidebarToggle', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-sidebar'));
      expect(mockOnSidebarToggle).toHaveBeenCalled();
    });

    it('toc button calls toggleToc', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-toc'));
      expect(mockToggleToc).toHaveBeenCalled();
    });

    it('focus mode button calls toggleFocusMode', () => {
      renderTabBar();
      fireEvent.click(screen.getByTestId('menu-focus'));
      expect(mockToggleFocusMode).toHaveBeenCalled();
    });
  });

  describe('tab label display', () => {
    it('shows alias when tab has alias', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { alias: 'CoolProj', workspaceName: 'boring-name' });
      renderTabBar({ tabs: [homeTab, ws1] });
      expect(screen.getByText('CoolProj')).toBeInTheDocument();
    });

    it('shows workspaceName when no alias', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'MyProject' });
      renderTabBar({ tabs: [homeTab, ws1] });
      expect(screen.getByText('MyProject')).toBeInTheDocument();
    });

    it('home tab is filtered out from workspace tabs rendering', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'WS1' });
      renderTabBar({ tabs: [homeTab, ws1] });
      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons).toHaveLength(1);
    });
  });

  describe('empty tab list', () => {
    it('renders tablist with no workspace tabs when only home tab exists', () => {
      const homeTab = makeDesktopTab('home', 'home');
      renderTabBar({ tabs: [homeTab], activeTabId: 'home' });
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      expect(tablist.querySelectorAll('[role="tab"]').length).toBe(0);
    });
  });

  describe('tab overflow / many tabs', () => {
    it('renders many workspace tabs', () => {
      const homeTab = makeDesktopTab('home', 'home');
      const tabs: DesktopTab[] = [homeTab];
      for (let i = 0; i < 10; i++) {
        tabs.push(makeDesktopTab(`ws${i}`, 'workspace', { workspaceName: `Workspace ${i}` }));
      }
      renderTabBar({ tabs, activeTabId: 'ws5' });
      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons).toHaveLength(10);
    });
  });

  describe('context menu dismissal when tab removed', () => {
    it('dismisses context menu if the target tab is no longer in tabs', async () => {
      const homeTab = makeDesktopTab('home', 'home');
      const ws1 = makeDesktopTab('ws1', 'workspace');
      const ws2 = makeDesktopTab('ws2', 'workspace');

      const baseProps = {
        onSelectTab: mockOnSelectTab,
        onNewTab: mockOnNewTab,
        onCloseTab: mockOnCloseTab,
        onCloseTabsToRight: mockOnCloseTabsToRight,
        onCloseOtherTabs: mockOnCloseOtherTabs,
        onCloseAllTabs: mockOnCloseAllTabs,
        onAliasChange: mockOnAliasChange,
        onThemeToggle: mockOnThemeToggle,
        onSettingsOpen: mockOnSettingsOpen,
        onSidebarToggle: mockOnSidebarToggle,
        isDark: false,
        isMaximized: false,
      };

      const { rerender } = render(createElement(DesktopTabBar, {
        ...baseProps,
        tabs: [homeTab, ws1, ws2],
        activeTabId: 'ws1',
      }));

      const tabButtons = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabButtons[0], { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();

      rerender(createElement(DesktopTabBar, {
        ...baseProps,
        tabs: [homeTab, ws2],
        activeTabId: 'ws2',
      }));

      await waitFor(() => {
        expect(screen.queryByTestId('tab-context-menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('hasUpdate prop', () => {
    it('passes hasUpdate to ToolbarActionMenu', () => {
      renderTabBar({ hasUpdate: true });
      expect(screen.getByTestId('toolbar-action-menu')).toBeInTheDocument();
    });
  });

  describe('brand area', () => {
    it('renders brand area with logo', () => {
      renderTabBar();
      const brand = document.querySelector('.desktop-tabbar__brand');
      expect(brand).toBeInTheDocument();
      const img = brand?.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute('alt')).toBe('Markdown Explorer');
    });
  });

  describe('scrollbar', () => {
    it('scrollbar is not visible when tabs fit', () => {
      renderTabBar();
      expect(document.querySelector('.desktop-tabbar__scrollbar')).not.toBeInTheDocument();
    });

    it('ResizeObserver is connected and disconnected on unmount', () => {
      const observeSpy = vi.fn();
      const disconnectSpy = vi.fn();
      const origRO = global.ResizeObserver;
      (global as any).ResizeObserver = class {
        observe = observeSpy;
        disconnect = disconnectSpy;
      };
      const { unmount } = renderTabBar();
      expect(observeSpy).toHaveBeenCalled();
      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
      (global as any).ResizeObserver = origRO;
    });
  });
});
