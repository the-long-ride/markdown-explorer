import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, AppState } from '../contexts/AppStateContext';
import {
  createEmptyTab,
  createTabId,
  readInitialDesktopState,
  writePersistedDesktopTabs,
  writeWorkspaceAliases,
} from '../desktop/desktopTabs';
import { snapshotDesktopTab } from '../desktop/desktopTabSnapshot';
import {
  beginWorkspaceOperation,
  clearWorkspaceOperation,
  getActiveWorkspaceOperation,
  resetCancelledWorkspaceTab,
  type WorkspaceOperationContext,
} from '../desktop/workspaceOperations';
import type {
  DesktopTab,
  InitialDesktopState,
  WorkspaceAliasMap,
} from '../desktop/types';
import { useDesktopTabManagement } from './useDesktopTabManagement';
import { useDesktopTabSearchSync } from './useDesktopTabSearchSync';

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

  const { closeTab, reorderTabs, closeTabsToRight, closeOtherTabs, closeAllTabs,
    updateTabAlias, updateWorkspaceAlias } = useDesktopTabManagement({
    tabs, tabsRef, activeTabIdRef, pendingWorkspaceTabIdRef, setTabs, setActiveTabId,
    setWorkspaceAliases, activateTab, bridge, dispatchEmptyWorkspace, isTabView, setNavigationScope,
  });

  const { crossTabSearchItems, isIndexingAcrossTabs } = useDesktopTabSearchSync({
    tabs, tabsRef, setTabs, pendingWorkspaceTabIdRef, pendingWorkspaceReplacementRef,
    requestedWorkspaceIndexesRef, bridge, isTabView, isLoading: state.isLoading,
    createNewWorkspaceTab, beginOperationForTab,
  });

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



  return {
    activeTabId,
    tabs,
    setActiveTabId,
    workspaceAliases,
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
