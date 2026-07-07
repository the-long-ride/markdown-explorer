import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';

let useFileDropOpenReturn = { isDragging: false };
let useDesktopTabsReturn = {
  activeTabId: 'home' as string,
  tabs: [] as any[],
  workspaceAliases: {} as Record<string, string>,
  toolbarPosition: { x: 36, y: 36 },
  setToolbarPosition: vi.fn(),
  activateTab: vi.fn(),
  createNewWorkspaceTab: vi.fn(),
  prepareWorkspaceOpen: vi.fn(),
  openDroppedPath: vi.fn(),
  pendingDroppedPath: null as string | null,
  setPendingDroppedPath: vi.fn(),
  confirmSwitchWorkspace: vi.fn(),
  closeTab: vi.fn(),
  closeTabsToRight: vi.fn(),
  closeOtherTabs: vi.fn(),
  closeAllTabs: vi.fn(),
  updateTabAlias: vi.fn(),
  updateWorkspaceAlias: vi.fn(),
  crossTabSearchItems: [] as any[],
  isIndexingAcrossTabs: false,
};

const mockToggleTheme = vi.fn();
const mockToggleSidebar = vi.fn();
const mockToggleToc = vi.fn();
const mockToggleFocusMode = vi.fn();
const mockDispatch = vi.fn();
const mockNavigate = vi.fn();
const mockRefresh = vi.fn();
const mockActivateContentTab = vi.fn();
const mockCloseContentTab = vi.fn();
const mockCloseContentTabsToRight = vi.fn();
const mockCloseOtherContentTabs = vi.fn();
const mockCloseAllContentTabs = vi.fn();
const mockOpenInEditor = vi.fn();

function createMockState(overrides: Record<string, unknown> = {}) {
  return {
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
    tocCollapsed: false,
    contentHtml: '<p>Hello</p>',
    markdownSource: '# Hello',
    frontmatter: {},
    toc: [],
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
      desktopViewMode: 'sidebar' as const,
      keybindings: {},
      customThemes: [],
      activeCustomThemeId: undefined,
    },
    renderVersion: 1,
    contentTabs: [],
    activeContentTabPath: null,
    recentWorkspaces: [],
    isMaximized: false,
    appVersion: '1.0.0',
    appRuntime: 'vscode' as const,
    hostPlatform: 'unknown' as const,
    hostArch: '',
    focusMode: false,
    updateState: { status: 'idle' as const },
    sidebarActiveTab: 'files' as const,
    ...overrides,
  };
}

let mockState = createMockState();

const mockAppState = {
  get state() { return mockState; },
  set state(v) { mockState = v; },
  toggleTheme: mockToggleTheme,
  toggleSidebar: mockToggleSidebar,
  toggleToc: mockToggleToc,
  toggleFocusMode: mockToggleFocusMode,
  dispatch: mockDispatch,
  navigate: mockNavigate,
  refresh: mockRefresh,
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

const mockBridge = {
  postMessage: vi.fn(),
  onMessage: vi.fn(() => () => {}),
  getState: vi.fn(() => undefined),
  setState: vi.fn(),
  copyToClipboard: vi.fn(),
};

const mockNav = {
  back: vi.fn(),
  forward: vi.fn(),
  canGoBack: false,
  canGoForward: false,
  setScope: vi.fn(),
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => mockAppState,
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => mockBridge,
}));

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => mockNav,
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    topbar: { switchToLightMode: 'Light mode', switchToDarkMode: 'Dark mode' },
    tooltips: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      closeApp: 'Close',
      scrollToTop: 'Scroll to top',
      closeTab: 'Close tab',
    },
    actions: {
      toggleFocusMode: 'Exit Focus Mode',
      searchAllTabs: 'Search all tabs',
      searchCurrent: 'Search current',
    },
    fileTabs: 'File tabs',
    tabContextMenu: {
      closeThisTab: 'Close',
      closeTabsToRight: 'Close to right',
      closeOtherTabs: 'Close others',
      closeAllTabs: 'Close all',
    },
  }),
}));

vi.mock('../../../../ui/src/components/Sidebar/Sidebar', () => ({
  Sidebar: () => createElement('div', { 'data-testid': 'sidebar' }),
}));
vi.mock('../../../../ui/src/components/Content/Content', () => ({
  Content: () => createElement('div', { 'data-testid': 'content' }),
}));
vi.mock('../../../../ui/src/components/Workspace/WorkspaceSelection', () => ({
  WorkspaceSelection: () => createElement('div', { 'data-testid': 'workspace-selection' }),
}));
vi.mock('../../../../ui/src/components/Content/ContentTabs', () => ({
  ContentTabs: () => createElement('div', { 'data-testid': 'content-tabs' }),
}));
vi.mock('../../../../ui/src/components/Content/WelcomePage', () => ({
  WelcomePage: () => createElement('div', { 'data-testid': 'welcome-page' }),
}));
vi.mock('../../../../ui/src/components/TOC/TableOfContents', () => ({
  TableOfContents: () => createElement('div', { 'data-testid': 'toc' }),
}));
vi.mock('../../../../ui/src/components/Search/SearchOverlay', () => ({
  SearchOverlay: () => createElement('div', { 'data-testid': 'search-overlay' }),
}));
vi.mock('../../../../ui/src/components/Search/FindInFilePanel', () => ({
  FindInFilePanel: () => createElement('div', { 'data-testid': 'find-panel' }),
}));
vi.mock('../../../../ui/src/components/Modal/MediaModal', () => ({
  MediaModal: () => createElement('div', { 'data-testid': 'media-modal' }),
}));
vi.mock('../../../../ui/src/components/Settings/SettingsModal', () => ({
  SettingsModal: () => createElement('div', { 'data-testid': 'settings-modal' }),
}));
vi.mock('../../../../ui/src/components/Modal/TermsModal', () => ({
  TermsModal: ({ isOpen, onAgree }: { isOpen: boolean; onAgree: () => void }) =>
    isOpen ? createElement('div', { 'data-testid': 'terms-modal' }, createElement('button', { 'data-testid': 'terms-agree', onClick: onAgree }, 'Agree')) : null,
}));
vi.mock('../../../../ui/src/components/Modal/ThemeOnboardingModal', () => ({
  ThemeOnboardingModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? createElement('div', { 'data-testid': 'theme-onboarding' }) : null,
}));
vi.mock('../../../../ui/src/components/Modal/SwitchWorkspaceModal', () => ({
  SwitchWorkspaceModal: () => createElement('div', { 'data-testid': 'switch-workspace-modal' }),
}));
vi.mock('../../../../ui/src/components/Desktop/DesktopTabBar', () => ({
  DesktopTabBar: () => createElement('div', { 'data-testid': 'desktop-tab-bar' }),
}));
vi.mock('../../../../ui/src/components/Desktop/FloatingTabToolbar', () => ({
  FloatingTabToolbar: () => createElement('div', { 'data-testid': 'floating-tab-toolbar' }),
}));
vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, tooltip, className }: any) =>
    createElement('button', { onClick, title: tooltip, className, 'data-testid': 'tooltip-btn' }, tooltip || 'btn'),
}));
vi.mock('../../../../ui/src/components/Topbar/Topbar', () => ({
  Topbar: ({ onSettingsOpen }: any) =>
    createElement('div', { 'data-testid': 'topbar' }, createElement('button', { 'data-testid': 'topbar-settings', onClick: onSettingsOpen }, 'Settings')),
}));
vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({
  default: 'data:image/png;base64,test',
}));
vi.mock('../../../../ui/src/components/shared/icons', () => ({
  ChevronUpIcon: () => createElement('svg', { 'data-testid': 'chevron-up-icon' }),
  MinimizeIcon: () => createElement('svg', { 'data-testid': 'minimize-icon' }),
}));
vi.mock('../../../../ui/src/dom/globalHandlers', () => ({
  initGlobalHandlers: vi.fn(),
}));
vi.mock('../../../../ui/src/hooks/useDesktopTabs', () => ({
  useDesktopTabs: () => useDesktopTabsReturn,
}));
vi.mock('../../../../ui/src/hooks/useFileDropOpen', () => ({
  useFileDropOpen: () => useFileDropOpenReturn,
}));
vi.mock('../../../../ui/src/hooks/useKeyboard', () => ({
  useKeyboard: vi.fn(),
}));
vi.mock('../../../../ui/src/hooks/useResize', () => ({
  useResize: vi.fn(),
}));
vi.mock('../../../../ui/src/hooks/useScrollVisibility', () => ({
  useScrollVisibility: () => ({ isVisible: false, scrollToTop: vi.fn() }),
}));
vi.mock('../../../../ui/src/hooks/useUpdateCheck', () => ({
  useUpdateCheck: () => ({
    hasUpdate: false,
    latestVersion: '',
    downloadUrl: '',
    changelogUrl: '',
  }),
}));
vi.mock('../../../../ui/src/utils/shortcuts', () => ({
  formatShortcutLabel: (s: string) => s,
}));
vi.mock('../../../../ui/src/utils/searchJump', () => ({
  clearSearchJumpMarks: vi.fn(),
  scrollToRenderedSearchMatch: vi.fn(),
}));

import { App } from '../../../../ui/src/App';

describe('App render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('electronAPI', undefined);
    delete (window as any).__chromeExtBus;
    mockState = createMockState();
    useFileDropOpenReturn = { isDragging: false };
    useDesktopTabsReturn = {
      activeTabId: 'home',
      tabs: [],
      workspaceAliases: {},
      toolbarPosition: { x: 36, y: 36 },
      setToolbarPosition: vi.fn(),
      activateTab: vi.fn(),
      createNewWorkspaceTab: vi.fn(),
      prepareWorkspaceOpen: vi.fn(),
      openDroppedPath: vi.fn(),
      pendingDroppedPath: null,
      setPendingDroppedPath: vi.fn(),
      confirmSwitchWorkspace: vi.fn(),
      closeTab: vi.fn(),
      closeTabsToRight: vi.fn(),
      closeOtherTabs: vi.fn(),
      closeAllTabs: vi.fn(),
      updateTabAlias: vi.fn(),
      updateWorkspaceAlias: vi.fn(),
      crossTabSearchItems: [],
      isIndexingAcrossTabs: false,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).__chromeExtBus;
  });

  it('shows TermsModal when terms not accepted on desktop-like platform', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('terms-modal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders full app when terms accepted', async () => {
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('renders WorkspaceSelection when no workspace name and terms accepted', async () => {
    mockState = createMockState({ workspaceName: '' });
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('workspace-selection')).toBeInTheDocument();
    });
  });

  it('renders loading screen when isLoading and no workspace', () => {
    mockState = createMockState({ isLoading: true, workspaceName: '', loadingLabel: 'Loading docs...' });
    render(createElement(App));
    expect(screen.getByText('Loading docs...')).toBeInTheDocument();
  });

  it('calls toggleTheme on theme toggle button in terms screen', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle(/mode/i)).toBeInTheDocument();
    });
    const themeBtn = screen.getByTitle(/mode/i);
    fireEvent.click(themeBtn);
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('shows window controls when isElectron in terms screen', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('does not show window controls when Chrome ext only (not isElectron) in terms screen', async () => {
    (window as any).__chromeExtBus = {};
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('terms-modal')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Minimize')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
  });

  it('clicking minimize sends window-minimize command', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Minimize'));
    expect(mockBridge.postMessage).toHaveBeenCalledWith({ command: 'window-minimize' });
  });

  it('clicking maximize sends window-maximize command', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Maximize'));
    expect(mockBridge.postMessage).toHaveBeenCalledWith({ command: 'window-maximize' });
  });

  it('clicking close sends window-close command', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Close'));
    expect(mockBridge.postMessage).toHaveBeenCalledWith({ command: 'window-close' });
  });

  it('shows restore tooltip when maximized', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    mockState = createMockState({ isMaximized: true });
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Restore')).toBeInTheDocument();
    });
  });

  it('clicking agree on terms modal sets localStorage', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.removeItem('markdown-explorer-terms-accepted');
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('terms-agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('terms-agree'));
    expect(localStorage.getItem('markdown-explorer-terms-accepted')).toBe('true');
  });

  it('renders focus mode exit button when focusMode is true', async () => {
    mockState = createMockState({ focusMode: true });
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTitle('Exit Focus Mode')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Exit Focus Mode'));
    expect(mockToggleFocusMode).toHaveBeenCalled();
  });

  it('does not render focus mode exit button when focusMode is false', async () => {
    render(createElement(App));
    expect(screen.queryByTitle('Exit Focus Mode')).not.toBeInTheDocument();
  });

  it('renders ContentTabs component', async () => {
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('content-tabs')).toBeInTheDocument();
    });
  });

  it('renders sidebar-resize separator', async () => {
    render(createElement(App));
    await waitFor(() => {
      expect(document.getElementById('sidebarResize')).toBeInTheDocument();
    });
  });

  it('app has correct className with focus mode', async () => {
    mockState = createMockState({ focusMode: true });
    render(createElement(App));
    await waitFor(() => {
      expect(document.querySelector('.app--focus-mode')).toBeInTheDocument();
    });
  });

  it('app has is-windows class when hostPlatform is windows', async () => {
    mockState = createMockState({ hostPlatform: 'windows' });
    render(createElement(App));
    await waitFor(() => {
      expect(document.querySelector('.is-windows')).toBeInTheDocument();
    });
  });

  it('app has is-maximized-windows class when maximized on windows', async () => {
    mockState = createMockState({ hostPlatform: 'windows', isMaximized: true });
    render(createElement(App));
    await waitFor(() => {
      expect(document.querySelector('.is-maximized-windows')).toBeInTheDocument();
    });
  });

  it('renders DesktopTabBar in tab view mode', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    localStorage.setItem('markdown-explorer-theme-onboarding-complete', 'true');
    mockState = createMockState({ settings: { ...createMockState().settings, desktopViewMode: 'tabs' } });
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('desktop-tab-bar')).toBeInTheDocument();
    });
  });

  it('renders WelcomePage when tab view and active tab is home', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    localStorage.setItem('markdown-explorer-theme-onboarding-complete', 'true');
    mockState = createMockState({ settings: { ...createMockState().settings, desktopViewMode: 'tabs' } });
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
    });
  });

  it('renders floating tab toolbar in tab view with workspace and non-home tab active', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    localStorage.setItem('markdown-explorer-theme-onboarding-complete', 'true');
    mockState = createMockState({
      settings: { ...createMockState().settings, desktopViewMode: 'tabs' },
    });
    useDesktopTabsReturn = {
      ...useDesktopTabsReturn,
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', label: 'workspace' }],
    };
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('floating-tab-toolbar')).toBeInTheDocument();
    });
  });

  it('renders drop overlay when isDragging', async () => {
    useFileDropOpenReturn = { isDragging: true };
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByText('Drop folder or file to open')).toBeInTheDocument();
    });
    useFileDropOpenReturn = { isDragging: false };
  });

  it('skips terms modal for web (non-desktop-like) platform', async () => {
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('terms-modal')).not.toBeInTheDocument();
  });

  it('renders theme onboarding modal when terms accepted but onboarding not complete', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    localStorage.removeItem('markdown-explorer-theme-onboarding-complete');
    mockState = createMockState();
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByTestId('theme-onboarding')).toBeInTheDocument();
    });
  });

  it('does not render theme onboarding when complete', async () => {
    vi.stubGlobal('electronAPI', {});
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    localStorage.setItem('markdown-explorer-theme-onboarding-complete', 'true');
    mockState = createMockState();
    render(createElement(App));
    expect(screen.queryByTestId('theme-onboarding')).not.toBeInTheDocument();
  });

  it('renders sidebar-cursor-backdrop div', async () => {
    render(createElement(App));
    await waitFor(() => {
      expect(document.querySelector('.sidebar-cursor-backdrop')).toBeInTheDocument();
    });
  });

  it('loading screen shows detail text when loadingDetail is set', () => {
    mockState = createMockState({ isLoading: true, workspaceName: '', loadingLabel: 'Loading', loadingDetail: 'Parsing files...' });
    render(createElement(App));
    expect(screen.getByText('Parsing files...')).toBeInTheDocument();
  });
});
