import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createEmptyTab, reorderDesktopTabs } from '../desktop/desktopTabs';
import { clearWorkspaceOperation, getActiveWorkspaceOperation } from '../desktop/workspaceOperations';
import type { DesktopTab, WorkspaceAliasMap } from '../desktop/types';

interface DesktopTabManagementOptions {
  tabs: DesktopTab[];
  tabsRef: MutableRefObject<DesktopTab[]>;
  activeTabIdRef: MutableRefObject<string>;
  pendingWorkspaceTabIdRef: MutableRefObject<string | null>;
  setTabs: Dispatch<SetStateAction<DesktopTab[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setWorkspaceAliases: Dispatch<SetStateAction<WorkspaceAliasMap>>;
  activateTab: (tabId: string, targetFilePath?: string) => void;
  bridge: { postMessage: (message: any) => void };
  dispatchEmptyWorkspace: () => void;
  isTabView: boolean;
  setNavigationScope: (scopeId: string) => void;
}

export function useDesktopTabManagement({
  tabs, tabsRef, activeTabIdRef, pendingWorkspaceTabIdRef, setTabs, setActiveTabId,
  setWorkspaceAliases, activateTab, bridge, dispatchEmptyWorkspace, isTabView, setNavigationScope,
}: DesktopTabManagementOptions) {
  const cancelOperationForTabs = useCallback((tabIds: Iterable<string>) => {
    const operation = getActiveWorkspaceOperation();
    if (!operation || !new Set(tabIds).has(operation.workspaceTabId)) return;
    bridge.postMessage({ command: 'cancelWorkspaceScan', workspaceOperationId: operation.workspaceOperationId });
    clearWorkspaceOperation(operation.workspaceOperationId);
    pendingWorkspaceTabIdRef.current = null;
  }, [bridge, pendingWorkspaceTabIdRef]);

  const closeTab = useCallback((tabId: string) => {
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
  }, [activateTab, activeTabIdRef, cancelOperationForTabs, setTabs]);

  const reorderTabs = useCallback((sourceTabId: string, targetTabId: string) => {
    if (sourceTabId && targetTabId && sourceTabId !== targetTabId) {
      setTabs((currentTabs) => reorderDesktopTabs(currentTabs, sourceTabId, targetTabId));
    }
  }, [setTabs]);

  const closeTabsToRight = useCallback((tabId: string) => {
    const workspaceTabs = tabsRef.current.filter((tab) => tab.kind !== 'home');
    const targetIndex = workspaceTabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex >= 0) cancelOperationForTabs(workspaceTabs.slice(targetIndex + 1).map((tab) => tab.id));
    setTabs((currentTabs) => {
      const currentWorkspaceTabs = currentTabs.filter((tab) => tab.kind !== 'home');
      const workspaceIndex = currentWorkspaceTabs.findIndex((tab) => tab.id === tabId);
      if (workspaceIndex === -1 || workspaceIndex >= currentWorkspaceTabs.length - 1) return currentTabs;
      const retainedIds = new Set(currentWorkspaceTabs.slice(0, workspaceIndex + 1).map((tab) => tab.id));
      const nextTabs = currentTabs.filter((tab) => tab.kind === 'home' || retainedIds.has(tab.id));
      if (!nextTabs.some((tab) => tab.id === activeTabIdRef.current)) window.setTimeout(() => activateTab(tabId), 0);
      return nextTabs.length ? nextTabs : [createEmptyTab('home', 'home')];
    });
  }, [activateTab, activeTabIdRef, cancelOperationForTabs, setTabs, tabsRef]);

  const closeOtherTabs = useCallback((tabId: string) => {
    cancelOperationForTabs(tabsRef.current.filter((tab) => tab.kind !== 'home' && tab.id !== tabId).map((tab) => tab.id));
    setTabs((currentTabs) => {
      const targetTab = currentTabs.find((tab) => tab.id === tabId);
      if (!targetTab || targetTab.kind === 'home') return currentTabs;
      const nextTabs = currentTabs.filter((tab) => tab.kind === 'home' || tab.id === tabId);
      if (activeTabIdRef.current !== tabId) window.setTimeout(() => activateTab(tabId), 0);
      return nextTabs.length ? nextTabs : [createEmptyTab('home', 'home')];
    });
  }, [activateTab, activeTabIdRef, cancelOperationForTabs, setTabs, tabsRef]);

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
  }, [bridge, dispatchEmptyWorkspace, isTabView, pendingWorkspaceTabIdRef, setActiveTabId, setNavigationScope, setTabs]);

  const updateWorkspaceAlias = useCallback((workspacePath: string, alias: string, fallbackName = '') => {
    const normalizedAlias = alias.trim();
    const persistedAlias = normalizedAlias && normalizedAlias !== fallbackName.trim() ? normalizedAlias : '';
    setWorkspaceAliases((currentAliases) => {
      const nextAliases = { ...currentAliases };
      if (persistedAlias) nextAliases[workspacePath] = persistedAlias;
      else delete nextAliases[workspacePath];
      return nextAliases;
    });
    setTabs((currentTabs) => currentTabs.map((item) => item.workspacePath === workspacePath
      ? { ...item, alias: persistedAlias || undefined } : item));
  }, [setTabs, setWorkspaceAliases]);

  const updateTabAlias = useCallback((tabId: string, alias: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (tab.workspacePath) updateWorkspaceAlias(tab.workspacePath, alias, tab.workspaceName ?? '');
    else setTabs((currentTabs) => currentTabs.map((item) => item.id === tabId
      ? { ...item, alias: alias.trim() || undefined } : item));
  }, [setTabs, tabs, updateWorkspaceAlias]);

  return { closeTab, reorderTabs, closeTabsToRight, closeOtherTabs, closeAllTabs, updateTabAlias, updateWorkspaceAlias };
}
