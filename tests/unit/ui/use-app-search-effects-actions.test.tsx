import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockView: any = { mode: 'live' };
const mockReturnToHead = vi.fn();
vi.mock('../../../ui/src/contexts/RepositorySnapshotContext', () => ({
  useRepositorySnapshot: () => ({ repositoryView: mockView, returnToHead: mockReturnToHead }),
}));

import { useAppSearchEffects } from '../../../ui/src/useAppSearchEffects';

function setup(stateOverrides: Record<string, any> = {}, extra: Record<string, any> = {}) {
  const handlers: Array<(msg: any) => void> = [];
  const bridge = { postMessage: vi.fn(), onMessage: (h: any) => { handlers.push(h); return () => undefined; } };
  const deps = { navigate: vi.fn(), activateTab: vi.fn(), toggleSidebar: vi.fn(), dispatch: vi.fn(), setIsFullscreen: vi.fn() };
  const hook = renderHook(() => {
    const [pending, setPending] = useState<any>(extra.pending ?? null);
    const effects = useAppSearchEffects({
      bridge,
      state: { currentFile: '/w/a.md', contentHtml: '<p>a</p>', isLoading: false, renderVersion: 1, sidebarCollapsed: true, ...stateOverrides },
      pendingSearchJump: pending,
      setPendingSearchJump: setPending,
      tabs: [{ id: 't1' }],
      ...deps,
    } as any);
    return { pending, effects };
  });
  return { ...hook, bridge, handlers, ...deps };
}

beforeEach(() => { vi.useFakeTimers(); mockView = { mode: 'live' }; mockReturnToHead.mockClear(); document.body.innerHTML = ''; });
afterEach(() => vi.useRealTimers());

describe('useAppSearchEffects actions', () => {
  it('opens sidebar search, expanding a collapsed sidebar', () => {
    const { result, toggleSidebar, dispatch } = setup();
    const focus = vi.fn();
    window.addEventListener('focus-sidebar-search-input', focus);
    act(() => { result.current.effects.openSidebarSearch(); vi.advanceTimersByTime(60); });
    expect(toggleSidebar).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'search' });
    expect(focus).toHaveBeenCalled();
    window.removeEventListener('focus-sidebar-search-input', focus);
  });

  it('handles fullscreen messages and toggles', () => {
    const { result, handlers, setIsFullscreen, bridge } = setup();
    act(() => { handlers.forEach((h) => h({ command: 'fullscreenChanged', isFullscreen: true })); handlers.forEach((h) => h({ command: 'other' })); });
    expect(setIsFullscreen).toHaveBeenCalled();
    act(() => { result.current.effects.toggleFullscreen(); });
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'toggle-fullscreen' });
  });

  it('queues jumps from search-jump events and exits revision mode for live paths', () => {
    mockView = { mode: 'revision', oid: 'x' };
    const { result } = setup();
    act(() => { window.dispatchEvent(new CustomEvent('search-jump', { detail: { filePath: '/w/b.md', query: ' q ', matchCase: true } })); });
    expect(mockReturnToHead).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toMatchObject({ filePath: '/w/b.md', query: 'q', matchCase: true });
    act(() => { window.dispatchEvent(new CustomEvent('search-jump', { detail: { filePath: 'revision://x/a.md', query: 'q' } })); });
    act(() => { window.dispatchEvent(new CustomEvent('search-jump')); });
    expect(mockReturnToHead).toHaveBeenCalledTimes(1);
  });

  it('handles cross-tab selection and workspace selection for other files', () => {
    mockView = { mode: 'revision', oid: 'x' };
    const { result, activateTab, navigate } = setup();
    act(() => { result.current.effects.handleCrossTabSelect({ tabId: 'missing', fsPath: '/w/a.md' }, 'q'); });
    expect(activateTab).not.toHaveBeenCalled();
    act(() => { result.current.effects.handleCrossTabSelect({ tabId: 't1', fsPath: '/w/c.md', lineNumber: 2 }, 'q', true); });
    expect(activateTab).toHaveBeenCalledWith('t1', '/w/c.md');
    expect(mockReturnToHead).toHaveBeenCalled();
    mockView = { mode: 'live' };
    act(() => { result.current.effects.handleWorkspaceSearchSelect({ fsPath: '/w/other.md' }, 'q'); });
    expect(navigate).toHaveBeenCalledWith('/w/other.md');
    act(() => { result.current.effects.queueSearchJump('', 'q'); result.current.effects.queueBookmarkJump('', {} as any); });
  });

  it('keeps a pending jump for another file and reports failures after retries', () => {
    const notice = vi.fn();
    window.addEventListener('markdown-explorer-action-notice', notice);
    const other = setup({ splitView: { enabled: true, activePane: 'right', right: { filePath: '/w/split.md' } } }, { pending: { filePath: '/w/a.md', query: 'x', token: 1 } });
    act(() => { vi.advanceTimersByTime(200); });
    expect(other.result.current.pending).not.toBeNull();
    const failing = setup({}, { pending: { filePath: '/w/a.md', query: 'nomatch', token: 2, failureMessage: 'Not found' } });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(failing.result.current.pending).toBeNull();
    expect(notice).toHaveBeenCalled();
    const bookmark = setup({}, { pending: { filePath: '/w/a.md', query: 'x', token: 3, bookmark: { renderedText: 'x', selectedText: 'x', matchOrdinal: 0, matchIndex: 0, prefix: '', suffix: '' } } });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(bookmark.result.current.pending).toBeNull();
    window.removeEventListener('markdown-explorer-action-notice', notice);
  });
});
