import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

const mockActivateContentTab = vi.fn();
const mockCloseContentTab = vi.fn();
const mockCloseContentTabsToRight = vi.fn();
const mockCloseOtherContentTabs = vi.fn();
const mockCloseAllContentTabs = vi.fn();
const mockReorderContentTabs = vi.fn();
const mockPostMessage = vi.fn();

const baseSettings = {
  language: 'en',
  fileTabs: true,
  showTitle: false,
  defaultHtmlPreview: true,
  defaultCsvPreview: true,
  documentConversion: false,
  scopeFocus: {},
  searchScopeFocus: {},
  desktopViewMode: 'sidebar' as const,
  keybindings: {},
  customThemes: [],
  activeCustomThemeId: undefined,
};

function makeTab(filePath: string, fileName: string, title: string, relativePath = fileName) {
  return {
    filePath,
    relativePath,
    fileName,
    title,
    contentHtml: '',
    markdownSource: '',
    frontmatter: {} as Record<string, string>,
    toc: [] as any[],
    previewInfo: null,
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
      tocCollapsed: false,
      contentHtml: '<p>Hello</p>',
      markdownSource: '# Hello',
      frontmatter: {} as Record<string, string>,
      toc: [] as any[],
      relativePath: 'docs/readme.md',
      isLoading: false,
      loadingLabel: '',
      loadingDetail: '',
      previewInfo: null,
      staleContentFilePath: null,
      notFoundHref: null,
      workspaceUnavailablePath: null,
      workspaceUnavailableReason: null,
      settings: { ...baseSettings },
      renderVersion: 1,
      contentTabs: [] as any[],
      activeContentTabPath: null,
      splitView: createSplitViewState('/docs/readme.md'),
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
    },
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleToc: vi.fn(),
    toggleFocusMode: vi.fn(),
    dispatch: vi.fn(),
    navigate: vi.fn(),
    refresh: vi.fn(),
    activateContentTab: mockActivateContentTab,
    closeContentTab: mockCloseContentTab,
    closeContentTabsToRight: mockCloseContentTabsToRight,
    closeOtherContentTabs: mockCloseOtherContentTabs,
    closeAllContentTabs: mockCloseAllContentTabs,
    reorderContentTabs: mockReorderContentTabs,
    openInEditor: vi.fn(),
    setTheme: vi.fn(),
    setThemeStyle: vi.fn(),
    selectCustomTheme: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setSidebarActiveTab: vi.fn(),
    updateSettings: vi.fn(),
  };
}

let mockAppState = createMockAppState();

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
    fileTabs: 'File tabs',
    tooltips: { closeTab: 'Close tab' },
    tabContextMenu: {
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
}));

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({
  TabContextMenu: () => null,
}));

vi.mock('../../../../ui/src/components/shared/icons', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    CloseIcon: () => '×',
    RevealFileLocationIcon: () => 'reveal-file-icon',
  };
});

import { ContentTabs } from '../../../../ui/src/components/Content/ContentTabs';

describe('ContentTabs render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = createMockAppState();
  });

  it('returns null when fileTabs setting is false', () => {
    mockAppState = createMockAppState({
      settings: { ...baseSettings, fileTabs: false },
      contentTabs: [makeTab('/a.md', 'a.md', 'A')],
      activeContentTabPath: '/a.md',
    });
    const { container } = render(createElement(ContentTabs));
    expect(container.innerHTML).toBe('');
  });

  it('returns null when contentTabs is empty', () => {
    mockAppState = createMockAppState({
      contentTabs: [],
      activeContentTabPath: null,
    });
    const { container } = render(createElement(ContentTabs));
    expect(container.innerHTML).toBe('');
  });

  it('renders tab buttons for each content tab', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/docs/readme.md', 'readme.md', 'Readme', 'docs/readme.md'),
        makeTab('/docs/guide.md', 'guide.md', 'Guide', 'docs/guide.md'),
      ],
      activeContentTabPath: '/docs/readme.md',
    });
    render(createElement(ContentTabs));
    expect(screen.getByRole('tab', { name: /readme\.md/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /guide\.md/ })).toBeInTheDocument();
  });

  it('marks active tab with is-active class and aria-selected', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const activeTab = screen.getByRole('tab', { selected: true });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab.classList.contains('is-active')).toBe(true);
  });

  it('inactive tab is not aria-selected', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const inactiveTab = screen.getByRole('tab', { name: /b\.md/ });
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab calls activateContentTab', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    fireEvent.click(screen.getByRole('tab', { name: /b\.md/ }));
    expect(mockActivateContentTab).toHaveBeenCalledWith('/b.md');
  });

  it('close button on tab calls closeContentTab', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/a.md', 'a.md', 'A')],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const closeBtn = screen.getByLabelText('Close tab');
    fireEvent.click(closeBtn);
    expect(mockCloseContentTab).toHaveBeenCalledWith('/a.md');
  });

  it('close button click does not propagate to tab activation', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const closeButtons = screen.getAllByLabelText('Close tab');
    fireEvent.click(closeButtons[1]);
    expect(mockCloseContentTab).toHaveBeenCalledWith('/b.md');
    expect(mockActivateContentTab).not.toHaveBeenCalled();
  });

  it('middle-click (onAuxClick) closes tab', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const bTab = screen.getByRole('tab', { name: /b\.md/ });
    const auxEvent = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    bTab.dispatchEvent(auxEvent);
    expect(mockCloseContentTab).toHaveBeenCalledWith('/b.md');
  });

  it('reorders document tabs on drop', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/a.md', 'a.md', 'A'), makeTab('/b.md', 'b.md', 'B')],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const [firstTab, secondTab] = screen.getAllByRole('tab');
    fireEvent.pointerDown(secondTab, { button: 0 });
    fireEvent.pointerEnter(firstTab);
    fireEvent.pointerUp(document);
    expect(mockReorderContentTabs).toHaveBeenCalledWith('/b.md', '/a.md');
  });

  it('auxClick with button 0 does not close tab', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/a.md', 'a.md', 'A')],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const tab = screen.getByRole('tab', { name: /a\.md/ });
    const auxEvent = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 0 });
    tab.dispatchEvent(auxEvent);
    expect(mockCloseContentTab).not.toHaveBeenCalled();
  });

  it('shows tab title when showTitle is true', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'ReadMe', 'docs/readme.md')],
      activeContentTabPath: '/docs/readme.md',
      settings: { ...baseSettings, showTitle: true },
    });
    render(createElement(ContentTabs));
    expect(screen.getByText('ReadMe')).toBeInTheDocument();
  });

  it('shows fileName when showTitle is false', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'ReadMe', 'docs/readme.md')],
      activeContentTabPath: '/docs/readme.md',
    });
    render(createElement(ContentTabs));
    expect(screen.getByText('readme.md')).toBeInTheDocument();
  });

  it('renders content-tabs-wrap with role tablist', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/a.md', 'a.md', 'A')],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('Enter key on tab calls activateContentTab', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const bTab = screen.getByRole('tab', { name: /b\.md/ });
    fireEvent.keyDown(bTab, { key: 'Enter' });
    expect(mockActivateContentTab).toHaveBeenCalledWith('/b.md');
  });

  it('Space key on tab calls activateContentTab', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
      ],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const bTab = screen.getByRole('tab', { name: /b\.md/ });
    fireEvent.keyDown(bTab, { key: ' ' });
    expect(mockActivateContentTab).toHaveBeenCalledWith('/b.md');
  });

  it('other key on tab does not call activateContentTab', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/a.md', 'a.md', 'A')],
      activeContentTabPath: '/a.md',
    });
    render(createElement(ContentTabs));
    const tab = screen.getByRole('tab', { name: /a\.md/ });
    fireEvent.keyDown(tab, { key: 'Tab' });
    expect(mockActivateContentTab).not.toHaveBeenCalled();
  });

  it('renders three tabs correctly', () => {
    mockAppState = createMockAppState({
      contentTabs: [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
        makeTab('/c.md', 'c.md', 'C'),
      ],
      activeContentTabPath: '/b.md',
    });
    render(createElement(ContentTabs));
    const tabElements = screen.getAllByRole('tab');
    expect(tabElements).toHaveLength(3);
  });

  it('tab has title attribute with relativePath', () => {
    mockAppState = createMockAppState({
      contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'ReadMe', 'docs/readme.md')],
      activeContentTabPath: '/docs/readme.md',
    });
    render(createElement(ContentTabs));
    const tab = screen.getByRole('tab');
    expect(tab).toHaveAttribute('title', 'docs/readme.md');
  });
});
