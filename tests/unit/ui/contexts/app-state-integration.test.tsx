import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { ThemeMode } from '../../../../ui/src/types';

const mockBridge = {
  postMessage: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
  getState: vi.fn(() => ({})),
  setState: vi.fn(),
  copyToClipboard: vi.fn(),
} as unknown as PlatformBridge;

function createWrapper(bridge: PlatformBridge = mockBridge) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PlatformProvider bridge={bridge}>
        <AppStateProvider>{children}</AppStateProvider>
      </PlatformProvider>
    );
  };
}

describe('AppStateProvider integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridge.postMessage = vi.fn();
    mockBridge.onMessage = vi.fn(() => vi.fn());
    (mockBridge.getState as ReturnType<typeof vi.fn>).mockReturnValue({});
    mockBridge.setState = vi.fn();
    mockBridge.copyToClipboard = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refresh', () => {
    it('does not enter loading state or post refresh when there is no current file', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      expect(result.current.state.currentFile).toBeNull();
      act(() => { result.current.refresh(); });

      expect(result.current.state.isLoading).toBe(false);
      expect(mockBridge.postMessage).not.toHaveBeenCalledWith({ command: 'refresh' });
    });
  });

  describe('navigate', () => {
    it('dispatches SET_LOADING and sends empty path when called with null', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      act(() => { result.current.navigate(null); });

      expect(result.current.state.isLoading).toBe(true);
      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'navigate', path: '' }),
      );
    });

    it('dispatches ACTIVATE_CONTENT_TAB when path matches a cached content tab', () => {
      const bridge = {
        ...mockBridge,
        getState: vi.fn(() => ({ fileTabs: true })),
        postMessage: vi.fn(),
        onMessage: vi.fn(() => vi.fn()),
        setState: vi.fn(),
        copyToClipboard: vi.fn(),
      } as unknown as PlatformBridge;

      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      act(() => {
        result.current.dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            filePath: '/docs/readme.md',
            html: '<p>content</p>',
            frontmatter: {},
            toc: [],
            relativePath: 'readme.md',
            title: 'Readme',
          } as any,
        });
      });

      const tabs = result.current.state.contentTabs;
      expect(tabs.length).toBeGreaterThanOrEqual(1);
      const tabPath = tabs[0].filePath;

      (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => { result.current.navigate(tabPath); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'navigate', path: tabPath }),
      );
    });

    it('dispatches SET_LOADING when path is not cached', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      act(() => { result.current.navigate('/not/cached.md'); });

      expect(result.current.state.isLoading).toBe(true);
      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'navigate', path: '/not/cached.md' }),
      );
    });

    it('sends navigate message with the target path', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      act(() => { result.current.navigate('/some/file.md'); });

      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'navigate', path: '/some/file.md' }),
      );
    });
  });

  describe('closeContentTab', () => {
    function createBridgeWithFileTabs() {
      return {
        ...mockBridge,
        getState: vi.fn(() => ({ fileTabs: true })),
        postMessage: vi.fn(),
        onMessage: vi.fn(() => vi.fn()),
        setState: vi.fn(),
        copyToClipboard: vi.fn(),
      } as unknown as PlatformBridge;
    }

    it('navigates to fallback when closing active tab', () => {
      const bridge = createBridgeWithFileTabs();
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      act(() => {
        result.current.dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            filePath: '/a.md',
            html: '<p>a</p>',
            frontmatter: {},
            toc: [],
            relativePath: 'a.md',
            title: 'A',
          } as any,
        });
      });

      act(() => {
        result.current.dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            filePath: '/b.md',
            html: '<p>b</p>',
            frontmatter: {},
            toc: [],
            relativePath: 'b.md',
            title: 'B',
          } as any,
        });
      });

      const tabs = result.current.state.contentTabs;
      expect(tabs.length).toBeGreaterThanOrEqual(2);

      const activePath = result.current.state.activeContentTabPath ?? '/b.md';

      (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => { result.current.closeContentTab(activePath); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'navigate' }),
      );
    });

    it('does not navigate when closing non-active tab', () => {
      const bridge = createBridgeWithFileTabs();
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      act(() => {
        result.current.dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            filePath: '/a.md',
            html: '<p>a</p>',
            frontmatter: {},
            toc: [],
            relativePath: 'a.md',
            title: 'A',
          } as any,
        });
      });

      act(() => {
        result.current.dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            filePath: '/b.md',
            html: '<p>b</p>',
            frontmatter: {},
            toc: [],
            relativePath: 'b.md',
            title: 'B',
          } as any,
        });
      });

      const tabs = result.current.state.contentTabs;
      const activePath = result.current.state.activeContentTabPath;
      const nonActivePath = tabs.find((t) => t.filePath !== activePath)?.filePath;

      (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      if (nonActivePath) {
        act(() => { result.current.closeContentTab(nonActivePath); });

        const navigateCalls = (bridge.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: any[]) => c[0]?.command === 'navigate',
        );
        expect(navigateCalls.length).toBe(0);
      }
    });
  });

  describe('toggleTheme', () => {
    it('cycles from light to dark', () => {
      const bridge = {
        ...mockBridge,
        getState: vi.fn(() => ({ theme: 'light' })),
      } as unknown as PlatformBridge;

      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      act(() => { result.current.toggleTheme(); });

      expect(result.current.state.theme).toBe('dark');
    });

    it('cycles from dark to light', () => {
      const bridge = {
        ...mockBridge,
        getState: vi.fn(() => ({ theme: 'dark' })),
      } as unknown as PlatformBridge;

      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      act(() => { result.current.toggleTheme(); });

      expect(result.current.state.theme).toBe('light');
    });

    it('cycles from auto to light', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      if (result.current.state.theme === 'auto') {
        act(() => { result.current.toggleTheme(); });
        expect(result.current.state.theme).toBe('light');
      }
    });

    it('sends updateAppearance message', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      (mockBridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => { result.current.toggleTheme(); });

      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'updateAppearance' }),
      );
    });
  });

  describe('updateSettings', () => {
    it('persists settings via bridge.setState', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      (mockBridge.setState as ReturnType<typeof vi.fn>).mockClear();

      act(() => {
        result.current.updateSettings({ showTitle: true });
      });

      expect(mockBridge.setState).toHaveBeenCalled();
    });

    it('dispatches UPDATE_SETTINGS with the patch', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      act(() => {
        result.current.updateSettings({ showTitle: false });
      });

      expect(result.current.state.settings.showTitle).toBe(false);
    });

    it('sends setDocumentConversion when documentConversion is in patch', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      (mockBridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => {
        result.current.updateSettings({ documentConversion: true });
      });

      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'setDocumentConversion', enabled: true }),
      );
    });

    it('does not send setDocumentConversion when patch does not include it', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      (mockBridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => {
        result.current.updateSettings({ showTitle: true });
      });

      const conversionCalls = (mockBridge.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any[]) => c[0]?.command === 'setDocumentConversion',
      );
      expect(conversionCalls.length).toBe(0);
    });
  });

  describe('selectCustomTheme', () => {
    it('dispatches SET_THEME when custom theme has colorMode', () => {
      const customTheme = {
        id: 'ct1',
        name: 'TestTheme',
        baseStyle: 'default' as const,
        colorMode: 'dark' as ThemeMode,
        createdAt: 0,
        updatedAt: 0,
      };

      const bridge = {
        ...mockBridge,
        getState: vi.fn(() => ({
          customThemes: [customTheme],
          activeCustomThemeId: 'ct1',
        })),
      } as unknown as PlatformBridge;

      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });

      (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => { result.current.selectCustomTheme('ct1'); });

      expect(result.current.state.theme).toBe('dark');
      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'updateAppearance', theme: 'dark' }),
      );
    });

    it('does not dispatch SET_THEME when custom theme has no colorMode', () => {
      const customTheme = {
        id: 'ct2',
        name: 'NoMode',
        baseStyle: 'glass' as const,
        createdAt: 0,
        updatedAt: 0,
      };

      const bridge = {
        ...mockBridge,
        getState: vi.fn(() => ({
          customThemes: [customTheme],
          activeCustomThemeId: 'ct2',
        })),
      } as unknown as PlatformBridge;

      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper(bridge) });
      const themeBefore = result.current.state.theme;

      (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

      act(() => { result.current.selectCustomTheme('ct2'); });

      expect(result.current.state.theme).toBe(themeBefore);
      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'updateAppearance' }),
      );
    });

    it('clears custom theme when called with undefined', () => {
      const { result } = renderHook(() => useAppState(), { wrapper: createWrapper() });

      act(() => { result.current.selectCustomTheme(undefined); });

      expect(result.current.state.settings.activeCustomThemeId).toBeUndefined();
    });
  });
});
