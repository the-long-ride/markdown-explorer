import { useCallback, useEffect } from "react";
import { clearSearchJumpMarks, scrollToRenderedSearchMatch } from "./utils/searchJump";
import type { HostMessage, WebviewMessage } from './types';

interface AppSearchEffectsArgs {
  bridge: { onMessage: (handler: (msg: HostMessage) => void) => () => void; postMessage: (message: WebviewMessage) => void };
  state: any;
  pendingSearchJump: any;
  setPendingSearchJump: React.Dispatch<React.SetStateAction<any>>;
  setIsFullscreen: (value: boolean) => void;
  navigate: (path: string) => void;
  tabs: Array<{ id: string }>;
  activateTab: (tabId: string, filePath?: string) => void;
  toggleSidebar: () => void;
  dispatch: (action: any) => void;
}

export function useAppSearchEffects({
  bridge,
  state,
  pendingSearchJump,
  setPendingSearchJump,
  setIsFullscreen,
  navigate,
  tabs,
  activateTab,
  toggleSidebar,
  dispatch,
}: AppSearchEffectsArgs) {
  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (msg.command === 'fullscreenChanged') {
        setIsFullscreen(msg.isFullscreen);
      }
    });
  }, [bridge]);

  const toggleFullscreen = useCallback(() => {
    bridge.postMessage({ command: 'toggle-fullscreen' });
  }, [bridge]);

  useEffect(() => () => clearSearchJumpMarks(), []);

  useEffect(() => {
    if (!pendingSearchJump) return;
    if (state.currentFile !== pendingSearchJump.filePath) return;

    let retries = 0;
    let handle = 0;

    const tryScroll = () => {
      const success = scrollToRenderedSearchMatch(
        pendingSearchJump.query,
        pendingSearchJump.matchOrdinal,
        pendingSearchJump.matchIndex,
        state.markdownSource
      );
      if (!success && retries < 4) {
        retries++;
        handle = window.setTimeout(tryScroll, 100);
      } else {
          setPendingSearchJump((current: any) =>
          current?.token === pendingSearchJump.token ? null : current,
        );
      }
    };

    handle = window.setTimeout(tryScroll, 80);

    return () => window.clearTimeout(handle);
  }, [pendingSearchJump, state.currentFile, state.renderVersion, state.markdownSource]);

  const queueSearchJump = useCallback(
    (filePath: string, query: string, matchOrdinal?: number, matchIndex?: number) => {
      const trimmedQuery = query.trim();
      if (!filePath || !trimmedQuery) return;
      setPendingSearchJump({
        filePath,
        query: trimmedQuery,
        matchOrdinal,
        matchIndex,
        token: Date.now() + Math.random(),
      });
    },
    [],
  );

  const openSidebarSearch = useCallback(() => {
    if (state.sidebarCollapsed) {
      toggleSidebar();
    }
    dispatch({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'search' });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('focus-sidebar-search-input'));
    }, 50);
  }, [state.sidebarCollapsed, toggleSidebar, dispatch]);

  useEffect(() => {
    const handleJump = (e: CustomEvent) => {
      const { filePath, query, matchOrdinal, matchIndex } = e.detail;
      queueSearchJump(filePath, query, matchOrdinal, matchIndex);
    };
    window.addEventListener('search-jump', handleJump as any);
    return () => window.removeEventListener('search-jump', handleJump as any);
  }, [queueSearchJump]);

  const handleWorkspaceSearchSelect = useCallback(
    (item: { fsPath: string; matchOrdinal?: number; matchIndex?: number }, query: string) => {
      queueSearchJump(item.fsPath, query, item.matchOrdinal, item.matchIndex);
      navigate(item.fsPath);
    },
    [navigate, queueSearchJump],
  );

  const handleCrossTabSelect = useCallback(
    (item: { tabId: string; fsPath: string; matchOrdinal?: number; matchIndex?: number }, query: string) => {
      const tab = tabs.find((entry) => entry.id === item.tabId);
      if (!tab) return;
      queueSearchJump(item.fsPath, query, item.matchOrdinal, item.matchIndex);
      activateTab(item.tabId, item.fsPath);
    },
    [activateTab, queueSearchJump, tabs],
  );

  return {
    toggleFullscreen,
    openSidebarSearch,
    handleWorkspaceSearchSelect,
    handleCrossTabSelect,
  };
}
