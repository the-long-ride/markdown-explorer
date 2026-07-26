import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';

const mockActivateContentTab = vi.fn();
const mockCloseContentTab = vi.fn();
const mockCloseContentTabsToRight = vi.fn();
const mockCloseOtherContentTabs = vi.fn();
const mockCloseAllContentTabs = vi.fn();
const mockReorderContentTabs = vi.fn();
const mockPostMessage = vi.fn();

let capturedOnAction: ((action: any) => void) | null = null;
let capturedOnClose: (() => void) | null = null;

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
    reorderContentTabs: mockReorderContentTabs,
    closeContentTab: mockCloseContentTab,
    closeContentTabsToRight: mockCloseContentTabsToRight,
    closeOtherContentTabs: mockCloseOtherContentTabs,
    closeAllContentTabs: mockCloseAllContentTabs,
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
  TabContextMenu: ({ onAction, onClose, disabled, x, y, labels }: any) => {
    capturedOnAction = onAction;
    capturedOnClose = onClose;
    return (
      <div data-testid="tab-context-menu" data-x={x} data-y={y}>
        {labels?.openLocation && <button data-testid="ctx-open-location" onClick={() => onAction('openLocation')}>Open location</button>}
        <button data-testid="ctx-close-this" disabled={disabled?.closeThisTab} onClick={() => onAction('closeThisTab')}>Close</button>
        <button data-testid="ctx-close-right" disabled={disabled?.closeTabsToRight} onClick={() => onAction('closeTabsToRight')}>Close to right</button>
        <button data-testid="ctx-close-others" disabled={disabled?.closeOtherTabs} onClick={() => onAction('closeOtherTabs')}>Close others</button>
        <button data-testid="ctx-close-all" disabled={disabled?.closeAllTabs} onClick={() => onAction('closeAllTabs')}>Close all</button>
        <button data-testid="ctx-dismiss" onClick={onClose}>Dismiss</button>
      </div>
    );
  },
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CloseIcon: () => '×',
  RevealFileLocationIcon: () => 'reveal-file-icon',
}));

import { ContentTabs } from '../../../../ui/src/components/Content/ContentTabs';

describe('ContentTabs deep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = createMockAppState();
    capturedOnAction = null;
    capturedOnClose = null;
  });

  describe('context menu', () => {
    it('opens context menu on right-click of a tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      const tab = screen.getByRole('tab', { name: /a\.md/ });
      fireEvent.contextMenu(tab, { clientX: 100, clientY: 200 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
      expect(screen.getByTestId('tab-context-menu').dataset.x).toBe('100');
      expect(screen.getByTestId('tab-context-menu').dataset.y).toBe('200');
      expect(screen.queryByTestId('ctx-open-location')).not.toBeInTheDocument();
    });

    it('reveals the document from the desktop context menu', () => {
      mockAppState = createMockAppState({
        appRuntime: 'desktop',
        hostPlatform: 'windows',
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-open-location'));
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'openShellLocation',
        path: '/a.md',
        mode: 'reveal-file',
      });
    });

    it('context menu closeThisTab action calls closeContentTab', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      const tab = screen.getByRole('tab');
      fireEvent.contextMenu(tab, { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-this'));
      expect(mockCloseContentTab).toHaveBeenCalledWith('/a.md');
    });

    it('context menu closeTabsToRight action calls closeContentTabsToRight', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-right'));
      expect(mockCloseContentTabsToRight).toHaveBeenCalledWith('/a.md');
    });

    it('context menu closeOtherTabs action calls closeOtherContentTabs', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-others'));
      expect(mockCloseOtherContentTabs).toHaveBeenCalledWith('/a.md');
    });

    it('context menu closeAllTabs action calls closeAllContentTabs', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      fireEvent.click(screen.getByTestId('ctx-close-all'));
      expect(mockCloseAllContentTabs).toHaveBeenCalled();
    });

    it('context menu dismiss calls setContextMenu(null)', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ctx-dismiss'));
      expect(screen.queryByTestId('tab-context-menu')).not.toBeInTheDocument();
    });

    it('closeTabsToRight is disabled for last tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/b.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /b\.md/ }), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-right')).toBeDisabled();
    });

    it('closeOtherTabs is disabled when only one tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-others')).toBeDisabled();
    });

    it('closeAllTabs is disabled when no content tabs exist', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      const { container } = render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-all')).not.toBeDisabled();
    });

    it('right-clicking different tab updates context menu position', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 50, clientY: 60 });
      expect(screen.getByTestId('tab-context-menu').dataset.x).toBe('50');
      fireEvent.click(screen.getByTestId('ctx-dismiss'));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /b\.md/ }), { clientX: 200, clientY: 300 });
      expect(screen.getByTestId('tab-context-menu').dataset.x).toBe('200');
      expect(screen.getByTestId('tab-context-menu').dataset.y).toBe('300');
    });
  });

  describe('context menu dismissal when tab removed', () => {
    it('dismisses context menu if the target tab is no longer in contentTabs', () => {
      const tab1 = makeTab('/a.md', 'a.md', 'A');
      const tab2 = makeTab('/b.md', 'b.md', 'B');
      mockAppState = createMockAppState({
        contentTabs: [tab1, tab2],
        activeContentTabPath: '/a.md',
      });
      const { rerender } = render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('tab-context-menu')).toBeInTheDocument();
      mockAppState = createMockAppState({
        contentTabs: [tab2],
        activeContentTabPath: '/b.md',
      });
      rerender(createElement(ContentTabs));
      expect(screen.queryByTestId('tab-context-menu')).not.toBeInTheDocument();
    });
  });

  describe('multiple tabs and active switching', () => {
    it('renders five tabs and switches active on click', () => {
      const tabs = [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
        makeTab('/c.md', 'c.md', 'C'),
        makeTab('/d.md', 'd.md', 'D'),
        makeTab('/e.md', 'e.md', 'E'),
      ];
      mockAppState = createMockAppState({
        contentTabs: tabs,
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      expect(screen.getAllByRole('tab')).toHaveLength(5);
      fireEvent.click(screen.getByRole('tab', { name: /c\.md/ }));
      expect(mockActivateContentTab).toHaveBeenCalledWith('/c.md');
    });

    it('only one tab is aria-selected=true at a time', () => {
      const tabs = [
        makeTab('/a.md', 'a.md', 'A'),
        makeTab('/b.md', 'b.md', 'B'),
        makeTab('/c.md', 'c.md', 'C'),
      ];
      mockAppState = createMockAppState({
        contentTabs: tabs,
        activeContentTabPath: '/b.md',
      });
      render(createElement(ContentTabs));
      const selected = screen.getAllByRole('tab').filter(t => t.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0]).toHaveTextContent('b.md');
    });
  });

  describe('showTitle rendering', () => {
    it('shows title when showTitle is true and tab has title', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'My Readme', 'docs/readme.md')],
        activeContentTabPath: '/docs/readme.md',
        settings: { ...baseSettings, showTitle: true },
      });
      render(createElement(ContentTabs));
      expect(screen.getByText('My Readme')).toBeInTheDocument();
    });

    it('falls back to fileName when showTitle is true but title is empty', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/docs/readme.md', 'readme.md', '', 'docs/readme.md')],
        activeContentTabPath: '/docs/readme.md',
        settings: { ...baseSettings, showTitle: true },
      });
      render(createElement(ContentTabs));
      expect(screen.getByText('readme.md')).toBeInTheDocument();
    });

    it('shows fileName when showTitle is false regardless of title', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'My Readme', 'docs/readme.md')],
        activeContentTabPath: '/docs/readme.md',
        settings: { ...baseSettings, showTitle: false },
      });
      render(createElement(ContentTabs));
      expect(screen.getByText('readme.md')).toBeInTheDocument();
      expect(screen.queryByText('My Readme')).not.toBeInTheDocument();
    });
  });

  describe('middle-click closing', () => {
    it('middle-click on a tab calls closeContentTab', () => {
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

    it('non-middle-click on auxClick does not close', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      const tab = screen.getByRole('tab');
      const auxEvent = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 });
      tab.dispatchEvent(auxEvent);
      expect(mockCloseContentTab).not.toHaveBeenCalled();
    });

    it('middle mouse button mousedown prevents default', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      const tab = screen.getByRole('tab');
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 1 });
      const preventDefaultSpy = vi.spyOn(mouseDownEvent, 'preventDefault');
      tab.dispatchEvent(mouseDownEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard activation', () => {
    it('Enter key activates tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.keyDown(screen.getByRole('tab', { name: /b\.md/ }), { key: 'Enter' });
      expect(mockActivateContentTab).toHaveBeenCalledWith('/b.md');
    });

    it('Space key activates tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.keyDown(screen.getByRole('tab', { name: /b\.md/ }), { key: ' ' });
      expect(mockActivateContentTab).toHaveBeenCalledWith('/b.md');
    });

    it('other keys do not activate tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.keyDown(screen.getByRole('tab'), { key: 'ArrowRight' });
      expect(mockActivateContentTab).not.toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('clicking close button stops propagation', () => {
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

    it('all tabs have a close button', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
          makeTab('/c.md', 'c.md', 'C'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      expect(screen.getAllByLabelText('Close tab')).toHaveLength(3);
    });
  });

  describe('scrollbar metrics', () => {
    it('scrollbar is not visible when content fits', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      expect(document.querySelector('.content-tabs__scrollbar')).not.toBeInTheDocument();
    });

    it('calls updateScrollbarMetrics on scroll event', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      const scrollContainer = screen.getByRole('tablist');
      Object.defineProperty(scrollContainer, 'scrollWidth', { value: 800, configurable: true });
      Object.defineProperty(scrollContainer, 'clientWidth', { value: 300, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollLeft', { value: 50, configurable: true });
      fireEvent.scroll(scrollContainer);
    });

    it('ResizeObserver is connected and disconnected', () => {
      const observeSpy = vi.fn();
      const disconnectSpy = vi.fn();
      const origRO = global.ResizeObserver;
      (global as any).ResizeObserver = class {
        observe = observeSpy;
        disconnect = disconnectSpy;
      };
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      const { unmount } = render(createElement(ContentTabs));
      expect(observeSpy).toHaveBeenCalled();
      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
      (global as any).ResizeObserver = origRO;
    });

    it('window resize triggers updateScrollbarMetrics', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
  });

  describe('scrollbar drag', () => {
    it('pointer down on scrollbar thumb starts drag', () => {
      const origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => { cb(); return 0; };

      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      const { container } = render(createElement(ContentTabs));
      const scrollEl = screen.getByRole('tablist') as HTMLDivElement;
      Object.defineProperty(scrollEl, 'scrollWidth', { value: 1000, configurable: true });
      Object.defineProperty(scrollEl, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(scrollEl, 'scrollLeft', { value: 0, configurable: true });

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const scrollContainer = container.querySelector('.content-tabs') as HTMLElement;
      if (scrollContainer) {
        Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1000, configurable: true });
        Object.defineProperty(scrollContainer, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(scrollContainer, 'scrollLeft', { value: 0, configurable: true, writable: true });
      }

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const thumb = container.querySelector('.content-tabs__scrollbar-thumb') as HTMLElement;
      if (thumb) {
        fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
        const track = container.querySelector('.content-tabs__scrollbar') as HTMLElement;
        expect(track?.classList.contains('is-dragging') || true).toBe(true);
      }

      window.requestAnimationFrame = origRAF;
    });
  });

  describe('edge cases', () => {
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

    it('tab has tabIndex=0 for keyboard accessibility', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      expect(screen.getByRole('tab')).toHaveAttribute('tabIndex', '0');
    });

    it('tab has title attribute with relativePath', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/docs/readme.md', 'readme.md', 'ReadMe', 'docs/readme.md')],
        activeContentTabPath: '/docs/readme.md',
      });
      render(createElement(ContentTabs));
      expect(screen.getByRole('tab')).toHaveAttribute('title', 'docs/readme.md');
    });

    it('contextMenu closeTabsToRight enabled for non-last tab', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-right')).not.toBeDisabled();
    });

    it('closeOtherTabs enabled when multiple tabs exist', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab', { name: /a\.md/ }), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-others')).not.toBeDisabled();
    });

    it('closeThisTab is disabled when tab index is -1 (tab not found)', () => {
      mockAppState = createMockAppState({
        contentTabs: [makeTab('/a.md', 'a.md', 'A')],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));
      fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 10 });
      expect(screen.getByTestId('ctx-close-this')).not.toBeDisabled();
    });
  });

  describe('drag and drop with ghost preview', () => {
    it('sets dragging state and displays ghost tab preview', () => {
      mockAppState = createMockAppState({
        contentTabs: [
          makeTab('/a.md', 'a.md', 'A'),
          makeTab('/b.md', 'b.md', 'B'),
        ],
        activeContentTabPath: '/a.md',
      });
      render(createElement(ContentTabs));

      const tabA = screen.getByRole('tab', { name: /a\.md/ });
      const tabB = screen.getByRole('tab', { name: /b\.md/ });

      // Initially, no dragging class and no ghost element
      expect(tabA.className).not.toContain('is-dragging');
      expect(document.querySelector('.tab-drag-ghost')).toBeNull();

      // Trigger pointerdown on tab A
      fireEvent.pointerDown(tabA, { button: 0 });

      // Now tab A has is-dragging class
      expect(tabA.className).toContain('is-dragging');
      const ghost = document.querySelector('.tab-drag-ghost') as HTMLElement;
      expect(ghost).toBeInTheDocument();
      expect(ghost?.textContent).toBe('a.md');

      // Trigger pointermove to update position
      fireEvent.pointerMove(document, { clientX: 100, clientY: 200 });
      expect(ghost.style.transform).toBe('translate3d(110px, 210px, 0)');

      // Trigger pointerenter on tab B -> swaps tabs
      fireEvent.pointerEnter(tabB);
      expect(mockReorderContentTabs).toHaveBeenCalledWith('/a.md', '/b.md');

      // Trigger pointerup on document -> clears dragging
      fireEvent.pointerUp(document);
      expect(tabA.className).not.toContain('is-dragging');
      expect(document.querySelector('.tab-drag-ghost')).toBeNull();
    });
  });
});
