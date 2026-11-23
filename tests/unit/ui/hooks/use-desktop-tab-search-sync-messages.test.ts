import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginWorkspaceOperation, clearWorkspaceOperation } from '../../../../ui/src/desktop/workspaceOperations';
import { createExternalOpenCommand, useDesktopTabSearchSync } from '../../../../ui/src/hooks/useDesktopTabSearchSync';

afterEach(() => clearWorkspaceOperation());

function setup(opts: { isTabView?: boolean; tabs?: any[]; replacement?: any } = {}) {
  const handlers: Array<(m: any) => void> = [];
  const bridge = { postMessage: vi.fn(), onMessage: (h: any) => { handlers.push(h); return () => undefined; } };
  let tabs = opts.tabs ?? [{ id: 'w1', kind: 'workspace', workspacePath: '/w', fileList: [], isIndexed: false }];
  const setTabs = vi.fn((u: any) => { tabs = typeof u === 'function' ? u(tabs) : u; });
  const replacementRef = { current: opts.replacement ?? null };
  const hook = renderHook(() => useDesktopTabSearchSync({
    tabs, tabsRef: { current: tabs }, setTabs, pendingWorkspaceTabIdRef: { current: null }, pendingWorkspaceReplacementRef: replacementRef,
    requestedWorkspaceIndexesRef: { current: new Set() }, bridge, isTabView: opts.isTabView ?? true, isLoading: false,
    createNewWorkspaceTab: () => 'new-tab', beginOperationForTab: (id: string) => ({ workspaceOperationId: 'op', workspaceTabId: id }),
  } as any));
  const fire = (m: any) => act(() => handlers.forEach((h) => h(m)));
  return { hook, bridge, setTabs, fire, replacementRef, getTabs: () => tabs };
}

describe('useDesktopTabSearchSync host messages', () => {
  it('requests search indexes for unindexed workspace tabs once', () => {
    vi.useFakeTimers();
    const { bridge, hook, fire, getTabs } = setup();
    act(() => { vi.advanceTimersByTime(1100); });
    vi.useRealTimers();
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'loadWorkspaceSearchIndexes', tabs: [{ tabId: 'w1', workspacePath: '/w' }] });
    hook.rerender();
    expect(bridge.postMessage).toHaveBeenCalledTimes(1);
    fire({ command: 'workspaceSearchIndexLoaded', tabs: [{ tabId: 'w1', workspacePath: '/w', fileList: [{ fsPath: '/w/a.md' }], tree: null }, { tabId: 'zz', workspacePath: '/z' }] });
    expect(getTabs()[0].isIndexed).toBe(true);
  });

  it('cancels a pending replacement and resets the tab state', () => {
    const { fire, replacementRef, setTabs } = setup({ replacement: { workspaceOperationId: 'r1', oldPath: '/old' } });
    fire({ command: 'workspaceOpenCancelled', workspaceOperationId: 'other' });
    expect(replacementRef.current).not.toBeNull();
    fire({ command: 'workspaceOpenCancelled', workspaceOperationId: 'r1', workspaceTabId: 'w1' });
    expect(replacementRef.current).toBeNull();
    expect(setTabs).toHaveBeenCalled();
  });

  it('routes external open requests and open-path messages', () => {
    const tabView = setup();
    tabView.fire({ command: 'externalOpenRequest', request: { mode: 'folder', folderPath: '/f' } });
    expect(tabView.bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openPath', path: '/f', workspaceTabId: 'new-tab' }));
    const focus = setup({ isTabView: false, tabs: [] });
    focus.fire({ command: 'externalOpenRequest', request: { mode: 'file', filePath: '/f/a.md', folderPath: '/f' } });
    expect(focus.bridge.postMessage).toHaveBeenCalledWith({ command: 'openPath', path: '/f/a.md', openFirstFile: false });
    focus.fire({ command: 'externalOpenPath', path: '/x' });
    expect(focus.bridge.postMessage).toHaveBeenCalledWith({ command: 'openPath', path: '/x', openFirstFile: false });
    tabView.fire({ command: 'externalOpenPath', path: '/y' });
    focus.fire({ command: 'workspaceSearchIndexLoaded', tabs: [] });
  });

  it('builds parent-workspace activation commands', () => {
    expect(createExternalOpenCommand({ mode: 'file-with-parent-workspace', folderPath: '/f', filePath: '/f/a.md' } as any)).toMatchObject({ command: 'activateWorkspace', workspacePath: '/f' });
  });
  it('tracks loading state for the active workspace operation and clears replacements on ready', () => {
    const { fire, getTabs, replacementRef } = setup({ replacement: { workspaceOperationId: 'rep', oldPath: '/o' } });
    const op = beginWorkspaceOperation('w1');
    const ids = { workspaceOperationId: op.workspaceOperationId, workspaceTabId: 'w1' };
    fire({ command: 'setLoading', ...ids });
    expect(getTabs()[0].workspaceLoadState).toBe('loading');
    fire({ command: 'workspaceScanProgress', active: false, ...ids });
    expect(getTabs()[0].workspaceLoadState).toBe('ready');
    fire({ command: 'workspaceScanProgress', active: true, ...ids });
    expect(getTabs()[0].workspaceLoadState).toBe('loading');
    fire({ command: 'workspaceFilesChanged', ...ids });
    fire({ command: 'setLoading', workspaceOperationId: 'stale', workspaceTabId: 'w1' });
    fire({ command: 'readyAck', workspaceOperationId: 'rep' });
    expect(replacementRef.current).toBeNull();
    fire({ command: 'workspaceOpenCancelled', ...ids });
    expect(getTabs()[0].workspaceLoadState).toBe('ready');
  });
});
