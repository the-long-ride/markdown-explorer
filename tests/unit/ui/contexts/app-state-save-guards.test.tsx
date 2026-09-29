import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function renderEditable() {
  const helpers = createEditingBridge();
  const hook = renderHook(() => useAppState(), { wrapper: wrapperFor(helpers.bridge) });
  act(() => {
    hook.result.current.dispatch({
      type: 'RENDER_CONTENT',
      msg: {
        command: 'renderContent', html: '<h1>A</h1>', markdownSource: '# A', frontmatter: {}, toc: [],
        filePath: '/docs/a.md', relativePath: 'a.md', title: 'A', fileList: [], previewInfo: null,
        documentWrite: { supported: true, revision: '10:3' },
      },
    });
  });
  act(() => hook.result.current.updateSettings({ markdownEditingEnabled: true }));
  (helpers.bridge.postMessage as ReturnType<typeof vi.fn>).mockClear();
  return { ...helpers, ...hook };
}

const savePosts = (bridge: PlatformBridge) => (bridge.postMessage as ReturnType<typeof vi.fn>).mock.calls
  .map(([message]) => message as WebviewMessage)
  .filter((message): message is Extract<WebviewMessage, { command: 'saveDocument' }> => message.command === 'saveDocument');

afterEach(() => {
  vi.useRealTimers();
});

describe('AppStateProvider saveDocument guards', () => {
  it('does not post a save for a clean document', async () => {
    const { bridge, result } = renderEditable();
    let saveResult: Awaited<ReturnType<typeof result.current.saveDocument>> = undefined as never;
    await act(async () => { saveResult = await result.current.saveDocument('/docs/a.md'); });
    expect(saveResult).toBeNull();
    expect(savePosts(bridge)).toHaveLength(0);
  });

  it('returns the in-flight promise instead of posting a second save', async () => {
    const { bridge, result } = renderEditable();
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# B'));
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.saveDocument('/docs/a.md');
      second = result.current.saveDocument('/docs/a.md');
      await Promise.all([first, second]);
    });
    expect(second).toBe(first);
    expect(savePosts(bridge)).toHaveLength(1);
    expect(result.current.state.documentSessions['/docs/a.md']?.saveState).toBe('idle');
  });

  it('keeps saveDocument and guardUnsavedChanges referentially stable across keystrokes', () => {
    const { result } = renderEditable();
    const { saveDocument, guardUnsavedChanges } = result.current;
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# B'));
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# BC'));
    expect(result.current.saveDocument).toBe(saveDocument);
    expect(result.current.guardUnsavedChanges).toBe(guardUnsavedChanges);
  });

  it('saves the latest edit even through a previously captured saveDocument', async () => {
    const { bridge, result } = renderEditable();
    const staleSave = result.current.saveDocument;
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# Latest'));
    await act(async () => { await staleSave('/docs/a.md'); });
    expect(savePosts(bridge)[0]).toMatchObject({ source: '# Latest' });
  });

  it('applies a late host success after the request timed out when the document has not moved on', async () => {
    const { bridge, emit, result } = renderEditable();
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# B'));
    (bridge.postMessage as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    vi.useFakeTimers();

    let saveResult: Awaited<ReturnType<typeof result.current.saveDocument>> = null;
    const pending = result.current.saveDocument('/docs/a.md').then((value) => { saveResult = value; });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_001); await pending; });
    expect(saveResult).toMatchObject({ ok: false, reason: 'write-failed' });
    expect(result.current.state.documentSessions['/docs/a.md']?.revision).toBe('10:3');
    const requestId = savePosts(bridge)[0].requestId;

    await act(async () => {
      emit({ command: 'saveDocumentResult', requestId, filePath: '/docs/a.md', ok: true, revision: '20:3' });
    });
    const session = result.current.state.documentSessions['/docs/a.md'];
    expect(session).toMatchObject({ revision: '20:3', persistedSource: '# B', source: '# B', saveState: 'idle' });
    expect(result.current.state.contentTabs.find((tab) => tab.filePath === '/docs/a.md')?.documentWrite?.revision).toBe('20:3');
  });

  it('ignores a late success when the document revision moved on in the meantime', async () => {
    const { bridge, emit, result } = renderEditable();
    act(() => result.current.setWorkingDocumentSource('/docs/a.md', '# B'));
    (bridge.postMessage as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    vi.useFakeTimers();

    const pending = result.current.saveDocument('/docs/a.md');
    await act(async () => { await vi.advanceTimersByTimeAsync(10_001); await pending; });
    const requestId = savePosts(bridge)[0].requestId;

    // A different result (e.g. the user reloaded the disk version) changed the revision.
    await act(async () => {
      emit({ command: 'saveDocumentResult', requestId: 'unrelated', filePath: '/docs/a.md', ok: true, revision: '99:9' });
      result.current.dispatch({
        type: 'APPLY_SAVE_DOCUMENT_RESULT',
        result: { command: 'saveDocumentResult', requestId: 'manual', filePath: '/docs/a.md', ok: true, revision: '50:3' },
      });
    });
    await act(async () => {
      emit({ command: 'saveDocumentResult', requestId, filePath: '/docs/a.md', ok: true, revision: '20:3' });
    });
    expect(result.current.state.documentSessions['/docs/a.md']?.revision).toBe('50:3');
  });
});
