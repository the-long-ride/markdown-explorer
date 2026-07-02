import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { DesktopTab } from '../../../../ui/src/desktop/types';

const mockPostMessage = vi.fn();
const mockOpenInEditor = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();

let mockAppState: any;

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
    dispatch: vi.fn(),
    navigate: vi.fn(),
    refresh: vi.fn(),
    activateContentTab: vi.fn(),
    closeContentTab: vi.fn(),
    closeContentTabsToRight: vi.fn(),
    closeOtherContentTabs: vi.fn(),
    closeAllContentTabs: vi.fn(),
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

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({
  TabContextMenu: ({ onAction, onClose, disabled }: any) => (
    <div data-testid="tab-context-menu">
      <button data-testid="ctx-close-this" disabled={disabled?.closeThisTab} onClick={() => onAction('closeThisTab')}>Close</button>
      <button data-testid="ctx-close-right" disabled={disabled?.closeTabsToRight} onClick={() => onAction('closeTabsToRight')}>Close right</button>
      <button data-testid="ctx-close-others" disabled={disabled?.closeOtherTabs} onClick={() => onAction('closeOtherTabs')}>Close others</button>
      <button data-testid="ctx-close-all" disabled={disabled?.closeAllTabs} onClick={() => onAction('closeAllTabs')}>Close all</button>
      <button data-testid="ctx-dismiss" onClick={onClose}>Dismiss</button>
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

vi.mock('../../../../ui/src/assets/logos/logo-128.png', () => ({
  default: 'logo.png',
}));

import { DesktopTabBar } from '../../../../ui/src/components/Desktop/DesktopTabBar';

describe('DesktopTabBar interactions', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = createMockAppState();

    const homeTab = makeDesktopTab('home', 'home');
    const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'Docs' });
    const ws2 = makeDesktopTab('ws2', 'workspace', { workspaceName: 'Guides' });

    props = {
      tabs: [homeTab, ws1, ws2],
      activeTabId: 'ws1',
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
      isDark: false,
      isMaximized: false,
      hasUpdate: false,
    };
  });

  function renderTabBar(overrides: Partial<typeof props> = {}) {
    return render(React.createElement(DesktopTabBar, { ...props, ...overrides }));
  }

  it('switches active tab when a workspace tab is clicked', () => {
    renderTabBar();
    const [, ws2Tab] = screen.getAllByRole('tab');
    fireEvent.click(ws2Tab);
    expect(props.onSelectTab).toHaveBeenCalledTimes(1);
    expect(props.onSelectTab).toHaveBeenCalledWith('ws2');
  });

  it('opens a new tab when the new-tab button is clicked', () => {
    renderTabBar();
    fireEvent.click(screen.getByLabelText('New tab'));
    expect(props.onNewTab).toHaveBeenCalledTimes(1);
  });

  it('navigates to the home tab from the toolbar action menu', () => {
    renderTabBar();
    fireEvent.click(screen.getByTestId('menu-home'));
    expect(props.onSelectTab).toHaveBeenCalledTimes(1);
    expect(props.onSelectTab).toHaveBeenCalledWith('home');
  });

  it('closes a tab when its close button is clicked', () => {
    renderTabBar();
    const closeButtons = screen.getAllByLabelText('Close tab');
    fireEvent.click(closeButtons[1]);
    expect(props.onCloseTab).toHaveBeenCalledTimes(1);
    expect(props.onCloseTab).toHaveBeenCalledWith('ws2');
    expect(props.onSelectTab).not.toHaveBeenCalled();
  });

  it('right-clicking a tab opens the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 42, clientY: 84 });
    expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
  });

  it('closes the target tab from the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByTestId('ctx-close-this'));
    expect(props.onCloseTab).toHaveBeenCalledTimes(1);
    expect(props.onCloseTab).toHaveBeenCalledWith('ws1');
  });

  it('closes tabs to the right from the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByTestId('ctx-close-right'));
    expect(props.onCloseTabsToRight).toHaveBeenCalledTimes(1);
    expect(props.onCloseTabsToRight).toHaveBeenCalledWith('ws1');
  });

  it('closes other tabs from the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByTestId('ctx-close-others'));
    expect(props.onCloseOtherTabs).toHaveBeenCalledTimes(1);
    expect(props.onCloseOtherTabs).toHaveBeenCalledWith('ws1');
  });

  it('closes all tabs from the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByTestId('ctx-close-all'));
    expect(props.onCloseAllTabs).toHaveBeenCalledTimes(1);
  });

  it('enters alias edit mode when a workspace tab label is double-clicked', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.doubleClick(ws1Tab);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Docs');
  });

  it('commits alias change when the alias input is blurred', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.doubleClick(ws1Tab);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.blur(input);
    expect(props.onAliasChange).toHaveBeenCalledTimes(1);
    expect(props.onAliasChange).toHaveBeenCalledWith('ws1', 'Renamed');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('commits alias change when Enter is pressed in the alias input', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.doubleClick(ws1Tab);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'EnterAlias' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAliasChange).toHaveBeenCalledTimes(1);
    expect(props.onAliasChange).toHaveBeenCalledWith('ws1', 'EnterAlias');
  });

  it('cancels alias edit when Escape is pressed', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.doubleClick(ws1Tab);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onAliasChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
