import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, AppState } from '../contexts/AppStateContext';
import { getWorkspaceScopeKey } from '../contexts/contentTabState';
import type { DirtyDocumentsGuard } from './useDirtyDocumentsGuard';
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
import { TOUR_DEMO_WORKSPACE_PATH } from '../components/Tour/tourDemoWorkspace';
import { requestDismissWorkspaceTour } from '../components/Tour/tourEvents';
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
  guardWorkspaceLeave?: DirtyDocumentsGuard;
}

const commitImmediately: DirtyDocumentsGuard = (commit) => commit();
const normalizeWorkspaceMatchKey = (path?: string | null): string =>
  (path ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

export function useDesktopTabs({
  state,
  dispatch,
  bridge,
  isDesktop,
  isTabView,
  setNavigationScope,
  guardWorkspaceLeave = commitImmediately,
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
  const prevIsTabViewRef = useRef(isTabView);
  const requestedWorkspaceIndexesRef = useRef<Set<string>>(new Set());
  const pendingWorkspaceReplacementRef = useRef<{ workspaceOperationId: string; oldPath: string } | null>(null);
  const tabsRef = useRef(tabs);
  const skipNextSnapshotEffectRef = useRef(false);

  const [pendingDroppedPath, setPendingDroppedPath] = useState<string | null>(null);

  useEffect(() => { workspaceNameRef.current = state.workspaceName; }, [state.workspaceName]);

  useEffect(() => { tabsRef.current = tabs; });
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { if (isDesktop) writeWorkspaceAliases(workspaceAliases); }, [isDesktop, workspaceAliases]);
  useEffect(() => { if (isDesktop) writePersistedDesktopTabs(tabs, activeTabId); }, [activeTabId, isDesktop, tabs]);

  useEffect(() => {
    if (!isTabView || state.fileList.length === 0) return;
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab?.restoredContentTabPaths?.length) return;
    dispatch({ type: 'RESTORE_CONTENT_TABS', filePaths: activeTab.restoredContentTabPaths });
    setTabs((currentTabs) => currentTabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, restoredContentTabPaths: undefined } : tab,
    ));
  }, [activeTabId, dispatch, isTabView, state.fileList, tabs]);

  useEffect(() => {
    setNavigationScope(isTabView ? activeTabId : 'focus');
  }, [activeTabId, isTabView, setNavigationScope]);

  const snapshotCurrentState = useCallback(
    (tab: DesktopTab) => snapshotDesktopTab(state, tab, activeTabId, workspaceAliases),
    [activeTabId, state, workspaceAliases],
  );

  const dispatchEmptyWorkspace = useCallback(() => {
    dispatch({ type: 'READY_ACK', fileList: [], tree: null, theme: state.theme, themeStyle: state.themeStyle, defaultExpanded: state.defaultExpanded, workspaceName: '', workspacePath: undefined, recentWorkspaces: state.recentWorkspaces });
    dispatch({ type: 'WORKSPACE_SCAN_PROGRESS', scannedFiles: 0, active: false });
  }, [dispatch, state.defaultExpanded, state.recentWorkspaces, state.theme, state.themeStyle]);

  const clearPendingOperationState = useCallback((operationId?: string) => {
    clearWorkspaceOperation(operationId);
    pendingWorkspaceTabIdRef.current = null;
    pendingWorkspaceReplacementRef.current = null;
  }, []);

  const markCancelledOperationIdle = useCallback((operation: WorkspaceOperationContext | null) => {
    if (!operation) return;
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === operation.workspaceTabId && tab.workspaceLoadState === 'loading' ? { ...tab, workspaceLoadState: 'idle', workspaceOperationId: undefined } : tab));
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
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === tabId ? { ...tab, workspaceOperationId: operation.workspaceOperationId } : tab));
    return operation;
  }, [bridge, markCancelledOperationIdle]);

  // Unguarded workspace/tab switch. Callers either already ran the unsaved-changes
  // guard (close* flows) or are restoring on startup, when nothing can be dirty.
  const switchToTab = useCallback(
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
        clearPendingOperationState();
        skipNextSnapshotEffectRef.current = true;
        dispatchEmptyWorkspace();
        bridge.postMessage({ command: 'closeWorkspace' });
        return;
      }

      const operation = beginOperationForTab(tabId);
      const sameLoadedWorkspace = Boolean(
        tab.workspacePath
        && state.workspacePath === tab.workspacePath
        && state.fileList.length > 0
        && tab.fileList.length === 0,
      );
      const effectiveFileList = sameLoadedWorkspace ? state.fileList : tab.fileList;
      const effectiveTree = sameLoadedWorkspace ? state.tree : tab.tree;
      const fileToOpen = targetFilePath !== undefined
        ? targetFilePath
        : (tab.currentFile ?? (sameLoadedWorkspace ? state.currentFile : null));

      dispatch({
        type: 'READY_ACK',
        fileList: effectiveFileList,
        tree: effectiveTree,
        theme: state.theme,
        themeStyle: state.themeStyle,
        defaultExpanded: state.defaultExpanded,
        workspaceName: tab.workspaceName ?? '',
        workspacePath: tab.workspacePath,
        contentTabs: tab.contentTabs.length > 0 || !sameLoadedWorkspace ? tab.contentTabs : state.contentTabs,
        activeContentTabPath: fileToOpen ?? tab.activeContentTabPath,
        recentWorkspaces: state.recentWorkspaces,
      });

      const useCachedContent = targetFilePath === undefined || targetFilePath === tab.currentFile;
      const keepLoadedContent = Boolean(
        sameLoadedWorkspace
        && state.contentHtml
        && !state.isLoading
        && (!fileToOpen || state.currentFile === fileToOpen),
      );

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
            fileList: effectiveFileList,
          },
        });
      } else if (!keepLoadedContent) {
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
      beginOperationForTab, bridge, dispatch, dispatchEmptyWorkspace, isTabView,
      markCancelledOperationIdle, setNavigationScope, state.contentHtml, state.contentTabs,
      state.currentFile, state.defaultExpanded, state.fileList, state.isLoading,
      state.recentWorkspaces, state.theme, state.themeStyle, state.tree, state.workspacePath, tabs,
    ],
  );

  const currentWorkspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const activateTab = useCallback((tabId: string, targetFilePath?: string) => {
    const target = tabs.find((item) => item.id === tabId);
    if (!target) return;
    // Re-activating the workspace that is already loaded (e.g. jumping to a file
    // in it) keeps every open document, so it needs no prompt.
    const staysInWorkspace = target.kind === 'workspace'
      && Boolean(target.workspacePath)
      && getWorkspaceScopeKey(target.workspacePath, target.workspaceName ?? '') === currentWorkspaceKey;
    if (staysInWorkspace) {
      switchToTab(tabId, targetFilePath);
      return;
    }
    guardWorkspaceLeave(() => switchToTab(tabId, targetFilePath));
  }, [currentWorkspaceKey, guardWorkspaceLeave, switchToTab, tabs]);

  useEffect(() => {
    if (!isTabView) {
      restoredDesktopTabsRef.current = false;
      prevIsTabViewRef.current = false;
      clearPendingOperationState();
      return;
    }
    const justEnteredTabView = !prevIsTabViewRef.current;
    prevIsTabViewRef.current = true;
    if (justEnteredTabView) {
      const homeTab = createEmptyTab('home', 'home');
      const wsTabId = state.workspacePath || state.workspaceName ? createTabId() : undefined;
      const wsTab = wsTabId ? snapshotDesktopTab(state, createEmptyTab(wsTabId, 'workspace'), wsTabId, workspaceAliases) : undefined;
      const nextTabs = wsTab ? [homeTab, wsTab] : [homeTab];
      tabsRef.current = nextTabs;
      activeTabIdRef.current = wsTabId ?? 'home';
      setTabs(nextTabs);
      setActiveTabId(wsTabId ?? 'home');
      restoredDesktopTabsRef.current = true;
      skipNextSnapshotEffectRef.current = true;
      return;
    }

    if (restoredDesktopTabsRef.current || (!state.appVersion && state.isLoading)) return;
    restoredDesktopTabsRef.current = true;
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      setActiveTabId('home');
      return;
    }
    const isTargetWorkspace = (activeTab.kind === 'workspace' && Boolean(activeTab.workspacePath))
      || (Boolean(state.workspaceName) && tabs.length > 1);
    if (isTargetWorkspace) {
      const isAlreadyLoaded = Boolean(state.workspacePath)
        && !state.isLoading
        && normalizeWorkspaceMatchKey(activeTab.workspacePath) === normalizeWorkspaceMatchKey(state.workspacePath)
        && ((state.fileList?.length ?? 0) > 0 || Boolean(state.currentFile) || Boolean(state.contentHtml));
      if (isAlreadyLoaded) return;
      skipNextSnapshotEffectRef.current = true;
      switchToTab(activeTab.id);
    }
  }, [activeTabId, isTabView, snapshotCurrentState, state, state.appVersion, state.contentHtml, state.currentFile, state.fileList, state.isLoading, state.workspaceName, state.workspacePath, switchToTab, tabs, workspaceAliases]);

  useEffect(() => {
    if (skipNextSnapshotEffectRef.current) { skipNextSnapshotEffectRef.current = false; return; }
    if (!isTabView || !restoredDesktopTabsRef.current || !state.workspaceName || state.workspacePath === TOUR_DEMO_WORKSPACE_PATH) return;
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

  const createNewWorkspaceTabUnguarded = useCallback(() => {
    const activeOperation = getActiveWorkspaceOperation();
    if (activeOperation) {
      bridge.postMessage({ command: 'cancelWorkspaceScan', workspaceOperationId: activeOperation.workspaceOperationId });
      markCancelledOperationIdle(activeOperation);
    }
    clearPendingOperationState();
    requestDismissWorkspaceTour();
    skipNextSnapshotEffectRef.current = true;
    const id = createTabId();
    setTabs((currentTabs) => [...currentTabs, createEmptyTab(id, 'new')]);
    setActiveTabId(id);
    setNavigationScope(isTabView ? id : 'focus');
    dispatchEmptyWorkspace();
    bridge.postMessage({ command: 'closeWorkspace' });
    return id;
  }, [bridge, clearPendingOperationState, dispatchEmptyWorkspace, isTabView, markCancelledOperationIdle, setNavigationScope]);

  // Opening a new workspace tab replaces the loaded workspace; the returned id
  // is only available when the unsaved-changes prompt did not have to be shown.
  const createNewWorkspaceTab = useCallback((): string | undefined => {
    let createdTabId: string | undefined;
    guardWorkspaceLeave(() => { createdTabId = createNewWorkspaceTabUnguarded(); });
    return createdTabId;
  }, [createNewWorkspaceTabUnguarded, guardWorkspaceLeave]);

  // Synchronous: callers (workspace selection, drop targets) run the
  // unsaved-changes guard themselves before calling this.
  const prepareWorkspaceOpen = useCallback((): WorkspaceOperationContext | undefined => {
    if (!isTabView) { clearPendingOperationState(); return undefined; }
    const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
    const targetTabId = !active || active.kind === 'home' ? createNewWorkspaceTabUnguarded() : active.id;
    return beginOperationForTab(targetTabId);
  }, [beginOperationForTab, clearPendingOperationState, createNewWorkspaceTabUnguarded, isTabView, tabs]);

  const reopenUnavailableWorkspace = useCallback((oldPath: string) => {
    if (!oldPath) return;
    if (!isTabView) {
      clearPendingOperationState();
      bridge.postMessage({ command: 'openFolder', openFirstFile: false, replaceRecentWorkspacePath: oldPath });
      return;
    }
    const targetTabId = activeTabIdRef.current === 'home' ? createTabId() : activeTabIdRef.current;
    const operation = beginOperationForTab(targetTabId);
    pendingWorkspaceReplacementRef.current = { workspaceOperationId: operation.workspaceOperationId, oldPath };
    bridge.postMessage({ command: 'openFolder', openFirstFile: true, replaceRecentWorkspacePath: oldPath, ...operation });
  }, [beginOperationForTab, bridge, clearPendingOperationState, isTabView]);

  const openDroppedPath = useCallback((droppedPath: string) => {
    if (!droppedPath) return;
    if (isTabView) {
      guardWorkspaceLeave(() => {
        const active = tabs.find((tab) => tab.id === activeTabIdRef.current);
        const targetTabId = active?.kind === 'new' ? active.id : createNewWorkspaceTabUnguarded();
        const operation = beginOperationForTab(targetTabId);
        bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true, ...operation });
      });
      return;
    }

    if (workspaceNameRef.current) {
      setPendingDroppedPath(droppedPath);
      return;
    }

    bridge.postMessage({ command: 'openPath', path: droppedPath, openFirstFile: true });
  }, [beginOperationForTab, bridge, createNewWorkspaceTabUnguarded, guardWorkspaceLeave, isTabView, tabs]);

  const confirmSwitchWorkspace = useCallback(() => {
    if (!pendingDroppedPath) return;
    const path = pendingDroppedPath;
    setPendingDroppedPath(null);
    guardWorkspaceLeave(() => bridge.postMessage({ command: 'openPath', path, openFirstFile: true }));
  }, [bridge, guardWorkspaceLeave, pendingDroppedPath]);

  const { closeTab, reorderTabs, closeTabsToRight, closeOtherTabs, closeAllTabs,
    updateTabAlias, updateWorkspaceAlias } = useDesktopTabManagement({
    tabs, tabsRef, activeTabIdRef, pendingWorkspaceTabIdRef, setTabs, setActiveTabId,
    setWorkspaceAliases, activateTab: switchToTab, bridge, dispatchEmptyWorkspace, isTabView, setNavigationScope,
    guardWorkspaceLeave,
  });

  const { crossTabSearchItems, isIndexingAcrossTabs } = useDesktopTabSearchSync({
    tabs, tabsRef, setTabs, pendingWorkspaceTabIdRef, pendingWorkspaceReplacementRef,
    requestedWorkspaceIndexesRef, bridge, isTabView, isLoading: state.isLoading,
    createNewWorkspaceTab: createNewWorkspaceTabUnguarded, beginOperationForTab, guardWorkspaceLeave,
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
    activeTabId, tabs, setActiveTabId, workspaceAliases, activateTab, createNewWorkspaceTab,
    prepareWorkspaceOpen, reopenUnavailableWorkspace, openDroppedPath, pendingDroppedPath,
    setPendingDroppedPath, confirmSwitchWorkspace, closeTab, reorderTabs, closeTabsToRight,
    closeOtherTabs, closeAllTabs, cancelCurrentWorkspaceScan, updateTabAlias, updateWorkspaceAlias,
    crossTabSearchItems, isIndexingAcrossTabs,
  };
}
