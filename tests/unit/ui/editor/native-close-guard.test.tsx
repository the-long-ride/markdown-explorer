import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEditableDocumentSession, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';
import { useNativeCloseGuard } from '../../../../ui/src/editor/useNativeCloseGuard';
import { approveNextNativeClose, requestWindowClose } from '../../../../ui/src/editor/nativeCloseApproval';

function createBridge() {
  let listener: ((message: any) => void) | null = null;
  return {
    bridge: {
      onMessage: vi.fn((handler: (message: any) => void) => {
        listener = handler;
        return vi.fn();
      }),
      postMessage: vi.fn(),
    },
    emit(message: any) {
      if (!listener) throw new Error('listener not registered');
      listener(message);
    },
  };
}

describe('renderer native close guard', () => {
  it('defers native close approval to the existing unsaved-changes guard', () => {
    const { bridge, emit } = createBridge();
    const filePath = '/docs/a.md';
    const session = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
    let commit: (() => void) | null = null;
    const guardUnsavedChanges = vi.fn((_paths: string[], next: () => void, _cancel?: () => void) => { commit = next; });

    renderHook(() => useNativeCloseGuard({
      bridge: bridge as any,
      sessions: { [filePath]: session },
      guardUnsavedChanges,
    }));

    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-1', intent: 'app' }));

    expect(guardUnsavedChanges).toHaveBeenCalledWith([filePath], expect.any(Function), expect.any(Function));
    expect(bridge.postMessage).not.toHaveBeenCalled();

    act(() => commit?.());
    expect(bridge.postMessage).toHaveBeenCalledWith({
      command: 'confirmNativeClose',
      requestId: 'native-close-1',
      intent: 'app',
    });
  });

  it('reports cancellation back to the native close coordinator', () => {
    const { bridge, emit } = createBridge();
    const filePath = '/docs/a.md';
    const session = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
    let cancel: (() => void) | null = null;
    const guardUnsavedChanges = vi.fn((_paths: string[], _commit: () => void, onCancel?: () => void) => { cancel = onCancel ?? null; });

    renderHook(() => useNativeCloseGuard({
      bridge: bridge as any,
      sessions: { [filePath]: session },
      guardUnsavedChanges,
    }));

    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-3', intent: 'window' }));
    act(() => cancel?.());

    expect(bridge.postMessage).toHaveBeenCalledWith({
      command: 'confirmNativeClose',
      requestId: 'native-close-3',
      intent: 'window',
      cancelled: true,
    });
  });

  it('approves immediately when there are no dirty sessions', () => {
    const { bridge, emit } = createBridge();
    const guardUnsavedChanges = vi.fn((_paths: string[], commit: () => void, _cancel?: () => void) => commit());

    renderHook(() => useNativeCloseGuard({ bridge: bridge as any, sessions: {}, guardUnsavedChanges }));
    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-2', intent: 'window' }));

    expect(guardUnsavedChanges).not.toHaveBeenCalled();
    expect(bridge.postMessage).toHaveBeenCalledTimes(1);
    expect(bridge.postMessage).toHaveBeenCalledWith({
      command: 'confirmNativeClose',
      requestId: 'native-close-2',
      intent: 'window',
    });
  });

  it('does not ask again right after the renderer close button already approved leaving', () => {
    const { bridge, emit } = createBridge();
    const filePath = '/docs/a.md';
    // A stale dirty snapshot: the discard the user just chose has not re-rendered into `sessions` yet.
    const session = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
    const guardUnsavedChanges = vi.fn();
    renderHook(() => useNativeCloseGuard({ bridge: bridge as any, sessions: { [filePath]: session }, guardUnsavedChanges }));

    requestWindowClose({ postMessage: vi.fn() }, (commit) => commit());
    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-4', intent: 'app' }));

    expect(guardUnsavedChanges).not.toHaveBeenCalled();
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'confirmNativeClose', requestId: 'native-close-4', intent: 'app' });

    // The approval is single-use: the next native close is guarded again.
    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-5', intent: 'app' }));
    expect(guardUnsavedChanges).toHaveBeenCalledTimes(1);
  });

  it('does not treat an old approval as valid forever', () => {
    const { bridge, emit } = createBridge();
    const filePath = '/docs/a.md';
    const session = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
    const guardUnsavedChanges = vi.fn();
    renderHook(() => useNativeCloseGuard({ bridge: bridge as any, sessions: { [filePath]: session }, guardUnsavedChanges }));

    approveNextNativeClose(Date.now() - 60_000);
    act(() => emit({ command: 'nativeCloseRequested', requestId: 'native-close-6', intent: 'window' }));
    expect(guardUnsavedChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps a single listener registered while sessions change', () => {
    const { bridge } = createBridge();
    const { rerender } = renderHook(({ sessions }) => useNativeCloseGuard({
      bridge: bridge as any, sessions, guardUnsavedChanges: vi.fn(),
    }), { initialProps: { sessions: {} as Record<string, ReturnType<typeof createEditableDocumentSession>> } });
    rerender({ sessions: { '/docs/a.md': createEditableDocumentSession('/docs/a.md', '# A', '1:3') } });
    expect(bridge.onMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated host messages', () => {
    const { bridge, emit } = createBridge();
    const guardUnsavedChanges = vi.fn();

    renderHook(() => useNativeCloseGuard({ bridge: bridge as any, sessions: {}, guardUnsavedChanges }));
    act(() => emit({ command: 'window-state-changed', isMaximized: true }));

    expect(guardUnsavedChanges).not.toHaveBeenCalled();
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
});
