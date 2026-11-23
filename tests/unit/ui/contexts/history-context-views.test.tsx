import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../../../../ui/src/contexts/AppStateContext';
import { HistoryProvider, useHistory, useHistoryView } from '../../../../ui/src/contexts/HistoryContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import { DOCUMENT_COMPARE_REQUEST_EVENT } from '../../../../ui/src/editor/useDocumentConflictResolution';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function bridge(): PlatformBridge {
  return { postMessage: vi.fn(), onMessage: vi.fn(() => () => undefined), getState: vi.fn(() => ({})), setState: vi.fn(), copyToClipboard: vi.fn() } as unknown as PlatformBridge;
}

describe('HistoryContext views', () => {
  it('throws outside the provider and returns an empty view context', () => {
    expect(() => renderHook(() => useHistory())).toThrow('useHistory must be used within HistoryProvider');
    const { result } = renderHook(() => useHistoryView());
    expect(result.current.historyViews).toEqual({});
    expect(result.current.clearHistoryView()).toBeUndefined();
  });

  it('records compare requests as diff views and clears them', () => {
    let latest: ReturnType<typeof useHistory> | null = null;
    function Probe() { latest = useHistory(); return null; }
    render(<PlatformProvider bridge={bridge()}><AppStateProvider><HistoryProvider><Probe /></HistoryProvider></AppStateProvider></PlatformProvider>);
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_COMPARE_REQUEST_EVENT, { detail: {} })); });
    expect(latest!.historyViews).toEqual({});
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_COMPARE_REQUEST_EVENT, { detail: { filePath: '/a.md', leftSource: 'l', rightSource: 'r' } })); });
    expect(latest!.historyViews.single).toMatchObject({ filePath: '/a.md', mode: 'diff', comparison: { leftSource: 'l', rightSource: 'r' } });
    act(() => latest!.clearHistoryView());
    expect(latest!.historyViews.single).toBeUndefined();
    act(() => latest!.openHistory());
    act(() => latest!.closeHistory());
  });
});
