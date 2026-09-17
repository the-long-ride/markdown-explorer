import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

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

describe('split active-pane navigation', () => {
  it('replaces only the active pane while still requesting the target document', () => {
    const bridge = createBridge();
    const { result } = renderHook(() => useAppState(), { wrapper: wrapperFor(bridge) });

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
      result.current.dispatch({ type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' } as any);
    });
    expect(result.current.state.splitView).toMatchObject({
      activePane: 'secondary',
      primary: { filePath: '/docs/a.md' },
      secondary: { filePath: '/docs/b.md' },
    });

    (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();
    act(() => result.current.navigate('/docs/c.md'));

    expect(result.current.state.splitView.primary.filePath).toBe('/docs/a.md');
    expect(result.current.state.splitView.secondary.filePath).toBe('/docs/c.md');
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'navigate', path: '/docs/c.md' });
  });
});
