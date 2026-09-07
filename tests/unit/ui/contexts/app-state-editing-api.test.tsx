import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createEditingBridge() {
  const listeners = new Set<(message: HostMessage) => void>();
  const emit = (message: HostMessage) => listeners.forEach((listener) => listener(message));
  const bridge = {
    postMessage: vi.fn((message: WebviewMessage) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => emit({
        command: 'saveDocumentResult',
        requestId: message.requestId,
        filePath: message.filePath,
        ok: true,
        revision: '20:3',
      }));
    }),
    onMessage: vi.fn((handler: (message: HostMessage) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
    getState: vi.fn(() => ({ fileTabs: true })),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
  return { bridge, emit };
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

describe('AppStateProvider editing API', () => {
  it('updates, saves, and discards one shared working copy', async () => {
    const { bridge } = createEditingBridge();
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
          documentWrite: { supported: true, revision: '10:3' },
        },
      });
    });

    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# B'));
    expect(result.current.state.documentSessions['/docs/a.md']?.source).toBe('# B');

    let saveResult: Awaited<ReturnType<typeof result.current.saveDocument>>;
    await act(async () => {
      saveResult = await result.current.saveDocument('/docs/a.md');
    });

    expect(saveResult!).toMatchObject({ ok: true, revision: '20:3' });
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      command: 'saveDocument',
      filePath: '/docs/a.md',
      source: '# B',
      expectedRevision: '10:3',
    }));
    expect(result.current.state.documentSessions['/docs/a.md']?.persistedSource).toBe('# B');

    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# C'));
    act(() => result.current.discardDocumentChanges('/docs/a.md'));
    expect(result.current.state.documentSessions['/docs/a.md']?.source).toBe('# B');
  });

  it('sets one document edit mode through the public context API', () => {
    const { bridge } = createEditingBridge();
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
          documentWrite: { supported: true, revision: '10:3' },
        },
      });
    });

    const context = result.current as typeof result.current & {
      setDocumentEditMode?: (filePath: string, mode: 'rendered' | 'inline-edit' | 'plain') => void;
    };
    expect(context.setDocumentEditMode).toBeTypeOf('function');
    if (!context.setDocumentEditMode) return;

    act(() => context.setDocumentEditMode?.('/docs/a.md', 'plain'));
    expect(result.current.state.documentSessions['/docs/a.md']?.mode).toBe('plain');
  });

  it('returns null instead of posting when the file has no editable session', async () => {
    const { bridge } = createEditingBridge();
    const { result } = renderHook(() => useAppState(), { wrapper: wrapperFor(bridge) });
    (bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();

    let saveResult: Awaited<ReturnType<typeof result.current.saveDocument>>;
    await act(async () => {
      saveResult = await result.current.saveDocument('/docs/missing.md');
    });

    expect(saveResult!).toBeNull();
    expect(bridge.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'saveDocument' }));
  });
});
