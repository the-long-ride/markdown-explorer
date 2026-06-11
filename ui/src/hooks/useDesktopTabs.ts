// =============================================================================
// hooks/useDesktopTabs.ts — Desktop Tab & Workspace management
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, AppState } from '../contexts/AppStateContext';
import {
  createEmptyTab,
  createTabId,
  getTabLabel,
  readInitialDesktopState,
  readToolbarPosition,
  writePersistedDesktopTabs,
  writeWorkspaceAliases,
} from '../desktop/desktopTabs';
import { FLOATING_TOOLBAR_STORAGE_KEY } from '../desktop/constants';
import type {
  CrossTabSearchItem,
  DesktopTab,
  FloatingToolbarPosition,
  InitialDesktopState,
  WorkspaceAliasMap,
} from '../desktop/types';

interface UseDesktopTabsParams {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  bridge: {
    postMessage: (message: any) => void;
    onMessage: (handler: (message: any) => void) => () => void;
  };
  isElectron: boolean;
  isTabView: boolean;
  setNavigationScope: (scopeId: string) => void;
}

export function useDesktopTabs({
  state,
  dispatch,
  bridge,
  isElectron,
  isTabView,
  setNavigationScope,
}: UseDesktopTabsParams) {
  const workspaceNameRef = useRef(state.workspaceName);
  const initialDesktopStateRef = useRef<InitialDesktopState | null>(null);
  if (!initialDesktopStateRef.current) {
    initialDesktopStateRef.current = readInitialDesktopState();
  }

  const [workspaceAliases, setWorkspaceAliases] = useState<WorkspaceAliasMap>(
    () => initialDesktopStateRef.current?.workspaceAliases ?? {},
  );
  const [tabs, setTabs] = useState<DesktopTab[]>(
    () => initialDesktopStateRef.current?.tabs ?? [createEmptyTab('home', 'home')],
  );
  const [activeTabId, setActiveTabId] = useState(
    () => initialDesktopStateRef.current?.activeTabId ?? 'home',
  );
  const [toolbarPosition, setToolbarPosition] = useState<FloatingToolbarPosition>(() => readToolbarPosition());
  const activeTabIdRef = useRef(activeTabId);
  const pendingWorkspaceTabIdRef = useRef<string | null>(null);
  const restoredDesktopTabsRef = useRef(false);
  const requestedWorkspaceIndexesRef = useRef<Set<string>>(new Set());

  // Custom switch workspace state
  const [pendingDroppedPath, setPendingDroppedPath] = useState<string | null>(null);

  useEffect(() => {
    workspaceNameRef.current = state.workspaceName;
  }, [state.workspaceName]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(toolbarPosition));
  }, [toolbarPosition]);

  useEffect(() => {
    if (isElectron) writeWorkspaceAliases(workspaceAliases);
  }, [isElectron, workspaceAliases]);

  useEffect(() => {
    if (isElectron) writePersistedDesktopTabs(tabs, activeTabId);
  }, [activeTabId, isElectron, tabs]);

  useEffect(() => {
    setNavigationScope(isTabView ? activeTabId : 'focus');
  }, [activeTabId, isTabView, setNavigationScope]);

  const snapshotCurrentState = useCallback(
    (tab: DesktopTab): DesktopTab => {
      const nextWorkspacePath = state.workspacePath || tab.workspacePath;
      const sameWorkspace =
        !tab.workspacePath ||
        !nextWorkspacePath ||
        tab.workspacePath === nextWorkspacePath;
      const savedAlias = nextWorkspacePath ? workspaceAliases[nextWorkspacePath] : undefined;

      return {
        ...tab,
        kind: state.workspaceName ? 'workspace' : tab.kind,
        alias: savedAlias ?? (sameWorkspace ? tab.alias : undefined),
        workspaceName: state.workspaceName || tab.workspaceName,
        workspacePath: nextWorkspacePath,
        fileList: state.fileList,
        tree: state.tree,
        currentFile: state.currentFile,
        contentHtml: state.contentHtml,
        markdownSource: state.markdownSource,
        frontmatter: state.frontmatter,
        toc: state.toc,
        previewInfo: state.previewInfo,
        relativePath: state.relativePath,
        isLoading: state.isLoading,
        notFoundHref: state.notFoundHref,
        workspaceUnavailablePath: state.workspaceUnavailablePath,
        workspaceUnavailableReason: state.workspaceUnavailableReason,
        contentTabs: state.contentTabs,
        activeContentTabPath: state.activeContentTabPath,
      };
    },
    [
      state.activeContentTabPath,
      state.contentHtml,
      state.contentTabs,
      state.currentFile,
      state.fileList,
      state.frontmatter,
      state.isLoading,
      state.markdownSource,
      state.notFoundHref,
      state.previewInfo,
      state.relativePath,
      state.toc,
      state.tree,
      state.workspaceUnavailablePath,
      state.workspaceUnavailableReason,
      state.workspaceName,
      state.workspacePath,
      workspaceAliases,
    ],
  );

  useEffect(() => {
    if (!isTabView || !state.workspaceName) return;
    const requestedTabId = pendingWorkspaceTabIdRef.current ?? activeTabIdRef.current;
    const targetTabId = requestedTabId === 'home' ? createTabId() : requestedTabId;
    pendingWorkspaceTabIdRef.current = null;
    setActiveTabId(targetTabId);
    setTabs((currentTabs) => {
      const exists = currentTabs.some((tab) => tab.id === targetTabId);
      const nextTabs = exists ? currentTabs : [...currentTabs, createEmptyTab(targetTabId, 'new')];
      return nextTabs.map((tab) => (tab.id === targetTabId ? snapshotCurrentState(tab) : tab));
    });
  }, [isTabView, snapshotCurrentState, state.renderVersion, state.workspaceName]);

  const dispatchEmptyWorkspace = useCallback(() => {
    dispatch({
      type: 'READY_ACK',
      fileList: [],
      tree: null,
      theme: state.theme,
      themeStyle: state.themeStyle,
      defaultExpanded: state.defaultExpanded,
      workspaceName: '',
      workspacePath: undefined,
      recentWorkspaces: state.recentWorkspaces,
    });
  }, [dispatch, state.defaultExpanded, state.recentWorkspaces, state.theme, state.themeStyle]);

  const activateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return;
      setActiveTabId(tabId);
      setNavigationScope(isTabView ? tabId : 'focus');

      if (tab.kind !== 'workspace' || !tab.workspacePath) {
        dispatchEmptyWorkspace();
        bridge.postMessage({ command: 'closeWorkspace' });
        return;
      }

      dispatch({
        type: 'READY_ACK',
        fileList: tab.fileList,
        tree: tab.tree,
        theme: state.theme,
        themeStyle: state.themeStyle,
        defaultExpanded: state.defaultExpanded,
        workspaceName: tab.workspaceName ?? '',
        workspacePath: tab.workspacePath,
        contentTabs: tab.contentTabs,
        activeContentTabPath: tab.activeContentTabPath,
        recentWorkspaces: state.recentWorkspaces,
      });
      if (tab.contentHtml || (!isTabView && !tab.currentFile)) {
        dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            html: tab.contentHtml,
            markdownSource: tab.markdownSource,
            frontmatter: tab.frontmatter,
            toc: tab.toc,
            previewInfo: tab.previewInfo,
            filePath: tab.currentFile ?? '',
            relativePath: tab.relativePath || 'Welcome Page',
            title: tab.currentFile ? tab.relativePath || 'Document' : 'Welcome',
            fileList: tab.fileList,
          },
        });
      } else {
        dispatch({ type: 'SET_LOADING' });
      }
      bridge.postMessage({
        command: 'activateWorkspace',
        workspacePath: tab.workspacePath,
        filePath: tab.currentFile ?? undefined,
        openFirstFile: isTabView,
      });
    },
    [
      bridge,
      dispatch,
      dispatchEmptyWorkspace,
      isTabView,
      setNavigationScope,
      state.defaultExpanded,
      state.recentWorkspaces,
      state.theme,
      state.themeStyle,
      tabs,
    ],
  );

  useEffect(() => {
    if (!isTabView || restoredDesktopTabsRef.current || state.isLoading) return;
    restoredDesktopTabsRef.current = true;
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab?.kind === 'workspace' && activeTab.workspacePath) {
      activateTab(activeTab.id);
    } else if (!activeTab) {
      setActiveTabId('home');
    }
  }, [activateTab, activeTabId, isTabView, state.isLoading, tabs]);

  const createNewWorkspaceTab = useCallback(() => {
    const id = createTabId();
    setTabs((currentTabs) => [...currentTabs, createEmptyTab(id, 'new')]);
    setActiveTabId(id);
    setNavigationScope(isTabView ? id : 'focus');
    dispatchEmptyWorkspace();
    return id;
  }, [dispatchEmptyWorkspace, isTabView, setNavigationScope]);

  const prepareWorkspaceOpen = useCallback(() => {
    if (!isTabView) return;
    const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
    pendingWorkspaceTabIdRef.current = !active || active.kind === 'home'
      ? createNewWorkspaceTab()
      : active.id;
  }, [createNewWorkspaceTab, isTabView, tabs]);

  const openDroppedPath = useCallback((droppedPath: string) => {
    if (!droppedPath) return;
    if (isTabView) {
      const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
      pendingWorkspaceTabIdRef.current =
        active?.kind === 'new' ? active.id : createNewWorkspaceTab();
      bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true });
      return;
    }

    if (workspaceNameRef.current) {
      setPendingDroppedPath(droppedPath);
      return;
    }

    bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true });
  }, [bridge, createNewWorkspaceTab, isTabView, tabs]);

  const confirmSwitchWorkspace = useCallback(() => {
    if (pendingDroppedPath) {
      bridge.postMessage({ command: 'openPath', path: pendingDroppedPath, openFirstFile: true });
      setPendingDroppedPath(null);
    }
  }, [bridge, pendingDroppedPath]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) => {
        const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex === -1) return currentTabs;
        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
        if (activeTabIdRef.current === tabId) {
          const fallback = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? nextTabs[0];
          setTimeout(() => activateTab(fallback?.id ?? 'home'), 0);
        }
        return nextTabs.length ? nextTabs : [createEmptyTab('home', 'home')];
      });
    },
    [activateTab],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) => {
        const workspaceTabs = currentTabs.filter((tab) => tab.kind !== 'home');
        const workspaceIndex = workspaceTabs.findIndex((tab) => tab.id === tabId);
        if (workspaceIndex === -1 || workspaceIndex >= workspaceTabs.length - 1) {
          return currentTabs;
        }

        const retainedWorkspaceIds = new Set(
          workspaceTabs.slice(0, workspaceIndex + 1).map((tab) => tab.id),
        );
        const nextTabs = currentTabs.filter(
          (tab) => tab.kind === 'home' || retainedWorkspaceIds.has(tab.id),
        );
        if (!nextTabs.some((tab) => tab.id === activeTabIdRef.current)) {
          window.setTimeout(() => activateTab(tabId), 0);
        }
        return nextTabs.length ? nextTabs : [createEmptyTab('home', 'home')];
      });
    },
    [activateTab],
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) => {
        const targetTab = currentTabs.find((tab) => tab.id === tabId);
        if (!targetTab || targetTab.kind === 'home') return currentTabs;
        const nextTabs = currentTabs.filter((tab) => tab.kind === 'home' || tab.id === tabId);
        if (activeTabIdRef.current !== tabId) {
          window.setTimeout(() => activateTab(tabId), 0);
        }
        return nextTabs.length ? nextTabs : [createEmptyTab('home', 'home')];
      });
    },
    [activateTab],
  );

  const closeAllTabs = useCallback(() => {
    setTabs((currentTabs) => {
      const homeTab = currentTabs.find((tab) => tab.kind === 'home') ?? createEmptyTab('home', 'home');
      window.setTimeout(() => {
        setActiveTabId(homeTab.id);
        setNavigationScope(isTabView ? homeTab.id : 'focus');
        dispatchEmptyWorkspace();
        bridge.postMessage({ command: 'closeWorkspace' });
      }, 0);
      return [homeTab];
    });
  }, [bridge, dispatchEmptyWorkspace, isTabView, setNavigationScope]);

  const updateTabAlias = useCallback((tabId: string, alias: string) => {
    const normalizedAlias = alias.trim();
    const tab = tabs.find((item) => item.id === tabId);
    setTabs((currentTabs) =>
      currentTabs.map((item) => (item.id === tabId ? { ...item, alias: normalizedAlias } : item)),
    );
    const workspacePath = tab?.workspacePath;
    if (workspacePath) {
      setWorkspaceAliases((currentAliases) => {
        const nextAliases = { ...currentAliases };
        if (normalizedAlias) nextAliases[workspacePath] = normalizedAlias;
        else delete nextAliases[workspacePath];
        return nextAliases;
      });
    }
  }, [tabs]);

  const crossTabSearchItems = useMemo<CrossTabSearchItem[]>(
    () =>
      tabs.flatMap((tab) =>
        tab.kind === 'workspace'
          ? tab.fileList.map((file) => ({
              tabId: tab.id,
              tabLabel: getTabLabel(tab),
              fsPath: file.fsPath,
              title: file.title,
              fileName: file.fileName,
              relativePath: file.relativePath,
            }))
          : [],
      ),
    [tabs],
  );

  useEffect(() => {
    if (!isTabView) return;
    return bridge.onMessage((msg) => {
      if (msg.command !== 'workspaceSearchIndexLoaded') return;
      const loadedTabs = new Map(msg.tabs.map((tab: any) => [tab.tabId, tab]));
      setTabs((currentTabs) =>
        currentTabs.map((tab) => {
          const loaded = loadedTabs.get(tab.id) as any;
          if (!loaded || tab.workspacePath !== loaded.workspacePath) return tab;
          if (tab.fileList.length > 0 && tab.tree) return tab;
          return { ...tab, fileList: loaded.fileList, tree: loaded.tree };
        }),
      );
    });
  }, [bridge, isTabView]);

  useEffect(() => {
    if (!isTabView) return;
    const pendingTabs = tabs.flatMap((tab) => {
      if (tab.kind !== 'workspace' || !tab.workspacePath || tab.fileList.length > 0) return [];
      const requestKey = `${tab.id}:${tab.workspacePath}`;
      if (requestedWorkspaceIndexesRef.current.has(requestKey)) return [];
      requestedWorkspaceIndexesRef.current.add(requestKey);
      return [{ tabId: tab.id, workspacePath: tab.workspacePath }];
    });

    if (pendingTabs.length === 0) return;
    const handle = window.setTimeout(() => {
      bridge.postMessage({ command: 'loadWorkspaceSearchIndexes', tabs: pendingTabs });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [bridge, isTabView, tabs]);

  useEffect(() => {
    if (!isTabView || crossTabSearchItems.length === 0) return;
    const handle = window.setTimeout(() => {
      bridge.postMessage({ command: 'indexWorkspaceSearchItems', items: crossTabSearchItems });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [bridge, crossTabSearchItems, isTabView]);

  return {
    activeTabId,
    tabs,
    setActiveTabId,
    workspaceAliases,
    toolbarPosition,
    setToolbarPosition,
    activateTab,
    createNewWorkspaceTab,
    prepareWorkspaceOpen,
    openDroppedPath,
    pendingDroppedPath,
    setPendingDroppedPath,
    confirmSwitchWorkspace,
    closeTab,
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    updateTabAlias,
    crossTabSearchItems,
  };
}
