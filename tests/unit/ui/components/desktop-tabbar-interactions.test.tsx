import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
        defaultCsvPreview: true,
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
      appRuntime: 'desktop' as const,
      hostPlatform: 'windows' as const,
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

vi.mock('../../../../ui/src/contexts/translations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      topbar: { ...en.topbar,
        switchToLightMode: 'Switch to light',
        switchToDarkMode: 'Switch to dark',
        moreActions: 'More',
        home: 'Home',
        welcomePage: 'Welcome',
        editLabel: 'Edit',
        edit: 'Edit in editor',
        settings: 'Settings',
        settingsUpdate: 'Settings (update available)',
        goBack: 'Back',
        goForward: 'Forward',
        refresh: 'Refresh',
        collapseAll: 'Collapse all',
        expandAll: 'Expand all',
        copy: 'Copy file content',
      },
      tooltips: { ...en.tooltips,
        closeTab: 'Close tab',
        minimize: 'Minimize',
        maximize: 'Maximize',
        restore: 'Restore',
        closeApp: 'Close',
        newTab: 'New tab',
      },
      actions: { ...en.actions,
        toggleSidebar: 'Toggle sidebar',
        toggleToc: 'Toggle table of contents',
        toggleFocusMode: 'Toggle focus mode',
      },
      tabContextMenu: { ...en.tabContextMenu,
        closeThisTab: 'Close',
        closeTabsToRight: 'Close to right',
        closeOtherTabs: 'Close others',
        closeAllTabs: 'Close all',
        showInFileExplorer: 'Show in File Explorer',
        openInFinder: 'Open in Finder',
        revealInFinder: 'Reveal in Finder',
        showInFileManager: 'Show in File Manager',
      },
    }),
  };
});

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, tooltip, icon, children, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) => (
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
      {props.showFullscreen && <button data-testid="menu-fullscreen" onClick={props.onFullscreenToggle}>Show full screen</button>}
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({
  TabContextMenu: ({ onAction, onClose, disabled, shortcuts }: any) => (
    <div data-testid="tab-context-menu" data-shortcuts={shortcuts && Object.values(shortcuts).some(Boolean) ? 'present' : 'absent'}>
      <button data-testid="ctx-close-this" disabled={disabled?.closeThisTab} onClick={() => onAction('closeThisTab')}>Close</button>
      <button data-testid="ctx-close-right" disabled={disabled?.closeTabsToRight} onClick={() => onAction('closeTabsToRight')}>Close right</button>
      <button data-testid="ctx-close-others" disabled={disabled?.closeOtherTabs} onClick={() => onAction('closeOtherTabs')}>Close others</button>
      <button data-testid="ctx-close-all" disabled={disabled?.closeAllTabs} onClick={() => onAction('closeAllTabs')}>Close all</button>
      <button data-testid="ctx-dismiss" onClick={onClose}>Dismiss</button>
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/shared/icons', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    ChevronLeftIcon: () => <span>back-icon</span>,
    ChevronRightIcon: () => <span>forward-icon</span>,
    CollapseIcon: () => <span>collapse-icon</span>,
    CopyIcon: () => <span>copy-icon</span>,
    ExpandIcon: () => <span>expand-icon</span>,
    RefreshIcon: () => <span>refresh-icon</span>,
    CloseIcon: () => <span>close-icon</span>,
    OpenFolderLocationIcon: () => <span>open-folder-icon</span>,
    PlusIcon: () => <span>plus-icon</span>,
  };
});

vi.mock('../../../../ui/src/desktop/desktopTabs', () => ({
  getTabLabel: (tab: any) => tab.alias || tab.workspaceName || (tab.kind === 'home' ? 'Home' : 'New'),
}));

vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({
  default: 'logo.png',
}));

import { DesktopTabBar } from '../../../../ui/src/components/Desktop/DesktopTabBar';

describe('DesktopTabBar interactions', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = createMockAppState();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    const homeTab = makeDesktopTab('home', 'home');
    const ws1 = makeDesktopTab('ws1', 'workspace', { workspaceName: 'Docs' });
    const ws2 = makeDesktopTab('ws2', 'workspace', { workspaceName: 'Guides' });

    props = {
      tabs: [homeTab, ws1, ws2],
      activeTabId: 'ws1',
      onSelectTab: vi.fn(),
      onNewTab: vi.fn(),
      onCloseTab: vi.fn(),
      onReorderTabs: vi.fn(),
      onCloseTabsToRight: vi.fn(),
      onCloseOtherTabs: vi.fn(),
      onCloseAllTabs: vi.fn(),
      onAliasChange: vi.fn(),
      onThemeToggle: vi.fn(),
      onSettingsOpen: vi.fn(),
      onSidebarToggle: vi.fn(),
      onBack: vi.fn(),
      onForward: vi.fn(),
      onRefresh: vi.fn(),
      canGoBack: true,
      canGoForward: true,
      onCollapseAll: vi.fn(),
      onExpandAll: vi.fn(),
      onCopyFile: vi.fn(),
      isDark: false,
      isMaximized: false,
      hasUpdate: false,
    };
  });

  function renderTabBar(overrides: Partial<typeof props> = {}) {
    return render(React.createElement(DesktopTabBar, { ...props, ...overrides }));
  }

  it('keeps unused tab-bar space draggable while controls remain interactive', () => {
    const css = readFileSync(
      resolve(__dirname, '../../../../ui/src/styles/global/global-topbar-tabs.css'),
      'utf8',
    );

    expect(css).toMatch(
      /\.desktop-tabbar__tabs-wrap\s*\{[^}]*-webkit-app-region:\s*drag;/s,
    );
    expect(css).toMatch(
      /\.desktop-tabbar__tabs\s*\{[^}]*-webkit-app-region:\s*drag;/s,
    );
    expect(css).toMatch(
      /\.desktop-tabbar__scrollbar\s*\{[^}]*-webkit-app-region:\s*no-drag;/s,
    );
  });

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

  it('reorders workspace tabs on drop', () => {
    renderTabBar();
    const [ws1Tab, ws2Tab] = screen.getAllByRole('tab');
    fireEvent.pointerDown(ws2Tab, { button: 0 });
    fireEvent.pointerEnter(ws1Tab);
    fireEvent.pointerUp(document);
    expect(props.onReorderTabs).toHaveBeenCalledWith('ws2', 'ws1');
  });

  it('toggles fullscreen from the toolbar action menu', () => {
    const onFullscreenToggle = vi.fn();
    renderTabBar({ onFullscreenToggle });
    fireEvent.click(screen.getByTestId('menu-fullscreen'));
    expect(onFullscreenToggle).toHaveBeenCalledTimes(1);
  });

  it('closes a tab when its close button is clicked', () => {
    renderTabBar();
    const closeButtons = screen.getAllByLabelText('Close tab');
    fireEvent.click(closeButtons[1]);
    expect(props.onCloseTab).toHaveBeenCalledTimes(1);
    expect(props.onCloseTab).toHaveBeenCalledWith('ws2');
    expect(props.onSelectTab).not.toHaveBeenCalled();
  });

  it('fades then collapses a closing workspace tab before invoking the callback', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    try {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
      renderTabBar();
      const closeButtons = screen.getAllByLabelText('Close tab');
      const tab = screen.getAllByRole('tab')[1];

      fireEvent.click(closeButtons[1]);
      expect(props.onCloseTab).not.toHaveBeenCalled();
      expect(tab).toHaveClass('is-closing--fade');

      act(() => vi.advanceTimersByTime(90));
      expect(tab).toHaveClass('is-closing--collapse');
      expect(props.onCloseTab).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(140));
      expect(props.onCloseTab).toHaveBeenCalledWith('ws2');
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('animates every tab removed by a bulk close action', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    try {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
      const ws3 = makeDesktopTab('ws3', 'workspace', { workspaceName: 'API' });
      renderTabBar({ tabs: [...props.tabs, ws3] });
      const [ws1Tab, ws2Tab, ws3Tab] = screen.getAllByRole('tab');
      fireEvent.contextMenu(ws1Tab, { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-right'));

      expect(ws2Tab).toHaveClass('is-closing--fade');
      expect(ws3Tab).toHaveClass('is-closing--fade');
      expect(props.onCloseTabsToRight).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(230));
      expect(props.onCloseTabsToRight).toHaveBeenCalledWith('ws1');
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('animates every tab removed by close-other-tabs', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    try {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
      const ws3 = makeDesktopTab('ws3', 'workspace', { workspaceName: 'API' });
      renderTabBar({ tabs: [...props.tabs, ws3] });
      const [ws1Tab, ws2Tab, ws3Tab] = screen.getAllByRole('tab');
      fireEvent.contextMenu(ws2Tab, { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-others'));

      expect(ws1Tab).toHaveClass('is-closing--fade');
      expect(ws2Tab).not.toHaveClass('is-closing--fade');
      expect(ws3Tab).toHaveClass('is-closing--fade');
      expect(props.onCloseOtherTabs).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(230));
      expect(props.onCloseOtherTabs).toHaveBeenCalledWith('ws2');
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('animates every tab removed by close-all-tabs', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    try {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
      const ws3 = makeDesktopTab('ws3', 'workspace', { workspaceName: 'API' });
      renderTabBar({ tabs: [...props.tabs, ws3] });
      const tabs = screen.getAllByRole('tab');
      fireEvent.contextMenu(tabs[1], { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-all'));

      for (const tab of tabs) expect(tab).toHaveClass('is-closing--fade');
      expect(props.onCloseAllTabs).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(230));
      expect(props.onCloseAllTabs).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('right-clicking a tab opens the context menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 42, clientY: 84 });
    expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
  });

  it('does not show document keyboard shortcuts in the workspace tab menu', () => {
    renderTabBar();
    const [ws1Tab] = screen.getAllByRole('tab');
    fireEvent.contextMenu(ws1Tab, { clientX: 42, clientY: 84 });
    expect(screen.getByTestId('tab-context-menu')).toHaveAttribute('data-shortcuts', 'absent');
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
