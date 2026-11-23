import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginWorkspaceOperation, clearWorkspaceOperation, getActiveWorkspaceOperation } from '../../../../ui/src/desktop/workspaceOperations';

let initial: any = null;
vi.mock('../../../../ui/src/desktop/desktopTabs', async (orig) => {
  const actual: any = await orig();
  return { ...actual, readInitialDesktopState: () => initial ?? actual.readInitialDesktopState(), writePersistedDesktopTabs: vi.fn(), writeWorkspaceAliases: vi.fn() };
});

import { createEmptyTab, writePersistedDesktopTabs } from '../../../../ui/src/desktop/desktopTabs';
import { useDesktopTabs } from '../../../../ui/src/hooks/useDesktopTabs';

function state(overrides: Record<string, any> = {}): any {
  return { fileList: [], tree: null, currentFile: null, contentHtml: '', markdownSource: null, frontmatter: {}, toc: [], previewInfo: null,
    relativePath: '', isLoading: false, notFoundHref: null, workspaceName: '', workspacePath: undefined, theme: 'system', themeStyle: 'default',
    defaultExpanded: false, contentTabs: [], activeContentTabPath: null, recentWorkspaces: [], renderVersion: 1, appVersion: '1.0.0',
    workspaceUnavailablePath: null, workspaceUnavailableReason: null, ...overrides };
}

function setup(s: any, opts: { isDesktop?: boolean; isTabView?: boolean } = {}) {
  const dispatch = vi.fn();
  const bridge = { postMessage: vi.fn(), onMessage: () => () => undefined };
  const hook = renderHook(() => useDesktopTabs({ state: s, dispatch, bridge, isDesktop: opts.isDesktop ?? true, isTabView: opts.isTabView ?? true, setNavigationScope: vi.fn() } as any));
  return { hook, dispatch, bridge };
}

afterEach(() => { initial = null; clearWorkspaceOperation(); vi.mocked(writePersistedDesktopTabs).mockClear(); });

describe('useDesktopTabs restore edges', () => {
  it('restores saved content tabs once the workspace file list is loaded', () => {
    const ws = { ...createEmptyTab('w1', 'workspace'), workspacePath: '/w', workspaceName: 'W', restoredContentTabPaths: ['/w/a.md'] };
    initial = { workspaceAliases: {}, tabs: [createEmptyTab('home', 'home'), ws], activeTabId: 'w1' };
    const { dispatch, hook } = setup(state({ workspacePath: '/w', workspaceName: 'W', fileList: [{ fsPath: '/w/a.md' }] }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESTORE_CONTENT_TABS', filePaths: ['/w/a.md'] });
    expect(hook.result.current.tabs.find((t: any) => t.id === 'w1')?.restoredContentTabPaths).toBeUndefined();
  });

  it('falls back to home when the persisted active tab is missing and skips persistence off desktop', () => {
    initial = { workspaceAliases: {}, tabs: [createEmptyTab('home', 'home')], activeTabId: 'ghost' };
    const { hook } = setup(state(), { isDesktop: false });
    expect(hook.result.current.activeTabId).toBe('home');
    expect(writePersistedDesktopTabs).not.toHaveBeenCalled();
  });

  it('cancels an in-flight scan when switching to the home tab', () => {
    const ws = { ...createEmptyTab('w1', 'workspace'), workspacePath: '/w', workspaceName: 'W', workspaceLoadState: 'loading' };
    initial = { workspaceAliases: {}, tabs: [createEmptyTab('home', 'home'), ws], activeTabId: 'w1' };
    const { hook, bridge } = setup(state({ workspacePath: '/w', workspaceName: 'W' }));
    clearWorkspaceOperation();
    const op = beginWorkspaceOperation('w1');
    act(() => { hook.result.current.activateTab('home'); });
    expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'cancelWorkspaceScan', workspaceOperationId: op.workspaceOperationId });
    expect(getActiveWorkspaceOperation()).toBeNull();
    act(() => { hook.result.current.activateTab('missing'); });
    expect(hook.result.current.activeTabId).toBe('home');
  });
});
