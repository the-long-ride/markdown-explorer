import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesktopTabs } from '../../../../ui/src/hooks/useDesktopTabs';

let nextTabId = 0;

vi.mock('../../../../ui/src/desktop/desktopTabs', () => ({
  createEmptyTab: (id: string, kind: string) => ({
    id,
    kind,
    fileList: [],
    tree: null,
    currentFile: null,
    contentHtml: '',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    relativePath: '',
    isLoading: false,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    contentTabs: [],
    activeContentTabPath: null,
    isIndexed: false,
  }),
  createTabId: () => {
    nextTabId += 1;
    return `tab-mock-${nextTabId}`;
  },
  getTabLabel: (tab: any) => tab.alias || tab.workspaceName || (tab.kind === 'home' ? 'Home' : 'New workspace'),
  reorderDesktopTabs: (tabs: any[], sourceId: string, targetId: string) => {
    const sourceIndex = tabs.findIndex((tab) => tab.id === sourceId && tab.kind !== 'home');
    const targetIndex = tabs.findIndex((tab) => tab.id === targetId && tab.kind !== 'home');
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return tabs;
    const nextTabs = [...tabs];
    const [source] = nextTabs.splice(sourceIndex, 1);
    nextTabs.splice(nextTabs.findIndex((tab) => tab.id === targetId), 0, source);
    return nextTabs;
  },
  readInitialDesktopState: () => ({
    workspaceAliases: {} as Record<string, string>,
    tabs: [
      {
        id: 'home',
        kind: 'home',
        fileList: [],
        tree: null,
        currentFile: null,
        contentHtml: '',
        markdownSource: null,
        frontmatter: {},
        toc: [],
        previewInfo: null,
        relativePath: '',
        isLoading: false,
        notFoundHref: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
        contentTabs: [],
        activeContentTabPath: null,
        isIndexed: false,
      },
    ],
    activeTabId: 'home',
  }),
  readToolbarPosition: () => ({ x: 36, y: 36 }),
  writePersistedDesktopTabs: vi.fn(),
  writeWorkspaceAliases: vi.fn(),
}));

vi.mock('../../../../ui/src/desktop/constants', () => ({
  FLOATING_TOOLBAR_STORAGE_KEY: 'markdown-explorer-tab-toolbar-position',
}));

import { writePersistedDesktopTabs, writeWorkspaceAliases } from '../../../../ui/src/desktop/desktopTabs';

function makeState(overrides: Record<string, any> = {}): any {
  return {
    fileList: [],
    tree: null,
    currentFile: null,
    contentHtml: '',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    relativePath: '',
    isLoading: false,
    notFoundHref: null,
    workspaceName: '',
    workspacePath: undefined,
    theme: 'system',
    themeStyle: 'default',
    defaultExpanded: false,
    contentTabs: [],
    activeContentTabPath: null,
    recentWorkspaces: [],
    renderVersion: 1,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    ...overrides,
  };
}

function makeBridge() {
  const handlers: Array<(msg: any) => void> = [];
  return {
    postMessage: vi.fn(),
    onMessage: vi.fn((handler: (msg: any) => void) => {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    }),
    _fireMessage: (msg: any) => {
      for (const h of handlers) h(msg);
    },
  };
}

describe('useDesktopTabs', () => {
  beforeEach(() => {
    nextTabId = 0;
    localStorage.clear();
    vi.useFakeTimers();
  });

  function setupHook(overrides: Record<string, any> = {}) {
    const state = makeState(overrides.state ?? {});
    const dispatch = vi.fn();
    const bridge = makeBridge();
    const setNavigationScope = vi.fn();

    const input = {
      state,
      dispatch,
      bridge,
      isDesktop: overrides.isDesktop ?? true,
      isTabView: overrides.isTabView ?? true,
      setNavigationScope,
    };

    const hookResult = renderHook((props) => useDesktopTabs(props), {
      initialProps: input,
    });

    return {
      result: hookResult.result,
      rerender: hookResult.rerender,
      unmount: hookResult.unmount,
      dispatch,
      bridge,
      setNavigationScope,
      state,
      input,
    };
  }

  describe('initial state', () => {
    it('creates home tab by default', () => {
      const { result } = setupHook();
      expect(result.current.activeTabId).toBe('home');
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].kind).toBe('home');
    });

    it('initializes toolbar position from readToolbarPosition', () => {
      const { result } = setupHook();
      expect(result.current.toolbarPosition).toEqual({ x: 36, y: 36 });
    });

    it('initializes workspaceAliases from readInitialDesktopState', () => {
      const { result } = setupHook();
      expect(result.current.workspaceAliases).toEqual({});
    });

    it('has empty pendingDroppedPath', () => {
      const { result } = setupHook();
      expect(result.current.pendingDroppedPath).toBeNull();
    });
  });

  describe('activateTab', () => {
    it('sends empty workspace + closeWorkspace for home tab', () => {
      const { result, dispatch, bridge } = setupHook();

      act(() => {
        result.current.activateTab('home');
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'READY_ACK', workspaceName: '', workspacePath: undefined }),
      );
      expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
    });

    it('sends empty workspace for new-kind tab without workspacePath', () => {
      const { result, dispatch, bridge } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      dispatch.mockClear();
      bridge.postMessage.mockClear();

      act(() => {
        result.current.activateTab(tabId);
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'READY_ACK', workspaceName: '' }),
      );
      expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
    });

    it('sends READY_ACK + activateWorkspace for workspace tabs with workspacePath', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, dispatch, bridge, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<h1>Hi</h1>',
        fileList: [{ fsPath: '/ws/readme.md', title: 'Readme', fileName: 'readme.md', relativePath: 'readme.md' }],
        renderVersion: 2,
      });

      rerender(input);

      dispatch.mockClear();
      bridge.postMessage.mockClear();

      act(() => {
        result.current.activateTab(tabId);
      });

      const readyAckCalls = dispatch.mock.calls.filter((c: any[]) => c[0].type === 'READY_ACK');
      expect(readyAckCalls.length).toBeGreaterThan(0);
      expect(readyAckCalls[0][0].workspaceName).not.toBe('');

      const activateCalls = bridge.postMessage.mock.calls.filter((c: any[]) => c[0].command === 'activateWorkspace');
      expect(activateCalls.length).toBeGreaterThan(0);
    });

    it('calls SET_LOADING when targetFilePath differs from tab.currentFile', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, dispatch, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<h1>Hi</h1>',
        renderVersion: 2,
      });
      rerender(input);

      dispatch.mockClear();

      act(() => {
        result.current.activateTab(tabId, '/ws/other.md');
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_LOADING' });
    });

    it('sends activateWorkspace with workspacePath', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, bridge, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<h1>Hi</h1>',
        renderVersion: 2,
      });
      rerender(input);

      bridge.postMessage.mockClear();

      act(() => {
        result.current.activateTab(tabId);
      });

      const activateCalls = bridge.postMessage.mock.calls.filter((c: any[]) => c[0].command === 'activateWorkspace');
      expect(activateCalls.length).toBeGreaterThan(0);
      expect(activateCalls[0][0].workspacePath).toBeDefined();
    });

    it('does nothing for non-existent tab id', () => {
      const { result } = setupHook();

      const prevActive = result.current.activeTabId;
      act(() => {
        result.current.activateTab('nonexistent-tab');
      });

      expect(result.current.activeTabId).toBe(prevActive);
    });
  });

  describe('createNewWorkspaceTab', () => {
    it('creates a new tab and returns its id', () => {
      const { result } = setupHook();

      let newId: string = '';
      act(() => { newId = result.current.createNewWorkspaceTab(); });

      expect(newId).toMatch(/^tab-mock-/);
      expect(result.current.tabs.length).toBe(2);
      expect(result.current.activeTabId).toBe(newId);
      const newTab = result.current.tabs.find((t: any) => t.id === newId);
      expect(newTab?.kind).toBe('new');
    });

    it('dispatches empty workspace', () => {
      const { result, dispatch } = setupHook();

      act(() => { result.current.createNewWorkspaceTab(); });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'READY_ACK', workspaceName: '' }),
      );
    });

    it('sets navigation scope in tab view', () => {
      const { result, setNavigationScope } = setupHook({ isTabView: true });

      let newId = '';
      act(() => { newId = result.current.createNewWorkspaceTab(); });

      expect(setNavigationScope).toHaveBeenCalledWith(newId);
    });

    it('sets navigation scope to focus in focus view', () => {
      const { result, setNavigationScope } = setupHook({ isTabView: false });

      act(() => { result.current.createNewWorkspaceTab(); });

      expect(setNavigationScope).toHaveBeenCalledWith('focus');
    });
  });

  describe('prepareWorkspaceOpen', () => {
    it('creates new workspace tab if active is home', () => {
      const { result } = setupHook({ isTabView: true });

      const prevCount = result.current.tabs.length;
      act(() => { result.current.prepareWorkspaceOpen(); });

      expect(result.current.tabs.length).toBeGreaterThan(prevCount);
    });

    it('keeps existing tab if active is workspace kind', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<p>hi</p>',
        renderVersion: 2,
      });
      rerender(input);

      const countBefore = result.current.tabs.length;
      act(() => { result.current.prepareWorkspaceOpen(); });

      expect(result.current.tabs.length).toBe(countBefore);
    });

    it('does nothing if not tab view', () => {
      const { result } = setupHook({ isTabView: false });

      const countBefore = result.current.tabs.length;
      act(() => { result.current.prepareWorkspaceOpen(); });

      expect(result.current.tabs.length).toBe(countBefore);
    });
  });

  describe('openDroppedPath', () => {
    it('in tab view, creates workspace tab and opens path', () => {
      const { result, bridge } = setupHook({ isTabView: true });

      act(() => { result.current.openDroppedPath('/dropped/file.md'); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'openPath', path: '/dropped/file.md' }),
      );
      expect(result.current.tabs.length).toBeGreaterThan(1);
    });

    it('in focus view with active workspace, sets pending path', () => {
      const { result } = setupHook({
        state: makeState({ workspaceName: 'ws', workspacePath: '/ws' }),
        isTabView: false,
      });

      act(() => { result.current.openDroppedPath('/dropped/file.md'); });

      expect(result.current.pendingDroppedPath).toBe('/dropped/file.md');
    });

    it('in focus view without active workspace, opens path directly', () => {
      const { result, bridge } = setupHook({
        state: makeState({ workspaceName: '', workspacePath: undefined }),
        isTabView: false,
      });

      act(() => { result.current.openDroppedPath('/dropped/file.md'); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'openPath', path: '/dropped/file.md' }),
      );
      expect(result.current.pendingDroppedPath).toBeNull();
    });

    it('ignores empty path', () => {
      const { result, bridge } = setupHook();
      const openPathCallsBefore = bridge.postMessage.mock.calls.filter(
        (c: any[]) => c[0].command === 'openPath',
      ).length;

      act(() => { result.current.openDroppedPath(''); });

      const openPathCallsAfter = bridge.postMessage.mock.calls.filter(
        (c: any[]) => c[0].command === 'openPath',
      ).length;
      expect(openPathCallsAfter).toBe(openPathCallsBefore);
    });

    it('reuses existing new tab when active is new kind in tab view', () => {
      const { result, bridge } = setupHook({ isTabView: true });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      const countBefore = result.current.tabs.length;

      bridge.postMessage.mockClear();
      act(() => { result.current.openDroppedPath('/path/to/file.md'); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'openPath', path: '/path/to/file.md' }),
      );
    });
  });

  describe('confirmSwitchWorkspace', () => {
    it('sends openPath with pending path and clears it', () => {
      const { result, bridge } = setupHook({
        state: makeState({ workspaceName: 'ws', workspacePath: '/ws' }),
        isTabView: false,
      });

      act(() => { result.current.openDroppedPath('/new/workspace'); });
      expect(result.current.pendingDroppedPath).toBe('/new/workspace');

      act(() => { result.current.confirmSwitchWorkspace(); });

      expect(bridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'openPath', path: '/new/workspace' }),
      );
      expect(result.current.pendingDroppedPath).toBeNull();
    });

    it('does nothing if no pending path', () => {
      const { result, bridge } = setupHook();
      const callCount = bridge.postMessage.mock.calls.length;

      act(() => { result.current.confirmSwitchWorkspace(); });

      expect(bridge.postMessage.mock.calls.length).toBe(callCount);
    });
  });

  describe('closeTab', () => {
    it('removes the tab from tabs', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });

      expect(result.current.tabs.length).toBe(3);

      act(() => { result.current.closeTab(tab2); });

      expect(result.current.tabs.find((t: any) => t.id === tab2)).toBeUndefined();
    });

    it('falls back to adjacent tab when closing the active tab', () => {
      const { result } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });
      expect(result.current.activeTabId).toBe(tabId);

      act(() => { result.current.closeTab(tabId); });

      vi.advanceTimersByTime(0);

      expect(result.current.tabs.find((t: any) => t.id === tabId)).toBeUndefined();
    });

    it('recreates home tab if closing the last remaining tab', () => {
      const { result } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      act(() => { result.current.closeTab('home'); });
      act(() => { result.current.closeTab(tabId); });

      expect(result.current.tabs.length).toBeGreaterThanOrEqual(1);
      expect(result.current.tabs.some((t: any) => t.kind === 'home')).toBe(true);
    });

    it('does nothing for non-existent tab', () => {
      const { result } = setupHook();

      const countBefore = result.current.tabs.length;
      act(() => { result.current.closeTab('nonexistent'); });

      expect(result.current.tabs.length).toBe(countBefore);
    });

    it('does not change active tab when closing an inactive tab', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });

      expect(result.current.activeTabId).toBe(tab2);

      act(() => { result.current.closeTab(tab1); });

      expect(result.current.activeTabId).toBe(tab2);
    });
  });

  describe('closeTabsToRight', () => {
    it('removes workspace tabs to the right of target', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '', tab3 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });
      act(() => { tab3 = result.current.createNewWorkspaceTab(); });

      expect(result.current.tabs.length).toBe(4);

      act(() => { result.current.closeTabsToRight(tab1); });

      const remainingIds = result.current.tabs.map((t: any) => t.id);
      expect(remainingIds).toContain('home');
      expect(remainingIds).toContain(tab1);
      expect(remainingIds).not.toContain(tab2);
      expect(remainingIds).not.toContain(tab3);
    });

    it('does nothing if target is last workspace tab', () => {
      const { result } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      const countBefore = result.current.tabs.length;
      act(() => { result.current.closeTabsToRight(tabId); });

      expect(result.current.tabs.length).toBe(countBefore);
    });

    it('schedules activateTab for target if active tab was removed', () => {
      const { result, bridge } = setupHook();

      let tab1 = '', tab2 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });

      const tab2Index = result.current.tabs.findIndex((t: any) => t.id === tab2);
      expect(tab2Index).toBeGreaterThan(-1);

      act(() => { result.current.closeTabsToRight(tab1); });

      expect(result.current.tabs.find((t: any) => t.id === tab2)).toBeUndefined();
    });
  });

  describe('reorderTabs', () => {
    it('moves a workspace tab before the drop target without moving home', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });

      act(() => { result.current.reorderTabs(tab2, tab1); });

      expect(result.current.tabs.map((tab: any) => tab.id)).toEqual(['home', tab2, tab1]);
    });

    it('does not move the home tab', () => {
      const { result } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });
      act(() => { result.current.reorderTabs('home', tabId); });

      expect(result.current.tabs[0].id).toBe('home');
    });
  });

  describe('closeOtherTabs', () => {
    it('keeps home and target tab only', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '', tab3 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });
      act(() => { tab3 = result.current.createNewWorkspaceTab(); });

      act(() => { result.current.closeOtherTabs(tab1); });

      const remainingIds = result.current.tabs.map((t: any) => t.id);
      expect(remainingIds).toContain('home');
      expect(remainingIds).toContain(tab1);
      expect(remainingIds).not.toContain(tab2);
      expect(remainingIds).not.toContain(tab3);
    });

    it('does nothing if target is home tab', () => {
      const { result } = setupHook();

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      const countBefore = result.current.tabs.length;
      act(() => { result.current.closeOtherTabs('home'); });

      expect(result.current.tabs.length).toBe(countBefore);
    });

    it('schedules activateTab for target when active is different', () => {
      const { result } = setupHook();

      let tab1 = '', tab2 = '';
      act(() => { tab1 = result.current.createNewWorkspaceTab(); });
      act(() => { tab2 = result.current.createNewWorkspaceTab(); });

      expect(result.current.activeTabId).toBe(tab2);

      act(() => { result.current.closeOtherTabs(tab1); });

      expect(result.current.tabs.find((t: any) => t.id === tab2)).toBeUndefined();
      expect(result.current.tabs.map((t: any) => t.id)).toContain(tab1);
    });
  });

  describe('closeAllTabs', () => {
    it('keeps only home tab', () => {
      const { result } = setupHook();

      act(() => { result.current.createNewWorkspaceTab(); });
      act(() => { result.current.createNewWorkspaceTab(); });

      expect(result.current.tabs.length).toBe(3);

      act(() => { result.current.closeAllTabs(); });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].kind).toBe('home');
    });

    it('sends closeWorkspace via bridge', () => {
      const { result, bridge } = setupHook();

      act(() => { result.current.createNewWorkspaceTab(); });

      act(() => { result.current.closeAllTabs(); });

      vi.advanceTimersByTime(0);

      expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
    });

    it('dispatches empty workspace', () => {
      const { result, dispatch } = setupHook();

      act(() => { result.current.createNewWorkspaceTab(); });

      dispatch.mockClear();

      act(() => { result.current.closeAllTabs(); });

      vi.advanceTimersByTime(0);

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'READY_ACK', workspaceName: '' }),
      );
    });
  });

  describe('updateWorkspaceAlias', () => {
    it('sets alias for a workspace path', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/my/workspace', 'My Project', 'workspace');
      });

      expect(result.current.workspaceAliases['/my/workspace']).toBe('My Project');
    });

    it('clears alias when it matches fallbackName', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/my/workspace', 'workspace', 'workspace');
      });

      expect(result.current.workspaceAliases['/my/workspace']).toBeUndefined();
    });

    it('clears alias when it is empty/whitespace', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/my/workspace', 'My Project', 'workspace');
      });
      expect(result.current.workspaceAliases['/my/workspace']).toBe('My Project');

      act(() => {
        result.current.updateWorkspaceAlias('/my/workspace', '   ', 'workspace');
      });

      expect(result.current.workspaceAliases['/my/workspace']).toBeUndefined();
    });

    it('normalizes alias by trimming whitespace', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/ws', '  My Alias  ', 'other');
      });

      expect(result.current.workspaceAliases['/ws']).toBe('My Alias');
    });

    it('sets alias on tabs with matching workspacePath', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/ws', 'Custom Alias', 'ws');
      });

      expect(result.current.workspaceAliases['/ws']).toBe('Custom Alias');
    });

    it('clears tab alias when normalized alias matches fallback', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateWorkspaceAlias('/ws', 'ws-name', 'ws-name');
      });

      expect(result.current.workspaceAliases['/ws']).toBeUndefined();
    });
  });

  describe('updateTabAlias', () => {
    it('delegates to updateWorkspaceAlias if tab has workspacePath', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateTabAlias('home', 'Home Alias');
      });

      const homeTab = result.current.tabs.find((t: any) => t.id === 'home');
      expect((homeTab as any).alias).toBe('Home Alias');
    });

    it('updates alias directly on tab without workspacePath', () => {
      const { result } = setupHook();

      act(() => {
        result.current.updateTabAlias('home', 'My Home');
      });

      const homeTab = result.current.tabs.find((t: any) => t.id === 'home');
      expect((homeTab as any).alias).toBe('My Home');
    });

    it('clears alias when empty string provided for non-workspace tab', () => {
      const { result } = setupHook();

      act(() => { result.current.updateTabAlias('home', 'Alias'); });

      act(() => { result.current.updateTabAlias('home', '  '); });

      const homeTab = result.current.tabs.find((t: any) => t.id === 'home');
      expect((homeTab as any).alias).toBeUndefined();
    });

    it('does nothing for non-existent tab', () => {
      const { result } = setupHook();
      const countBefore = result.current.tabs.length;

      act(() => { result.current.updateTabAlias('nonexistent', 'Name'); });

      expect(result.current.tabs.length).toBe(countBefore);
    });
  });

  describe('crossTabSearchItems', () => {
    it('returns items from workspace tabs with fileList entries', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, rerender, input, bridge } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<p>hi</p>',
        fileList: [
          { fsPath: '/ws/a.md', title: 'A', fileName: 'a.md', relativePath: 'a.md' },
          { fsPath: '/ws/b.md', title: 'B', fileName: 'b.md', relativePath: 'b.md' },
        ],
        renderVersion: 2,
      });
      rerender(input);

      act(() => {
        bridge._fireMessage({
          command: 'workspaceSearchIndexLoaded',
          tabs: [{
            tabId,
            workspacePath: '/ws',
            fileList: [
              { fsPath: '/ws/a.md', title: 'A', fileName: 'a.md', relativePath: 'a.md' },
              { fsPath: '/ws/b.md', title: 'B', fileName: 'b.md', relativePath: 'b.md' },
            ],
            tree: { name: 'ws', children: [] },
          }],
        });
      });

      const wsTab = result.current.tabs.find((t: any) => t.id === tabId);
      if (wsTab && wsTab.kind === 'workspace' && wsTab.fileList.length > 0) {
        const items = result.current.crossTabSearchItems;
        expect(items.length).toBe(2);
        expect(items[0].tabId).toBe(tabId);
        expect(items[0].fsPath).toBe('/ws/a.md');
      }
    });

    it('returns empty array when no workspace tabs exist', () => {
      const { result } = setupHook();
      expect(result.current.crossTabSearchItems).toEqual([]);
    });

    it('excludes home and new kind tabs', () => {
      const { result } = setupHook();

      act(() => { result.current.createNewWorkspaceTab(); });

      expect(result.current.crossTabSearchItems).toEqual([]);
    });
  });

  describe('isIndexingAcrossTabs', () => {
    it('returns false when not in tab view', () => {
      const { result } = setupHook({ isTabView: false });
      expect(result.current.isIndexingAcrossTabs).toBe(false);
    });

    it('returns true when a workspace tab is unindexed with empty fileList', () => {
      const { result, bridge } = setupHook({ isTabView: true });

      act(() => { result.current.openDroppedPath('/ws/file.md'); });
      act(() => {
        bridge._fireMessage({
          command: 'workspaceSearchIndexLoaded',
          tabs: [],
        });
      });

      const wsTabs = result.current.tabs.filter((t: any) => t.kind === 'workspace');
      if (wsTabs.length === 0) {
        expect(result.current.isIndexingAcrossTabs).toBe(false);
        return;
      }

      const hasUnindexed = wsTabs.some((t: any) => !t.isIndexed && t.fileList.length === 0 && t.workspacePath);
      expect(result.current.isIndexingAcrossTabs).toBe(hasUnindexed);
    });

    it('returns false when not tab view', () => {
      const { result } = setupHook({ isTabView: false });
      expect(result.current.isIndexingAcrossTabs).toBe(false);
    });
  });

  describe('toolbar position', () => {
    it('persists to localStorage on change', () => {
      const { result } = setupHook();

      act(() => {
        result.current.setToolbarPosition({ x: 100, y: 200 });
      });

      const stored = JSON.parse(
        localStorage.getItem('markdown-explorer-tab-toolbar-position')!,
      );
      expect(stored).toEqual({ x: 100, y: 200 });
    });
  });

  describe('bridge message handler', () => {
    it('handles workspaceSearchIndexLoaded message', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, bridge, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<p>hi</p>',
        renderVersion: 2,
      });
      rerender(input);

      act(() => {
        bridge._fireMessage({
          command: 'workspaceSearchIndexLoaded',
          tabs: [
            {
              tabId,
              workspacePath: '/ws',
              fileList: [
                { fsPath: '/ws/a.md', title: 'A', fileName: 'a.md', relativePath: 'a.md' },
              ],
              tree: { name: 'ws', children: [] },
            },
          ],
        });
      });

      const updated = result.current.tabs.find((t: any) => t.id === tabId);
      expect((updated as any).isIndexed).toBe(true);
    });

    it('fills fileList from index load when tab has no files', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });
      const { result, bridge, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        currentFile: '/ws/readme.md',
        contentHtml: '<p>hi</p>',
        renderVersion: 2,
      });
      rerender(input);

      const wsTab = result.current.tabs.find((t: any) => t.id === tabId);
      const fileListBefore = wsTab?.fileList?.length ?? 0;

      act(() => {
        bridge._fireMessage({
          command: 'workspaceSearchIndexLoaded',
          tabs: [{
            tabId,
            workspacePath: '/ws',
            fileList: [
              { fsPath: '/ws/new.md', title: 'New', fileName: 'new.md', relativePath: 'new.md' },
            ],
            tree: { name: 'ws', children: [] },
          }],
        });
      });

      const updated = result.current.tabs.find((t: any) => t.id === tabId);
      expect((updated as any).isIndexed).toBe(true);

      if (fileListBefore === 0) {
        expect((updated as any).fileList.length).toBeGreaterThan(0);
      }
    });

    it('ignores non-workspaceSearchIndexLoaded messages', () => {
      const { result, bridge } = setupHook();

      const countBefore = result.current.tabs.length;

      act(() => {
        bridge._fireMessage({ command: 'someOtherCommand' });
      });

      expect(result.current.tabs.length).toBe(countBefore);
    });

    it('skips tabs with mismatched workspacePath', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws-correct' });
      const { result, bridge, rerender, input } = setupHook({ state });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws-correct',
        currentFile: '/ws-correct/readme.md',
        contentHtml: '<p>hi</p>',
        renderVersion: 2,
      });
      rerender(input);

      const wsTabBefore = result.current.tabs.find((t: any) => t.id === tabId);
      const wasIndexedBefore = wsTabBefore?.isIndexed ?? false;

      act(() => {
        bridge._fireMessage({
          command: 'workspaceSearchIndexLoaded',
          tabs: [
            {
              tabId,
              workspacePath: '/ws-wrong',
              fileList: [{ fsPath: '/ws/x.md', title: 'X', fileName: 'x.md', relativePath: 'x.md' }],
              tree: null,
            },
          ],
        });
      });

      const updated = result.current.tabs.find((t: any) => t.id === tabId);
      expect(updated?.isIndexed).toBe(wasIndexedBefore);
    });

    it('does not register handler when not tabView', () => {
      const { bridge } = setupHook({ isTabView: false });
      expect(bridge.onMessage).not.toHaveBeenCalled();
    });
  });

  describe('workspace alias persistence', () => {
    it('writes aliases when isDesktop', () => {
      const { result } = setupHook({ isDesktop: true });

      act(() => {
        result.current.updateWorkspaceAlias('/ws', 'MyWS', 'ws');
      });

      expect(writeWorkspaceAliases).toHaveBeenCalledWith(expect.objectContaining({ '/ws': 'MyWS' }));
    });
  });

  describe('tab persistence', () => {
    it('calls writePersistedDesktopTabs when isDesktop', () => {
      setupHook({ isDesktop: true });

      expect(writePersistedDesktopTabs).toHaveBeenCalled();
    });
  });

  describe('navigation scope', () => {
    it('sets scope to activeTabId in tab view on render', () => {
      const { setNavigationScope } = setupHook({ isTabView: true });
      expect(setNavigationScope).toHaveBeenCalledWith('home');
    });

    it('sets scope to focus in focus view on render', () => {
      const { setNavigationScope } = setupHook({ isTabView: false });
      expect(setNavigationScope).toHaveBeenCalledWith('focus');
    });
  });

  describe('workspace snapshot effect', () => {
    it('creates new tab when workspace loads while active on home', () => {
      const { result, rerender, input } = setupHook({ isTabView: true });

      expect(result.current.activeTabId).toBe('home');

      input.state = makeState({
        workspaceName: 'new-workspace',
        workspacePath: '/new-workspace',
        renderVersion: 2,
      });
      rerender(input);

      expect(result.current.tabs.length).toBeGreaterThan(1);
    });
  });

  describe('workspace search index request', () => {
    it('requests indexes for unindexed workspace tabs after timeout', () => {
      const state = makeState({ workspaceName: 'ws', workspacePath: '/ws' });

      vi.useRealTimers();
      vi.useFakeTimers();

      const { result, bridge, rerender, input } = setupHook({ state, isTabView: true });

      let tabId = '';
      act(() => { tabId = result.current.createNewWorkspaceTab(); });

      input.state = makeState({
        workspaceName: 'ws',
        workspacePath: '/ws',
        renderVersion: 2,
      });

      bridge.postMessage.mockClear();
      rerender(input);

      const wsTab = result.current.tabs.find((t: any) => t.id === tabId);
      if (wsTab && wsTab.kind === 'workspace' && !wsTab.isIndexed && wsTab.fileList.length === 0) {
        act(() => {
          vi.advanceTimersByTime(1100);
        });

        const loadCalls = bridge.postMessage.mock.calls.filter(
          (c: any[]) => c[0].command === 'loadWorkspaceSearchIndexes',
        );
        expect(loadCalls.length).toBeGreaterThan(0);
      }
    });

    it('does not request indexes when not tab view', () => {
      const { result, bridge } = setupHook({ isTabView: false });

      act(() => { result.current.createNewWorkspaceTab(); });

      bridge.postMessage.mockClear();

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      const loadCalls = bridge.postMessage.mock.calls.filter(
        (c: any[]) => c[0].command === 'loadWorkspaceSearchIndexes',
      );
      expect(loadCalls.length).toBe(0);
    });
  });

  describe('setPendingDroppedPath', () => {
    it('can set and clear pending dropped path', () => {
      const { result } = setupHook();

      act(() => { result.current.setPendingDroppedPath('/some/path.md'); });
      expect(result.current.pendingDroppedPath).toBe('/some/path.md');

      act(() => { result.current.setPendingDroppedPath(null); });
      expect(result.current.pendingDroppedPath).toBeNull();
    });
  });
});
