// =============================================================================
// hooks/useKeyboard.ts — Global keyboard shortcuts & mouse navigation
// =============================================================================

import { useEffect, useMemo } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';
import { requestAnimatedContentTabClose } from '../components/Content/contentTabCloseEvents';

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

import {
  isEditableTarget,
  resolveKeyboardAction,
} from './keyboardUtils';

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
  const {
    state,
    toggleTheme,
    toggleSidebar,
    navigate,
    refresh,
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!state.currentFile && e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        return;
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
        hasOnToggleToc: !!onToggleToc,
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
          if (isSearchOpen && activeSearchScope === 'all-tabs') {
            onSearchClose();
          } else {
            onCrossTabSearchOpen?.();
          }
          break;
        case 'current-search-toggle':
          if (isSearchOpen && activeSearchScope === 'current') {
            onSearchClose();
          } else {
            onSearchOpen();
          }
          break;
        case 'find-toggle':
          if (isFindOpen && onFindClose) {
            onFindClose();
          } else {
            onFindOpen?.();
          }
          break;
        case 'back':
          back();
          break;
        case 'forward':
          forward();
          break;
        case 'welcome':
          if (onWelcome) {
            onWelcome();
          } else {
            navigate(null);
          }
          break;
        case 'settings-toggle':
          if (isSettingsOpen) {
            onSettingsClose();
          } else {
            onSettingsOpen();
          }
          break;
        case 'toggle-theme':
          toggleTheme();
          break;
        case 'toggle-toc':
          onToggleToc?.();
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
            if (!requestAnimatedContentTabClose({ action: 'closeThisTab', filePath })) {
              closeContentTab(filePath);
            }
          }
          break;
        case 'close-all-content-tabs':
          if (!requestAnimatedContentTabClose({ action: 'closeAllTabs' })) {
            closeAllContentTabs();
          }
          break;
        case 'close-content-tabs-to-right':
          if (state.activeContentTabPath) {
            const filePath = state.activeContentTabPath;
            if (!requestAnimatedContentTabClose({ action: 'closeTabsToRight', filePath })) {
              closeContentTabsToRight(filePath);
            }
          }
          break;
        case 'close-other-content-tabs':
          if (state.activeContentTabPath) {
            const filePath = state.activeContentTabPath;
            if (!requestAnimatedContentTabClose({ action: 'closeOtherTabs', filePath })) {
              closeOtherContentTabs(filePath);
            }
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

    const mouseHandler = (e: MouseEvent) => {
      if (isTermsOpen) return;
      // e.button: 3 is back mouse button, 4 is forward mouse button
      if (e.button === 3) {
        e.preventDefault();
        back();
      } else if (e.button === 4) {
        e.preventDefault();
        forward();
      }
    };

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          bridge.postMessage({ command: 'zoom-in' });
        } else if (e.deltaY > 0) {
          bridge.postMessage({ command: 'zoom-out' });
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    window.addEventListener('mouseup', mouseHandler);
    if (isDesktop) {
      window.addEventListener('wheel', wheelHandler, { passive: false });
    }

    return () => {
      document.removeEventListener('keydown', handler, true);
      window.removeEventListener('mouseup', mouseHandler);
      if (isDesktop) {
        window.removeEventListener('wheel', wheelHandler);
      }
    };
  }, [
    back,
    forward,
    navigate,
    refresh,
    toggleTheme,
    toggleSidebar,
    closeContentTab,
    closeAllContentTabs,
    closeContentTabsToRight,
    closeOtherContentTabs,
    bridge,
    keybindings,
    isDesktop,
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
    onLocateFile,
  onBookmarksOpen,
    onOpenCurrentDocumentLocation,
    onToggleDesktopViewMode,
    activeHtmlDocument,
    onToggleActiveHtmlDocumentPreview,
    onToggleFullscreen,
    onWorkspaceSelection,
    state.activeContentTabPath,
    state.currentFile,
  ]);
}
