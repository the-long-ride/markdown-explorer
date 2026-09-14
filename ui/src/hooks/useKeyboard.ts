// =============================================================================
// hooks/useKeyboard.ts — Global keyboard shortcuts & mouse navigation
// =============================================================================

import { useEffect, useMemo } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';
import { documentSessionKey, isDocumentSavable } from '../editor/documentSession';
import { requestAnimatedContentTabClose } from '../components/Content/contentTabCloseEvents';
import { getScopeNavigationStateSnapshot, requestScopeNavigation, useScopeNavigationState } from './useScopeNavigationState';
import { attachMouseHistoryNavigation } from '../utils/mouseHistoryNavigation';

interface UseKeyboardOptions {
  onSearchOpen: () => void;
  onCrossTabSearchOpen?: () => void;
  onSearchClose: () => void;
  onFindOpen?: () => void;
  onFindClose?: () => void;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onWelcome?: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSidebarCursorModeToggle?: () => void;
  onSidebarCursorModeClose?: () => void;
  isSearchOpen: boolean;
  isFindOpen?: boolean;
  activeSearchScope?: 'current' | 'all-tabs';
  isSidebarCursorMode?: boolean;
  isSettingsOpen: boolean;
  isModalOpen: boolean;
  isTermsOpen: boolean;
  onToggleToc?: () => void;
  onToggleWorkspaceInsights?: () => void;
  onLocateFile?: () => void;
  onBookmarksOpen?: () => void;
  onOpenCurrentDocumentLocation?: () => void;
  onToggleFocusMode?: () => void;
  onToggleDesktopViewMode?: () => void;
  activeHtmlDocument?: boolean;
  onToggleActiveHtmlDocumentPreview?: () => void;
  onToggleFullscreen?: () => void;
  onWorkspaceSelection?: () => void;
}

import { isEditableTarget, matchesShortcut, resolveKeyboardAction } from './keyboardUtils';

export { isEditableTarget, matchesShortcut, resolveKeyboardAction } from './keyboardUtils';

export function useKeyboard({
  onSearchOpen,
  onCrossTabSearchOpen,
  onSearchClose,
  onFindOpen,
  onFindClose,
  onSettingsOpen,
  onSettingsClose,
  onWelcome,
  onExpandAll,
  onCollapseAll,
  onSidebarCursorModeToggle,
  onSidebarCursorModeClose,
  isSearchOpen,
  isFindOpen = false,
  activeSearchScope = 'current',
  isSidebarCursorMode = false,
  isSettingsOpen,
  isModalOpen,
  isTermsOpen,
  onToggleToc,
  onToggleWorkspaceInsights,
  onLocateFile,
  onBookmarksOpen,
  onOpenCurrentDocumentLocation,
  onToggleFocusMode,
  onToggleDesktopViewMode,
  activeHtmlDocument = false,
  onToggleActiveHtmlDocumentPreview,
  onToggleFullscreen,
  onWorkspaceSelection,
}: UseKeyboardOptions) {
  const { back, forward } = useNavigation();
  useScopeNavigationState();
  const {
    state,
    toggleTheme,
    toggleSidebar,
    navigate,
    openInEditor,
    refresh,
    saveDocument,
    closeContentTab,
    closeAllContentTabs,
    closeContentTabsToRight,
    closeOtherContentTabs,
  } = useAppState();
  const bridge = usePlatform();

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron || state.appRuntime === 'tauri';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isDesktop || isChrome;
  const keybindings = useMemo(
    () => Object.fromEntries(
      Object.entries(state.settings.keybindings || {}).map(([id, shortcut]) => [
        id,
        state.settings.disabledKeybindings?.[id] ? '' : shortcut,
      ]),
    ),
    [state.settings.disabledKeybindings, state.settings.keybindings],
  );
  const activeDocumentSession = state.currentFile ? state.documentSessions?.[documentSessionKey(state.currentFile)] : undefined;
  const hasSavableDocument = isDocumentSavable(activeDocumentSession);

  useEffect(() => {
    const routeBack = () => {
      if (getScopeNavigationStateSnapshot().active) requestScopeNavigation('previous');
      else back();
    };
    const routeForward = () => {
      if (getScopeNavigationStateSnapshot().active) requestScopeNavigation('next');
      else forward();
    };

    const handler = (e: KeyboardEvent) => {
      if (!state.currentFile && e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const isBrowserBackFallback = e.key === 'BrowserBack'
        || (e.altKey && e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.shiftKey);
      const isBrowserForwardFallback = e.key === 'BrowserForward'
        || (e.altKey && e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.shiftKey);

      if (!isTermsOpen) {
        if (getScopeNavigationStateSnapshot().active) {
          if (isBrowserBackFallback) {
            e.preventDefault();
            requestScopeNavigation('previous');
            return;
          }
          if (isBrowserForwardFallback) {
            e.preventDefault();
            requestScopeNavigation('next');
            return;
          }
        }
      }

      if (getScopeNavigationStateSnapshot().active) {
        if (matchesShortcut(e, keybindings.back)) {
          e.preventDefault();
          requestScopeNavigation('previous');
          return;
        }
        if (matchesShortcut(e, keybindings.forward)) {
          e.preventDefault();
          requestScopeNavigation('next');
          return;
        }
      }

      if (!isTermsOpen) {
        if (isBrowserBackFallback) {
          e.preventDefault();
          routeBack();
          return;
        }
        if (isBrowserForwardFallback) {
          e.preventDefault();
          routeForward();
          return;
        }
      }

      const action = resolveKeyboardAction(e, {
        isDesktop,
        isDesktopLike,
        isVscode: state.appRuntime === 'vscode',
        isTermsOpen,
        isModalOpen,
        isSearchOpen,
        isFindOpen: !!isFindOpen,
        isSettingsOpen,
        isSidebarCursorMode,
        activeSearchScope,
        keybindings,
        hasOnCrossTabSearchOpen: !!onCrossTabSearchOpen,
        hasOnFindOpen: !!onFindOpen,
        hasOnSidebarCursorModeToggle: !!onSidebarCursorModeToggle,
        hasOnSidebarCursorModeClose: !!onSidebarCursorModeClose,
        hasOnWelcome: !!onWelcome,
        hasOnEditCurrentDocument: (isDesktop || state.appRuntime === 'vscode') && !!state.currentFile,
        hasOnSaveCurrentDocument: hasSavableDocument,
        hasOnToggleToc: !!onToggleToc,
        hasOnToggleWorkspaceInsights: !!onToggleWorkspaceInsights,
        hasOnLocateFile: !!onLocateFile,
        hasOnOpenBookmarks: !!onBookmarksOpen,
        hasOnOpenCurrentDocumentLocation: !!onOpenCurrentDocumentLocation,
        hasOnToggleFocusMode: !!onToggleFocusMode,
        hasOnToggleDesktopViewMode: !!onToggleDesktopViewMode,
        activeHtmlDocument,
        onToggleActiveHtmlDocumentPreview: !!onToggleActiveHtmlDocumentPreview,
        hasOnToggleFullscreen: !!onToggleFullscreen,
        hasOnFindClose: !!onFindClose,
        isRepeat: e.repeat,
        isEditableTarget: isEditableTarget(e.target),
      });

      if (!action) return;
      e.preventDefault();

      switch (action.type) {
        case 'zoom-in':
          bridge.postMessage({ command: 'zoom-in' });
          break;
        case 'zoom-out':
          bridge.postMessage({ command: 'zoom-out' });
          break;
        case 'zoom-reset':
          bridge.postMessage({ command: 'zoom-reset' });
          break;
        case 'sidebar-cursor-mode-toggle':
          onSidebarCursorModeToggle?.();
          break;
        case 'close-sidebar-cursor-mode':
          onSidebarCursorModeClose?.();
          break;
        case 'close-search':
          onSearchClose();
          break;
        case 'close-find':
          onFindClose?.();
          break;
        case 'close-settings':
          onSettingsClose();
          break;
        case 'cross-tab-search-toggle':
          if (isSearchOpen && activeSearchScope === 'all-tabs') onSearchClose();
          else onCrossTabSearchOpen?.();
          break;
        case 'current-search-toggle':
          if (isSearchOpen && activeSearchScope === 'current') onSearchClose();
          else onSearchOpen();
          break;
        case 'find-toggle':
          if (isFindOpen && onFindClose) onFindClose();
          else onFindOpen?.();
          break;
        case 'back':
          routeBack();
          break;
        case 'forward':
          routeForward();
          break;
        case 'welcome':
          if (onWelcome) onWelcome();
          else navigate(null);
          break;
        case 'save-current-document':
          if (state.currentFile) void saveDocument(state.currentFile);
          break;
        case 'edit-current-document':
          openInEditor();
          break;
        case 'settings-toggle':
          if (isSettingsOpen) onSettingsClose();
          else onSettingsOpen();
          break;
        case 'toggle-theme':
          toggleTheme();
          break;
        case 'toggle-toc':
          onToggleToc?.();
          break;
        case 'toggle-workspace-insights':
          onToggleWorkspaceInsights?.();
          break;
        case 'locate-file':
          onLocateFile?.();
          break;
        case 'open-bookmarks':
          onBookmarksOpen?.();
          break;
        case 'open-current-document-location':
          onOpenCurrentDocumentLocation?.();
          break;
        case 'toggle-focus-mode':
          onToggleFocusMode?.();
          break;
        case 'toggle-desktop-view-mode':
          onToggleDesktopViewMode?.();
          break;
        case 'toggle-active-html-document-preview':
          onToggleActiveHtmlDocumentPreview?.();
          break;
        case 'toggle-fullscreen':
          onToggleFullscreen?.();
          break;
        case 'close-content-tab':
          if (state.activeContentTabPath) {
            const filePath = state.activeContentTabPath;
            if (!requestAnimatedContentTabClose({ action: 'closeThisTab', filePath })) closeContentTab(filePath);
          }
          break;
        case 'close-all-content-tabs':
          if (!requestAnimatedContentTabClose({ action: 'closeAllTabs' })) closeAllContentTabs();
          break;
        case 'close-content-tabs-to-right':
          if (state.activeContentTabPath) {
            const filePath = state.activeContentTabPath;
            if (!requestAnimatedContentTabClose({ action: 'closeTabsToRight', filePath })) closeContentTabsToRight(filePath);
          }
          break;
        case 'close-other-content-tabs':
          if (state.activeContentTabPath) {
            const filePath = state.activeContentTabPath;
            if (!requestAnimatedContentTabClose({ action: 'closeOtherTabs', filePath })) closeOtherContentTabs(filePath);
          }
          break;
        case 'refresh':
          refresh();
          break;
        case 'collapse-all':
          onCollapseAll();
          break;
        case 'expand-all':
          onExpandAll();
          break;
        case 'workspace-selection':
          onWorkspaceSelection?.();
          if (!onWorkspaceSelection) bridge.postMessage({ command: 'closeWorkspace' });
          break;
        case 'toggle-sidebar':
          toggleSidebar();
          break;
      }
    };

    const detachMouseHistory = attachMouseHistoryNavigation((direction) => {
      if (isTermsOpen) return;
      if (direction === 'back') routeBack();
      else routeForward();
    });

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) bridge.postMessage({ command: 'zoom-in' });
        else if (e.deltaY > 0) bridge.postMessage({ command: 'zoom-out' });
      }
    };

    document.addEventListener('keydown', handler, true);
    if (isDesktop) window.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      document.removeEventListener('keydown', handler, true);
      detachMouseHistory();
      if (isDesktop) window.removeEventListener('wheel', wheelHandler);
    };
  }, [
    back,
    forward,
    navigate,
    openInEditor,
    refresh,
    saveDocument,
    toggleTheme,
    toggleSidebar,
    closeContentTab,
    closeAllContentTabs,
    closeContentTabsToRight,
    closeOtherContentTabs,
    bridge,
    keybindings,
    isDesktop,
    hasSavableDocument,
    onSearchOpen,
    onCrossTabSearchOpen,
    onSearchClose,
    onFindOpen,
    onFindClose,
    onSettingsOpen,
    onSettingsClose,
    onWelcome,
    onExpandAll,
    onCollapseAll,
    onSidebarCursorModeToggle,
    onSidebarCursorModeClose,
    isSearchOpen,
    isFindOpen,
    activeSearchScope,
    isSidebarCursorMode,
    isSettingsOpen,
    isModalOpen,
    isTermsOpen,
    onToggleToc,
    onToggleWorkspaceInsights,
    onLocateFile,
    onBookmarksOpen,
    onOpenCurrentDocumentLocation,
    onToggleFocusMode,
    onToggleDesktopViewMode,
    activeHtmlDocument,
    onToggleActiveHtmlDocumentPreview,
    onToggleFullscreen,
    onWorkspaceSelection,
    state.activeContentTabPath,
    state.appRuntime,
    state.currentFile,
  ]);
}
