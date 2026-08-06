import { useCallback, useMemo } from 'react';
import type { AppState } from '../contexts/appStateModel';
import type { Translations } from '../contexts/translationTypes';
import type { DesktopTab } from '../desktop/types';
import type { BookmarkRecord, OpenBookmarkWorkspace } from '../bookmarks/types.ts';
import { getBookmarkWorkspaceKey, resolveBookmarkTarget } from '../bookmarks/bookmarkModel.ts';

interface BookmarkNavigationArgs {
  state: Pick<AppState, 'workspacePath' | 'workspaceName' | 'fileList' | 'currentFile' | 'markdownSource' | 'sourceDocumentText'>;
  tabs: readonly DesktopTab[];
  isTabView: boolean;
  translations: Translations['bookmarks'];
  activateTab: (tabId: string, filePath?: string) => void;
  navigate: (filePath: string) => void;
  queueBookmarkJump: (filePath: string, bookmark: BookmarkRecord, failureMessage?: string) => void;
}

function showBookmarkNotice(message: string): void {
  window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', { detail: message }));
}

export function useBookmarkNavigation({
  state,
  tabs,
  isTabView,
  translations,
  activateTab,
  navigate,
  queueBookmarkJump,
}: BookmarkNavigationArgs) {
  const activeBookmarkWorkspaceKey = getBookmarkWorkspaceKey(state.workspacePath, state.workspaceName);
  const bookmarkWorkspaces = useMemo<OpenBookmarkWorkspace[]>(() => {
    if (!isTabView) {
      return state.workspaceName ? [{
        id: 'focus',
        workspaceKey: activeBookmarkWorkspaceKey,
        workspaceName: state.workspaceName,
        workspacePath: state.workspacePath,
      }] : [];
    }
    return tabs.flatMap((tab) => tab.kind === 'workspace' && tab.workspaceName
      ? [{
          id: tab.id,
          workspaceKey: getBookmarkWorkspaceKey(tab.workspacePath, tab.workspaceName),
          workspaceName: tab.alias || tab.workspaceName,
          workspacePath: tab.workspacePath,
        }]
      : []);
  }, [activeBookmarkWorkspaceKey, isTabView, state.workspaceName, state.workspacePath, tabs]);

  const handleBookmarkNavigate = useCallback((bookmark: BookmarkRecord) => {
    const targetTab = isTabView
      ? tabs.find((tab) => tab.kind === 'workspace'
          && getBookmarkWorkspaceKey(tab.workspacePath, tab.workspaceName ?? '') === bookmark.workspaceKey)
      : null;
    if ((isTabView && !targetTab) || (!isTabView && bookmark.workspaceKey !== activeBookmarkWorkspaceKey)) {
      showBookmarkNotice(translations.workspaceUnavailable);
      return;
    }
    const availableFiles = targetTab?.fileList ?? state.fileList;
    if (!availableFiles.some((file) => file.fsPath === bookmark.filePath)) {
      showBookmarkNotice(translations.fileUnavailable);
      return;
    }
    const cachedDocument = targetTab
      ? targetTab.currentFile === bookmark.filePath
        ? targetTab.markdownSource ?? targetTab.sourceDocumentText ?? ''
        : ''
      : state.currentFile === bookmark.filePath
        ? state.markdownSource ?? state.sourceDocumentText ?? ''
        : '';
    const resolved = cachedDocument ? resolveBookmarkTarget(bookmark, cachedDocument) : null;
    if (resolved?.status === 'targetChanged') {
      showBookmarkNotice(translations.targetUnavailable);
      return;
    }
    queueBookmarkJump(bookmark.filePath, bookmark, translations.targetUnavailable);
    if (targetTab) activateTab(targetTab.id, bookmark.filePath);
    else navigate(bookmark.filePath);
  }, [
    activateTab,
    activeBookmarkWorkspaceKey,
    isTabView,
    navigate,
    queueBookmarkJump,
    state.currentFile,
    state.fileList,
    state.markdownSource,
    state.sourceDocumentText,
    tabs,
    translations,
  ]);

  return { activeBookmarkWorkspaceKey, bookmarkWorkspaces, handleBookmarkNavigate };
}
