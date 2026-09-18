import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';

function createBridge(): PlatformBridge {
  return {
    postMessage: vi.fn((_message: WebviewMessage) => undefined),
    onMessage: vi.fn((_handler: (message: HostMessage) => void) => () => undefined),
    getState: vi.fn(() => ({})),
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

describe('repository history sidebar routing', () => {
  it('expands the sidebar and selects History through one public action', () => {
    const bridge = createBridge();
    const { result } = renderHook(() => useAppState(), { wrapper: wrapperFor(bridge) });
    const api = result.current as typeof result.current & { openRepositoryHistorySidebar?: () => void };

    act(() => result.current.dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: true }));
    expect(result.current.state.sidebarCollapsed).toBe(true);
    expect(api.openRepositoryHistorySidebar).toBeTypeOf('function');

    act(() => api.openRepositoryHistorySidebar?.());
    expect(result.current.state.sidebarCollapsed).toBe(false);
    expect(result.current.state.sidebarActiveTab).toBe('history');
  });
});
