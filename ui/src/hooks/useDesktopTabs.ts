import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, AppState } from '../contexts/AppStateContext';
import {
  createEmptyTab,
  createTabId,
  getTabLabel,
  reorderDesktopTabs,
  readInitialDesktopState,
  readToolbarPosition,
  writePersistedDesktopTabs,
  writeWorkspaceAliases,
} from '../desktop/desktopTabs';
import { snapshotDesktopTab } from '../desktop/desktopTabSnapshot';
import { FLOATING_TOOLBAR_STORAGE_KEY } from '../desktop/constants';
import {
  beginWorkspaceOperation,
  clearWorkspaceOperation,
  getActiveWorkspaceOperation,
  resetCancelledWorkspaceTab,
  type WorkspaceOperationContext,
} from '../desktop/workspaceOperations';
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
  isDesktop: boolean;
  isTabView: boolean;
  setNavigationScope: (scopeId: string) => void;
}

export function useDesktopTabs({
  state,
  dispatch,
  bridge,
  isDesktop,
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
  const pendingWorkspaceReplacementRef = useRef<{ workspaceOperationId: string; oldPath: string } | null>(null);
  const tabsRef = useRef(tabs);

  const [pendingDroppedPath, setPendingDroppedPath] = useState<string | null>(null);

  useEffect(() => { workspaceNameRef.current = state.workspaceName; }, [state.workspaceName]);

  useEffect(() => {
    tabsRef.current = tabs;
  });

  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  useEffect(() => { localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(toolbarPosition)); }, [toolbarPosition]);

  useEffect(() => {
    if (isDesktop) writeWorkspaceAliases(workspaceAliases);
  }, [isDesktop, workspaceAliases]);

  useEffect(() => {
    if (isDesktop) writePersistedDesktopTabs(tabs, activeTabId);
  }, [activeTabId, isDesktop, tabs]);

  useEffect(() => {
    setNavigationScope(isTabView ? activeTabId : 'focus');
  }, [activeTabId, isTabView, setNavigationScope]);

  const snapshotCurrentState = useCallback(
    (tab: DesktopTab) => snapshotDesktopTab(state, tab, activeTabId, workspaceAliases),
    [activeTabId, state, workspaceAliases],
  );

  useEffect(() => {
    if (!isTabView || !state.workspaceName) return;
    const activeOperation = getActiveWorkspaceOperation();
    const requestedTabId = activeOperation?.workspaceTabId
      ?? pendingWorkspaceTabIdRef.current
      ?? activeTabIdRef.current;
    const targetTabId = requestedTabId === 'home' ? createTabId() : requestedTabId;
    pendingWorkspaceTabIdRef.current = null;
    setActiveTabId(targetTabId);
    setTabs((currentTabs) => {
      const exists = currentTabs.some((tab) => tab.id === targetTabId);
      const nextTabs = exists ? currentTabs : [...currentTabs, createEmptyTab(targetTabId, 'new')];
      return nextTabs.map((tab) => {
        if (tab.id !== targetTabId) return tab;
        return {
          ...snapshotCurrentState(tab),
          workspaceOperationId: activeOperation?.workspaceOperationId ?? tab.workspaceOperationId,
          workspaceLoadState: state.isLoading || state.isWorkspaceScanning ? 'loading' : 'ready',
        };
      });
    });
  }, [isTabView, snapshotCurrentState, state.isLoading, state.isWorkspaceScanning, state.renderVersion, state.workspaceName]);

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
    dispatch({
      type: 'WORKSPACE_SCAN_PROGRESS',
      scannedFiles: 0,
      active: false,
    });
  }, [dispatch, state.defaultExpanded, state.recentWorkspaces, state.theme, state.themeStyle]);

  const markCancelledOperationIdle = useCallback((operation: WorkspaceOperationContext | null) => {
    if (!operation) return;
    setTabs((currentTabs) => currentTabs.map((tab) =>
      tab.id === operation.workspaceTabId && tab.workspaceLoadState === 'loading'
        ? { ...tab, workspaceLoadState: 'idle', workspaceOperationId: undefined }
        : tab,
    ));
  }, []);

  const beginOperationForTab = useCallback((tabId: string): WorkspaceOperationContext => {
    const previous = getActiveWorkspaceOperation();
    if (previous && previous.workspaceTabId !== tabId) {
      bridge.postMessage({
        command: 'cancelWorkspaceScan',
        workspaceOperationId: previous.workspaceOperationId,
      });
      markCancelledOperationIdle(previous);
    }
    const operation = beginWorkspaceOperation(tabId);
    pendingWorkspaceTabIdRef.current = tabId;
    setTabs((currentTabs) => currentTabs.map((tab) =>
      tab.id === tabId
        ? { ...tab, workspaceOperationId: operation.workspaceOperationId }
        : tab,
    ));
    return operation;
  }, [bridge, markCancelledOperationIdle]);

  const activateTab = useCallback(
    (tabId: string, targetFilePath?: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return;
      setActiveTabId(tabId);
      setNavigationScope(isTabView ? tabId : 'focus');

      if (tab.kind !== 'workspace' || !tab.workspacePath) {
        const activeOperation = getActiveWorkspaceOperation();
        if (activeOperation) {
          bridge.postMessage({ command: 'cancelWorkspaceScan', workspaceOperationId: activeOperation.workspaceOperationId });
          markCancelledOperationIdle(activeOperation);
        }
        clearWorkspaceOperation();
        pendingWorkspaceTabIdRef.current = null;
        dispatchEmptyWorkspace();
        bridge.postMessage({ command: 'closeWorkspace' });
        return;
      }

      const operation = beginOperationForTab(tabId);
      const fileToOpen = targetFilePath !== undefined ? targetFilePath : tab.currentFile;

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
        activeContentTabPath: fileToOpen ?? tab.activeContentTabPath,
        recentWorkspaces: state.recentWorkspaces,
      });

      const useCachedContent = targetFilePath === undefined || targetFilePath === tab.currentFile;

      if (useCachedContent && (tab.contentHtml || (!isTabView && !tab.currentFile))) {
        dispatch({
          type: 'RENDER_CONTENT',
          msg: {
            command: 'renderContent',
            html: tab.contentHtml,
            markdownSource: tab.markdownSource,
            sourceDocumentText: tab.sourceDocumentText,
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
        filePath: fileToOpen ?? undefined,
        openFirstFile: isTabView && !fileToOpen,
        ...operation,
      });
    },
    [
      beginOperationForTab,
      bridge,
      dispatch,
      dispatchEmptyWorkspace,
      isTabView,
      markCancelledOperationIdle,
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
    const activeOperation = getActiveWorkspaceOperation();
    if (activeOperation) {
      bridge.postMessage({ command: 'cancelWorkspaceScan', workspaceOperationId: activeOperation.workspaceOperationId });
      markCancelledOperationIdle(activeOperation);
    }
    clearWorkspaceOperation();
    pendingWorkspaceTabIdRef.current = null;
    bridge.postMessage({ command: 'closeWorkspace' });
    const id = createTabId();
    setTabs((currentTabs) => [...currentTabs, createEmptyTab(id, 'new')]);
    setActiveTabId(id);
    setNavigationScope(isTabView ? id : 'focus');
    dispatchEmptyWorkspace();
    return id;
  }, [bridge, dispatchEmptyWorkspace, isTabView, markCancelledOperationIdle, setNavigationScope]);

  const prepareWorkspaceOpen = useCallback((): WorkspaceOperationContext | undefined => {
    if (!isTabView) return undefined;
    const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
    const targetTabId = !active || active.kind === 'home'
      ? createNewWorkspaceTab()
      : active.id;
    return beginOperationForTab(targetTabId);
  }, [beginOperationForTab, createNewWorkspaceTab, isTabView, tabs]);

  const reopenUnavailableWorkspace = useCallback((oldPath: string) => {
    if (!oldPath) return;
    const operation = isTabView
      ? beginOperationForTab(activeTabIdRef.current)
      : undefined;
    if (operation) {
      pendingWorkspaceReplacementRef.current = {
        workspaceOperationId: operation.workspaceOperationId,
        oldPath,
      };
    }
    bridge.postMessage({
      command: 'openFolder',
      openFirstFile: isTabView,
      replaceRecentWorkspacePath: oldPath,
      ...operation,
    });
  }, [beginOperationForTab, bridge, isTabView]);

  const openDroppedPath = useCallback((droppedPath: string) => {
    if (!droppedPath) return;
    if (isTabView) {
      const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
      const targetTabId = active?.kind === 'new' ? active.id : createNewWorkspaceTab();
      const operation = beginOperationForTab(targetTabId);
      bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true, ...operation });
      return;
    }

    if (workspaceNameRef.current) {
      setPendingDroppedPath(droppedPath);
      return;
    }

    bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true });
  }, [beginOperationForTab, bridge, createNewWorkspaceTab, isTabView, tabs]);

  const confirmSwitchWorkspace = useCallback(() => {
    if (pendingDroppedPath) {
      bridge.postMessage({ command: 'openPath', path: pendingDroppedPath, openFirstFile: true });
      setPendingDroppedPath(null);
    }
  }, [bridge, pendingDroppedPath]);

  const cancelOperationForTabs = useCallback((tabIds: Iterable<string>) => {
    const operation = getActiveWorkspaceOperation();
    if (!operation || !new Set(tabIds).has(operation.workspaceTabId)) return;
    bridge.postMessage({
      command: 'cancelWorkspaceScan',
      workspaceOperationId: operation.workspaceOperationId,
    });
    clearWorkspaceOperation(operation.workspaceOperationId);
    pendingWorkspaceTabIdRef.current = null;
  }, [bridge]);

  const closeTab = useCallback(
    (tabId: string) => {
      cancelOperationForTabs([tabId]);
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
    [activateTab, cancelOperationForTabs],
  );

  const reorderTabs = useCallback((sourceTabId: string, targetTabId: string) => {
    if (!sourceTabId || !targetTabId || sourceTabId === targetTabId) return;
    setTabs((currentTabs) => reorderDesktopTabs(currentTabs, sourceTabId, targetTabId));
  }, []);

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      const currentWorkspaceTabs = tabsRef.current.filter((tab) => tab.kind !== 'home');
      const targetIndex = currentWorkspaceTabs.findIndex((tab) => tab.id === tabId);
      if (targetIndex >= 0) {
        cancelOperationForTabs(currentWorkspaceTabs.slice(targetIndex + 1).map((tab) => tab.id));
      }
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
    [activateTab, cancelOperationForTabs],
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      cancelOperationForTabs(tabsRef.current.filter((tab) => tab.kind !== 'home' && tab.id !== tabId).map((tab) => tab.id));
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
    [activateTab, cancelOperationForTabs],
  );

  const closeAllTabs = useCallback(() => {
    clearWorkspaceOperation();
    pendingWorkspaceTabIdRef.current = null;
    bridge.postMessage({ command: 'cancelAllWorkspaceScans' });
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

  const updateWorkspaceAlias = useCallback((workspacePath: string, alias: string, fallbackName = '') => {
    const normalizedAlias = alias.trim();
    const persistedAlias = normalizedAlias && normalizedAlias !== fallbackName.trim()
      ? normalizedAlias
      : '';

    setWorkspaceAliases((currentAliases) => {
      const nextAliases = { ...currentAliases };
      if (persistedAlias) nextAliases[workspacePath] = persistedAlias;
      else delete nextAliases[workspacePath];
      return nextAliases;
    });

    setTabs((currentTabs) =>
      currentTabs.map((item) =>
        item.workspacePath === workspacePath
          ? { ...item, alias: persistedAlias || undefined }
          : item,
      ),
    );
  }, []);

  const updateTabAlias = useCallback((tabId: string, alias: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (tab.workspacePath) {
      updateWorkspaceAlias(tab.workspacePath, alias, tab.workspaceName ?? '');
      return;
    }
    setTabs((currentTabs) =>
      currentTabs.map((item) => (item.id === tabId ? { ...item, alias: alias.trim() || undefined } : item)),
    );
  }, [tabs, updateWorkspaceAlias]);

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
    return bridge.onMessage((msg) => {
      const pendingReplacement = pendingWorkspaceReplacementRef.current;
      if (msg.command === 'workspaceOpenCancelled') {
        const activeOperation = getActiveWorkspaceOperation();
        const matchesActiveOperation = Boolean(
          activeOperation
          && msg.workspaceOperationId === activeOperation.workspaceOperationId
          && msg.workspaceTabId === activeOperation.workspaceTabId,
        );
        const matchesReplacement = Boolean(
          pendingReplacement
          && msg.workspaceOperationId === pendingReplacement.workspaceOperationId,
        );
        if (!matchesActiveOperation && !matchesReplacement) return;

        const cancelledTabId = msg.workspaceTabId ?? activeOperation?.workspaceTabId;
        if (matchesReplacement) pendingWorkspaceReplacementRef.current = null;
        clearWorkspaceOperation(msg.workspaceOperationId);
        pendingWorkspaceTabIdRef.current = null;
        if (cancelledTabId) {
          setTabs((currentTabs) => currentTabs.map((tab) => {
            if (tab.id !== cancelledTabId) return tab;
            return {
              ...tab,
              workspaceOperationId: undefined,
              workspaceLoadState: tab.workspacePath ? 'ready' : 'idle',
            };
          }));
        }
        return;
      }
      if (msg.command === 'readyAck' && pendingReplacement
        && msg.workspaceOperationId === pendingReplacement.workspaceOperationId) {
        pendingWorkspaceReplacementRef.current = null;
      }
      if (msg.workspaceOperationId && msg.workspaceTabId) {
        const activeOperation = getActiveWorkspaceOperation();
        if (activeOperation
          && activeOperation.workspaceOperationId === msg.workspaceOperationId
          && activeOperation.workspaceTabId === msg.workspaceTabId) {
          if (msg.command === 'setLoading' || (msg.command === 'workspaceScanProgress' && msg.active)) {
            setTabs((currentTabs) => currentTabs.map((tab) =>
              tab.id === msg.workspaceTabId ? { ...tab, workspaceLoadState: 'loading' } : tab,
            ));
          } else if (msg.command === 'workspaceScanProgress' && !msg.active) {
            setTabs((currentTabs) => currentTabs.map((tab) =>
              tab.id === msg.workspaceTabId ? { ...tab, workspaceLoadState: 'ready' } : tab,
            ));
          }
        }
      }
      if (msg.command === 'externalOpenPath') {
        if (isTabView) {
          const targetTabId = createNewWorkspaceTab();
          const operation = beginOperationForTab(targetTabId);
          bridge.postMessage({ command: 'openPath', path: msg.path, openFirstFile: false, ...operation });
          return;
        }
        bridge.postMessage({ command: 'openPath', path: msg.path, openFirstFile: false });
        return;
      }
      if (!isTabView || msg.command !== 'workspaceSearchIndexLoaded') return;
      const loadedTabs = new Map(msg.tabs.map((tab: any) => [tab.tabId, tab]));
      setTabs((currentTabs) =>
        currentTabs.map((tab) => {
          const loaded = loadedTabs.get(tab.id) as any;
          if (!loaded || tab.workspacePath !== loaded.workspacePath) return tab;
          return {
            ...tab,
            fileList: tab.fileList.length > 0 ? tab.fileList : loaded.fileList,
            tree: tab.tree ? tab.tree : loaded.tree,
            isIndexed: true,
          };
        }),
      );
    });
  }, [beginOperationForTab, bridge, createNewWorkspaceTab, isTabView]);

  useEffect(() => {
    if (!isTabView || state.isLoading) return;
    const handle = window.setTimeout(() => {
      const pendingTabs = tabsRef.current.flatMap((tab) => {
        if (tab.kind !== 'workspace' || !tab.workspacePath || tab.isIndexed || tab.fileList.length > 0) return [];
        const requestKey = `${tab.id}:${tab.workspacePath}`;
        if (requestedWorkspaceIndexesRef.current.has(requestKey)) return [];
        requestedWorkspaceIndexesRef.current.add(requestKey);
        return [{ tabId: tab.id, workspacePath: tab.workspacePath }];
      });
      if (pendingTabs.length > 0) {
        bridge.postMessage({ command: 'loadWorkspaceSearchIndexes', tabs: pendingTabs });
      }
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [bridge, isTabView, state.isLoading]);

  const cancelCurrentWorkspaceScan = useCallback(() => {
    const operation = getActiveWorkspaceOperation();
    if (!operation) return;
    bridge.postMessage({
      command: 'cancelWorkspaceScan',
      workspaceOperationId: operation.workspaceOperationId,
    });
    clearWorkspaceOperation(operation.workspaceOperationId);
    pendingWorkspaceTabIdRef.current = null;

    setTabs((currentTabs) => resetCancelledWorkspaceTab(
      currentTabs,
      operation.workspaceTabId,
      (tabId) => ({
        ...createEmptyTab(tabId, 'new'),
        workspaceLoadState: 'idle',
        workspaceOperationId: undefined,
      }),
    ));
    setActiveTabId(operation.workspaceTabId);
    setNavigationScope(isTabView ? operation.workspaceTabId : 'focus');
    dispatchEmptyWorkspace();
    bridge.postMessage({ command: 'closeWorkspace' });
  }, [bridge, dispatchEmptyWorkspace, isTabView, setNavigationScope]);

  const isIndexingAcrossTabs = useMemo(() => {
    if (!isTabView) return false;
    return tabs.some((tab) => tab.kind === 'workspace' && tab.workspacePath && !tab.isIndexed && tab.fileList.length === 0);
  }, [isTabView, tabs]);

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
    reopenUnavailableWorkspace,
    openDroppedPath,
    pendingDroppedPath,
    setPendingDroppedPath,
    confirmSwitchWorkspace,
    closeTab,
    reorderTabs,
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    cancelCurrentWorkspaceScan,
    updateTabAlias,
    updateWorkspaceAlias,
    crossTabSearchItems,
    isIndexingAcrossTabs,
  };
}
