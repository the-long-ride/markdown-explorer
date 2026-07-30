import { useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getTabLabel } from '../desktop/desktopTabs';
import { clearWorkspaceOperation, getActiveWorkspaceOperation, type WorkspaceOperationContext } from '../desktop/workspaceOperations';
import type { CrossTabSearchItem, DesktopTab } from '../desktop/types';

interface DesktopTabSearchSyncOptions {
  tabs: DesktopTab[];
  tabsRef: MutableRefObject<DesktopTab[]>;
  setTabs: Dispatch<SetStateAction<DesktopTab[]>>;
  pendingWorkspaceTabIdRef: MutableRefObject<string | null>;
  pendingWorkspaceReplacementRef: MutableRefObject<{ workspaceOperationId: string; oldPath: string } | null>;
  requestedWorkspaceIndexesRef: MutableRefObject<Set<string>>;
  bridge: { postMessage: (message: any) => void; onMessage: (handler: (message: any) => void) => () => void };
  isTabView: boolean;
  isLoading: boolean;
  createNewWorkspaceTab: () => string;
  beginOperationForTab: (tabId: string) => WorkspaceOperationContext;
}

export function useDesktopTabSearchSync({
  tabs, tabsRef, setTabs, pendingWorkspaceTabIdRef, pendingWorkspaceReplacementRef,
  requestedWorkspaceIndexesRef, bridge, isTabView, isLoading, createNewWorkspaceTab, beginOperationForTab,
}: DesktopTabSearchSyncOptions) {
  const crossTabSearchItems = useMemo<CrossTabSearchItem[]>(() => tabs.flatMap((tab) =>
    tab.kind === 'workspace' ? tab.fileList.map((file) => ({ tabId: tab.id, tabLabel: getTabLabel(tab),
      fsPath: file.fsPath, title: file.title, fileName: file.fileName, relativePath: file.relativePath })) : []), [tabs]);

  useEffect(() => bridge.onMessage((msg) => {
    const pendingReplacement = pendingWorkspaceReplacementRef.current;
    if (msg.command === 'workspaceOpenCancelled') {
      const activeOperation = getActiveWorkspaceOperation();
      const matchesActive = activeOperation !== null
        && msg.workspaceOperationId === activeOperation.workspaceOperationId
        && msg.workspaceTabId === activeOperation.workspaceTabId;
      const matchesReplacement = Boolean(pendingReplacement && msg.workspaceOperationId === pendingReplacement.workspaceOperationId);
      if (!matchesActive && !matchesReplacement) return;
      const cancelledTabId = msg.workspaceTabId ?? activeOperation?.workspaceTabId;
      if (matchesReplacement) pendingWorkspaceReplacementRef.current = null;
      clearWorkspaceOperation(msg.workspaceOperationId);
      pendingWorkspaceTabIdRef.current = null;
      if (cancelledTabId) setTabs((currentTabs) => currentTabs.map((tab) => tab.id === cancelledTabId
        ? { ...tab, workspaceOperationId: undefined, workspaceLoadState: tab.workspacePath ? 'ready' : 'idle' } : tab));
      return;
    }
    if (msg.command === 'readyAck' && pendingReplacement && msg.workspaceOperationId === pendingReplacement.workspaceOperationId) {
      pendingWorkspaceReplacementRef.current = null;
    }
    if (msg.workspaceOperationId && msg.workspaceTabId) {
      const activeOperation = getActiveWorkspaceOperation();
      if (activeOperation && activeOperation.workspaceOperationId === msg.workspaceOperationId && activeOperation.workspaceTabId === msg.workspaceTabId) {
        if (msg.command === 'setLoading' || (msg.command === 'workspaceScanProgress' && msg.active)) {
          setTabs((currentTabs) => currentTabs.map((tab) => tab.id === msg.workspaceTabId ? { ...tab, workspaceLoadState: 'loading' } : tab));
        } else if (msg.command === 'workspaceScanProgress' && !msg.active) {
          setTabs((currentTabs) => currentTabs.map((tab) => tab.id === msg.workspaceTabId ? { ...tab, workspaceLoadState: 'ready' } : tab));
        }
      }
    }
    if (msg.command === 'externalOpenPath') {
      if (isTabView) {
        const targetTabId = createNewWorkspaceTab();
        const operation = beginOperationForTab(targetTabId);
        bridge.postMessage({ command: 'openPath', path: msg.path, openFirstFile: false, ...operation });
      } else bridge.postMessage({ command: 'openPath', path: msg.path, openFirstFile: false });
      return;
    }
    if (!isTabView || msg.command !== 'workspaceSearchIndexLoaded') return;
    const loadedTabs = new Map(msg.tabs.map((tab: any) => [tab.tabId, tab]));
    setTabs((currentTabs) => currentTabs.map((tab) => {
      const loaded = loadedTabs.get(tab.id) as any;
      return !loaded || tab.workspacePath !== loaded.workspacePath ? tab : { ...tab,
        fileList: tab.fileList.length > 0 ? tab.fileList : loaded.fileList,
        tree: tab.tree ?? loaded.tree, isIndexed: true };
    }));
  }), [beginOperationForTab, bridge, createNewWorkspaceTab, isTabView, pendingWorkspaceReplacementRef, pendingWorkspaceTabIdRef, setTabs]);

  useEffect(() => {
    if (!isTabView || isLoading) return;
    const handle = window.setTimeout(() => {
      const pendingTabs = tabsRef.current.flatMap((tab) => {
        if (tab.kind !== 'workspace' || !tab.workspacePath || tab.isIndexed || tab.fileList.length > 0) return [];
        const requestKey = `${tab.id}:${tab.workspacePath}`;
        if (requestedWorkspaceIndexesRef.current.has(requestKey)) return [];
        requestedWorkspaceIndexesRef.current.add(requestKey);
        return [{ tabId: tab.id, workspacePath: tab.workspacePath }];
      });
      if (pendingTabs.length > 0) bridge.postMessage({ command: 'loadWorkspaceSearchIndexes', tabs: pendingTabs });
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [bridge, isLoading, isTabView, requestedWorkspaceIndexesRef, tabsRef]);

  const isIndexingAcrossTabs = useMemo(() => isTabView && tabs.some((tab) => tab.kind === 'workspace'
    && Boolean(tab.workspacePath) && !tab.isIndexed && tab.fileList.length === 0), [isTabView, tabs]);

  return { crossTabSearchItems, isIndexingAcrossTabs };
}
