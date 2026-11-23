import { useCallback, useEffect, useRef } from "react";
import {
  clearSearchJumpMarks,
  scrollToRenderedSearchMatch,
  SEARCH_JUMP_MARK_CLASS,
  SEARCH_JUMP_TARGET_CLASS,
} from "./utils/searchJump";
import { resolveBookmarkTarget } from "./bookmarks/bookmarkModel.ts";
import type { BookmarkRecord } from "./bookmarks/types.ts";
import { clearBookmarkJumpMarks, scrollToBookmarkTarget } from "./utils/bookmarkJump.ts";
import { normalizePathKey } from "./contexts/appStateModel";
import { useRepositorySnapshot } from "./contexts/RepositorySnapshotContext";
import { getActiveDocumentBody, getActiveDocumentRoot } from "./document/activeDocumentRoot";
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

const CACHED_RENDER_RECOVERY_MS = 2500;

function activeDocumentFile(state: any): string | null {
  if (state.splitView?.enabled) {
    return state.splitView[state.splitView.activePane]?.filePath ?? state.currentFile ?? null;
  }
  return state.currentFile ?? null;
}

function isSameLiveLoadedDocument(state: any, filePath: string): boolean {
  const activeFile = activeDocumentFile(state);
  return Boolean(
    activeFile
    && normalizePathKey(activeFile) === normalizePathKey(filePath)
    && !state.isLoading
    && !state.notFoundHref
    && !state.staleContentFilePath
    && Boolean(state.contentHtml),
  );
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
  const { repositoryView, returnToHead } = useRepositorySnapshot();
  const lastAppliedJumpRef = useRef<{
    jump: any;
    appliedAt: number;
    appliedRenderVersion: number;
  } | null>(null);

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

  useEffect(() => () => { clearSearchJumpMarks(); clearBookmarkJumpMarks(); }, []);

  const currentActiveFile = activeDocumentFile(state);

  useEffect(() => {
    if (!pendingSearchJump) return;
    if (state.isLoading) return;
    if (!currentActiveFile || normalizePathKey(currentActiveFile) !== normalizePathKey(pendingSearchJump.filePath)) {
      return;
    }

    let retries = 0;
    let handle = 0;

    const tryScroll = () => {
      const documentSource = getActiveDocumentRoot()?.markdownSource
        ?? state.markdownSource
        ?? state.sourceDocumentText
        ?? '';
      const bookmarkResolution = pendingSearchJump.bookmark
        ? resolveBookmarkTarget(pendingSearchJump.bookmark, documentSource)
        : null;
      const success = pendingSearchJump.bookmark
        ? bookmarkResolution?.status === 'resolved'
          && scrollToBookmarkTarget(pendingSearchJump.bookmark, bookmarkResolution, documentSource)
        : scrollToRenderedSearchMatch(
            pendingSearchJump.query,
            pendingSearchJump.matchOrdinal,
            pendingSearchJump.matchIndex,
            documentSource || null,
            pendingSearchJump.matchCase === true,
            {
              lineNumber: pendingSearchJump.lineNumber,
              excerpt: pendingSearchJump.excerpt,
            },
          );
      if (!success && retries < 8) {
        retries++;
        handle = window.setTimeout(tryScroll, 100);
      } else {
        if (success && !pendingSearchJump.bookmark) {
          lastAppliedJumpRef.current = {
            jump: pendingSearchJump,
            appliedAt: Date.now(),
            appliedRenderVersion: state.renderVersion ?? 0,
          };
        }
        if (!success && pendingSearchJump.failureMessage) {
          window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', {
            detail: pendingSearchJump.failureMessage,
          }));
        }
        setPendingSearchJump((current: any) =>
          current?.token === pendingSearchJump.token ? null : current,
        );
      }
    };

    handle = window.setTimeout(tryScroll, 80);

    return () => window.clearTimeout(handle);
  }, [
    pendingSearchJump,
    currentActiveFile,
    state.isLoading,
    state.renderVersion,
    state.markdownSource,
    state.sourceDocumentText,
    setPendingSearchJump,
  ]);

  useEffect(() => {
    const applied = lastAppliedJumpRef.current;
    if (!applied || pendingSearchJump || state.isLoading) return;
    if (!currentActiveFile || normalizePathKey(currentActiveFile) !== normalizePathKey(applied.jump.filePath)) {
      lastAppliedJumpRef.current = null;
      return;
    }
    const currentVersion = state.renderVersion ?? 0;
    if (currentVersion === applied.appliedRenderVersion) return;
    if (Date.now() - applied.appliedAt > CACHED_RENDER_RECOVERY_MS) {
      lastAppliedJumpRef.current = null;
      return;
    }

    const handle = window.setTimeout(() => {
      const body = getActiveDocumentBody();
      if (body?.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}, .${SEARCH_JUMP_TARGET_CLASS}`)) return;
      const documentSource = getActiveDocumentRoot()?.markdownSource
        ?? state.markdownSource
        ?? state.sourceDocumentText
        ?? null;
      scrollToRenderedSearchMatch(
        applied.jump.query,
        applied.jump.matchOrdinal,
        applied.jump.matchIndex,
        documentSource,
        applied.jump.matchCase === true,
        {
          lineNumber: applied.jump.lineNumber,
          excerpt: applied.jump.excerpt,
        },
      );
      lastAppliedJumpRef.current = {
        ...applied,
        appliedRenderVersion: currentVersion,
      };
    }, 40);

    return () => window.clearTimeout(handle);
  }, [
    pendingSearchJump,
    currentActiveFile,
    state.isLoading,
    state.renderVersion,
    state.markdownSource,
    state.sourceDocumentText,
  ]);

  const queueSearchJump = useCallback(
    (
      filePath: string,
      query: string,
      matchOrdinal?: number,
      matchIndex?: number,
      matchCase = false,
      failureMessage?: string,
      lineNumber?: number,
      excerpt?: string,
    ) => {
      const trimmedQuery = typeof query === 'string' ? query.trim() : '';
      if (!filePath || !trimmedQuery) return;
      lastAppliedJumpRef.current = null;
      setPendingSearchJump({
        filePath,
        query: trimmedQuery,
        matchOrdinal,
        matchIndex,
        lineNumber,
        excerpt,
        matchCase,
        failureMessage,
        token: Date.now() + Math.random(),
      });
    },
    [setPendingSearchJump],
  );

  const queueBookmarkJump = useCallback((filePath: string, bookmark: BookmarkRecord, failureMessage?: string) => {
    if (!filePath) return;
    lastAppliedJumpRef.current = null;
    setPendingSearchJump({
      filePath,
      query: bookmark.renderedText,
      bookmark,
      failureMessage,
      token: Date.now() + Math.random(),
    });
  }, [setPendingSearchJump]);

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
      const { filePath, query, matchOrdinal, matchIndex, matchCase, lineNumber, excerpt } = e.detail ?? {};
      if (repositoryView.mode === 'revision' && typeof filePath === 'string' && !filePath.startsWith('revision://')) {
        returnToHead();
      }
      queueSearchJump(filePath, query, matchOrdinal, matchIndex, matchCase === true, undefined, lineNumber, excerpt);
    };
    window.addEventListener('search-jump', handleJump as any);
    return () => window.removeEventListener('search-jump', handleJump as any);
  }, [queueSearchJump, repositoryView.mode, returnToHead]);

  const handleWorkspaceSearchSelect = useCallback(
    (
      item: { fsPath: string; matchOrdinal?: number; matchIndex?: number; lineNumber?: number; excerpt?: string },
      query: string,
      matchCase = false,
    ) => {
      if (repositoryView.mode === 'revision') {
        returnToHead();
      }
      queueSearchJump(
        item.fsPath,
        query,
        item.matchOrdinal,
        item.matchIndex,
        matchCase,
        undefined,
        item.lineNumber,
        item.excerpt,
      );
      if (!isSameLiveLoadedDocument(state, item.fsPath)) {
        navigate(item.fsPath);
      }
    },
    [navigate, queueSearchJump, repositoryView.mode, returnToHead, state],
  );

  const handleCrossTabSelect = useCallback(
    (
      item: { tabId: string; fsPath: string; matchOrdinal?: number; matchIndex?: number; lineNumber?: number; excerpt?: string },
      query: string,
      matchCase = false,
    ) => {
      const tab = tabs.find((entry) => entry.id === item.tabId);
      if (!tab) return;
      if (repositoryView.mode === 'revision') {
        returnToHead();
      }
      queueSearchJump(
        item.fsPath,
        query,
        item.matchOrdinal,
        item.matchIndex,
        matchCase,
        undefined,
        item.lineNumber,
        item.excerpt,
      );
      activateTab(item.tabId, item.fsPath);
    },
    [activateTab, queueSearchJump, repositoryView.mode, returnToHead, tabs],
  );

  return {
    toggleFullscreen,
    openSidebarSearch,
    handleWorkspaceSearchSelect,
    handleCrossTabSelect,
    queueSearchJump,
    queueBookmarkJump,
  };
}
