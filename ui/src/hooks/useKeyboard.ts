// =============================================================================
// hooks/useKeyboard.ts — Global keyboard shortcuts & mouse navigation
// =============================================================================

import { useEffect, useMemo } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';
import { useDirtyDocumentsGuard } from './useDirtyDocumentsGuard';
import { documentSessionKey, isDocumentSavable } from '../editor/documentSession';
import { isMarkdownEditingAvailable } from '../editor/editingFeature';
import { requestAnimatedContentTabClose } from '../components/Content/contentTabCloseEvents';
import { getScopeNavigationStateSnapshot, requestScopeNavigation, useScopeNavigationState } from './useScopeNavigationState';
import { attachMouseHistoryNavigation } from '../utils/mouseHistoryNavigation';
import { executeThemeTransition } from '../utils/themeTransition';
import { dispatchActionNotice } from '../utils/actionNotice';
import { getEditorUiTranslations } from '../contexts/editorUiTranslations';



import { isEditableTarget, matchesShortcut, resolveKeyboardAction, type UseKeyboardOptions } from './keyboardUtils';

export { isEditableTarget, matchesShortcut, resolveKeyboardAction, type UseKeyboardOptions } from './keyboardUtils';

export function useKeyboard({
  onSearchOpen, onCrossTabSearchOpen, onSearchClose, onFindOpen, onFindClose,
  onSettingsOpen, onSettingsClose, onWelcome, onExpandAll, onCollapseAll,
  onSidebarCursorModeToggle, onSidebarCursorModeClose,
  isSearchOpen, isFindOpen = false, activeSearchScope = 'current',
  isSidebarCursorMode = false, isSettingsOpen, isModalOpen, isTermsOpen,
  onToggleToc, onToggleWorkspaceInsights, onLocateFile, onFilesOpen, onBookmarksOpen,
  onOpenCurrentDocumentLocation, onToggleFocusMode, onToggleDesktopViewMode,
  activeHtmlDocument = false, onToggleActiveHtmlDocumentPreview,
  onToggleFullscreen, onWorkspaceSelection,
}: UseKeyboardOptions) {
  const { back, forward } = useNavigation();
  useScopeNavigationState();
  const {
    state,
    toggleTheme,
    toggleSidebar,
    navigate,
    openInEditor,
    setDocumentEditMode,
    refresh,
    saveDocument,
    closeContentTab,
    closeAllContentTabs,
    closeContentTabsToRight,
    closeOtherContentTabs,
  } = useAppState();
  const bridge = usePlatform();
  const guardWorkspaceLeave = useDirtyDocumentsGuard();

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron || state.appRuntime === 'tauri';
  const isWeb = typeof (window as any).__webBus !== 'undefined' || state.appRuntime === 'web';
  const isDesktopLike = isDesktop || isWeb;
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
  const isMarkdown = Boolean(state.currentFile && /\.mdx?$/i.test(state.currentFile));
  const editingEnabled = isMarkdownEditingAvailable(state.settings);
  const hasEditableSession = !!activeDocumentSession;

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
      if (!state.currentFile && e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const isTableCellTarget = e.target instanceof Element && Boolean(e.target.closest('.cm-table-cell'));
      const isBrowserBackFallback = !isTableCellTarget && (
        e.key === 'BrowserBack'
        || (e.altKey && e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.shiftKey)
      );
      const isBrowserForwardFallback = !isTableCellTarget && (
        e.key === 'BrowserForward'
        || (e.altKey && e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.shiftKey)
      );

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

      const isEditable = isTableCellTarget || isEditableTarget(e.target);
      if (!isEditable && getScopeNavigationStateSnapshot().active) {
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
        hasOnEditCurrentDocument: (isDesktop || state.appRuntime === 'vscode' || editingEnabled) && !!state.currentFile,
        hasOnPlainEditCurrentDocument: editingEnabled && !!state.currentFile,
        markdownEditingEnabled: editingEnabled,
        activeTab: Boolean(state.currentFile && isMarkdown),
        activeMarkdownTab: Boolean(state.currentFile && isMarkdown),
        anyModalOpen: Boolean(isTermsOpen || isModalOpen || isSettingsOpen),
        searchOpen: isSearchOpen,
        findInFileOpen: !!isFindOpen,
        hasOnSaveCurrentDocument: hasSavableDocument,
        hasOnToggleToc: !!onToggleToc,
        hasOnToggleWorkspaceInsights: !!onToggleWorkspaceInsights,
        hasOnLocateFile: !!onLocateFile,
        hasOnOpenFiles: !!onFilesOpen,
        hasOnOpenBookmarks: !!onBookmarksOpen,
        hasOnOpenCurrentDocumentLocation: !!onOpenCurrentDocumentLocation,
        hasOnToggleFocusMode: !!onToggleFocusMode,
        hasOnToggleDesktopViewMode: !!onToggleDesktopViewMode,
        activeHtmlDocument,
        onToggleActiveHtmlDocumentPreview: !!onToggleActiveHtmlDocumentPreview,
        hasOnToggleFullscreen: !!onToggleFullscreen,
        hasOnFindClose: !!onFindClose,
        isRepeat: e.repeat,
        isEditableTarget: isEditable,
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
        case 'reload-window':
          if (state.appRuntime === 'vscode') bridge.postMessage({ command: 'reloadWebview' });
          else window.location.reload();
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
          if (isMarkdown && editingEnabled && activeDocumentSession && state.currentFile) {
            const nextMode = activeDocumentSession.mode === 'inline-edit' ? 'rendered' : 'inline-edit';
            setDocumentEditMode(state.currentFile, nextMode);
            const editorT = getEditorUiTranslations(state.settings.language);
            const message = nextMode === 'inline-edit' ? editorT.inlineEdit : editorT.rendered;
            dispatchActionNotice(message, 'neutral');
          } else {
            openInEditor();
          }
          break;
        case 'plain-edit-current-document':
          if (isMarkdown && editingEnabled && activeDocumentSession && state.currentFile) {
            const nextMode = activeDocumentSession.mode === 'plain' ? 'rendered' : 'plain';
            setDocumentEditMode(state.currentFile, nextMode);
            const editorT = getEditorUiTranslations(state.settings.language);
            const message = nextMode === 'plain' ? editorT.plain : editorT.rendered;
            dispatchActionNotice(message, 'neutral');
          }
          break;
        case 'settings-toggle':
          if (isSettingsOpen) onSettingsClose();
          else onSettingsOpen();
          break;
        case 'toggle-theme':
          executeThemeTransition(toggleTheme, {
            nextTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark',
          });
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
        case 'open-files':
          onFilesOpen?.();
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
          if (!onWorkspaceSelection) guardWorkspaceLeave(() => bridge.postMessage({ command: 'closeWorkspace' }));
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
    setDocumentEditMode, editingEnabled, hasEditableSession,
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
    onFilesOpen,
    onBookmarksOpen,
    onOpenCurrentDocumentLocation,
    onToggleFocusMode,
    onToggleDesktopViewMode,
    activeHtmlDocument,
    onToggleActiveHtmlDocumentPreview,
    onToggleFullscreen,
    onWorkspaceSelection,
    guardWorkspaceLeave,
    state.activeContentTabPath,
    state.appRuntime,
    state.currentFile,
  ]);
}
