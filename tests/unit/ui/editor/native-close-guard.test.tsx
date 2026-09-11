import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEditableDocumentSession, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';
import { useNativeCloseGuard } from '../../../../ui/src/editor/useNativeCloseGuard';

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

    expect(guardUnsavedChanges).toHaveBeenCalledWith([], expect.any(Function), expect.any(Function));
    expect(bridge.postMessage).toHaveBeenCalledWith({
      command: 'confirmNativeClose',
      requestId: 'native-close-2',
      intent: 'window',
    });
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
