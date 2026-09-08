import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { DocumentViewMode, PaneId } from '../../../../ui/src/split-view/paneState';

function createBridge(): PlatformBridge {
  return {
    postMessage: vi.fn((_message: WebviewMessage) => undefined),
    onMessage: vi.fn((_handler: (message: HostMessage) => void) => () => undefined),
    getState: vi.fn(() => ({ fileTabs: true })),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
}

function wrapperFor(bridge: PlatformBridge) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PlatformProvider bridge={bridge}>
        <AppStateProvider>{children}</AppStateProvider>
      </PlatformProvider>
    );
  };
}

function renderDocument(result: ReturnType<typeof renderHook<ReturnType<typeof useAppState>, unknown>>['result']) {
  act(() => {
    result.current.dispatch({
      type: 'RENDER_CONTENT',
      msg: {
        command: 'renderContent',
        html: '<h1>A</h1>',
        markdownSource: '# A',
        frontmatter: {},
        toc: [],
        filePath: '/docs/a.md',
        relativePath: 'a.md',
        title: 'A',
        fileList: [],
        previewInfo: null,
        documentWrite: { supported: true, revision: '1:3' },
      },
    });
  });
}

type SplitApi = {
  openInSplit?: (filePath: string) => void;
  moveToOtherPane?: (filePath: string) => void;
  swapSplitPanes?: () => void;
  closeSplitView?: () => void;
  activatePane?: (paneId: PaneId) => void;
  setSplitRatio?: (ratio: number) => void;
  setSplitPaneMode?: (paneId: PaneId, mode: DocumentViewMode) => void;
  setSplitPaneScrollTop?: (paneId: PaneId, scrollTop: number) => void;
};

describe('AppStateProvider split API', () => {
  it('opens, updates, swaps, and closes a split through public actions', () => {
    const bridge = createBridge();
    const { result } = renderHook(() => useAppState(), { wrapper: wrapperFor(bridge) });
    renderDocument(result as any);

    const api = result.current as typeof result.current & SplitApi;
    expect(api.openInSplit).toBeTypeOf('function');
    expect(api.activatePane).toBeTypeOf('function');
    expect(api.setSplitRatio).toBeTypeOf('function');
    expect(api.setSplitPaneMode).toBeTypeOf('function');
    expect(api.setSplitPaneScrollTop).toBeTypeOf('function');
    expect(api.swapSplitPanes).toBeTypeOf('function');
    expect(api.closeSplitView).toBeTypeOf('function');
    if (!api.openInSplit || !api.activatePane || !api.setSplitRatio || !api.setSplitPaneMode
      || !api.setSplitPaneScrollTop || !api.swapSplitPanes || !api.closeSplitView) return;

    act(() => api.openInSplit?.('/docs/b.md'));
    expect(result.current.state.splitView).toMatchObject({
      enabled: true,
      activePane: 'secondary',
      primary: { filePath: '/docs/a.md' },
      secondary: { filePath: '/docs/b.md' },
    });

    act(() => api.activatePane?.('primary'));
    act(() => api.setSplitRatio?.(0.7));
    act(() => api.setSplitPaneMode?.('secondary', 'plain'));
    act(() => api.setSplitPaneScrollTop?.('secondary', 240));
    expect(result.current.state.splitView.activePane).toBe('primary');
    expect(result.current.state.splitView.ratio).toBe(0.7);
    expect(result.current.state.splitView.secondary.mode).toBe('plain');
    expect(result.current.state.splitView.secondary.scrollTop).toBe(240);

    act(() => api.swapSplitPanes?.());
    expect(result.current.state.splitView.primary.filePath).toBe('/docs/b.md');
    expect(result.current.state.splitView.secondary.filePath).toBe('/docs/a.md');

    act(() => api.closeSplitView?.());
    expect(result.current.state.splitView.enabled).toBe(false);
  });

  it('moves a document to the pane opposite the active pane', () => {
    const bridge = createBridge();
    const { result } = renderHook(() => useAppState(), { wrapper: wrapperFor(bridge) });
    renderDocument(result as any);
    const api = result.current as typeof result.current & SplitApi;
    expect(api.openInSplit).toBeTypeOf('function');
    expect(api.moveToOtherPane).toBeTypeOf('function');
    expect(api.activatePane).toBeTypeOf('function');
    if (!api.openInSplit || !api.moveToOtherPane || !api.activatePane) return;

    act(() => api.openInSplit?.('/docs/b.md'));
    act(() => api.activatePane?.('primary'));
    act(() => api.moveToOtherPane?.('/docs/c.md'));

    expect(result.current.state.splitView.primary.filePath).toBe('/docs/a.md');
    expect(result.current.state.splitView.secondary.filePath).toBe('/docs/c.md');
  });
});
