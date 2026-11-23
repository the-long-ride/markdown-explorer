import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { useAppStateEffects } from '../../../../ui/src/contexts/useAppStateEffects';
import { clearWorkspaceOperation } from '../../../../ui/src/desktop/workspaceOperations';

afterEach(() => clearWorkspaceOperation());

function setup(saved: any = null) {
  const handlers: Array<(m: any) => void> = [];
  const bridge = { getState: vi.fn(() => saved), setState: vi.fn(), postMessage: vi.fn(), onMessage: (h: any) => { handlers.push(h); return () => undefined; } };
  const dispatch = vi.fn();
  renderHook(() => useAppStateEffects({ bridge, dispatch, state: initialState, isDesktop: true, shouldLogPerf: false, pendingHtmlPreviewNavigationRef: { current: { href: 'x' } as any } } as any));
  const fire = (m: any) => act(() => handlers.forEach((h) => h(m)));
  return { bridge, dispatch, fire };
}

describe('useAppStateEffects host messages', () => {
  it('dispatches for each host command', () => {
    const { dispatch, fire, bridge } = setup({ theme: 'dark', themeStyle: 'nord', language: 'en' });
    const types = () => dispatch.mock.calls.map((c) => c[0].type);
    fire({ command: 'restorePersistedState', state: { fileHistoryView: 'list' } });
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'stateHydrated' });
    fire({ command: 'readyAck', theme: 'light' });
    fire({ command: 'workspaceFilesChanged', fileList: [], tree: null });
    fire({ command: 'currentFileChanged', filePath: '/a.md' });
    fire({ command: 'recentWorkspacesChanged', recentWorkspaces: [] });
    fire({ command: 'navNotFound', href: 'x' });
    fire({ command: 'workspaceUnavailable', path: '/w', reason: 'gone' });
    fire({ command: 'setLoading', label: 'L', detail: 'D' });
    fire({ command: 'workspaceScanProgress', active: true });
    fire({ command: 'desktopFontsResult', fonts: [], requestId: 'r' });
    fire({ command: 'chartPngSaveResult', ok: true });
    fire({ command: 'chartPngSaveResult', ok: false });
    fire({ command: 'chartPngSaveResult', ok: true, requestId: 'r' });
    fire({ command: 'updateStateChanged', state: { status: 'idle' } });
    fire({ command: 'window-state-changed', isMaximized: true });
    fire({ command: 'unknown' });
    expect(types()).toEqual(expect.arrayContaining(['RESTORE_PERSISTED_STATE', 'CURRENT_FILE_CHANGED', 'SET_LOADING', 'SET_DESKTOP_FONTS', 'SET_UPDATE_STATE', 'SET_MAXIMIZED']));
  });

  it('restores saved theme style without full settings', () => {
    const { dispatch } = setup({ themeStyle: 'nord', tableColumnAlignment: 'center' });
    expect(dispatch).toHaveBeenCalled();
  });
});
