import { useCallback, useEffect } from "react";
import { SIDEBAR_WIDTH_STORAGE_KEY, TOC_WIDTH_STORAGE_KEY } from './constants/storage';
import { useKeyboard } from "./hooks/useKeyboard";
import { useResize } from "./hooks/useResize";
import { requestShellLocation, supportsShellLocation } from "./desktop/shellLocation";
import { collapseAll as collapseAllHeadingSections, expandAll as expandAllHeadingSections } from './dom/globalHandlers';

interface AppLayoutEffectsArgs {
  state: any;
  bridge: any;
  dispatch: (action: any) => void;
  termsAccepted: boolean;
  themeOnboardingComplete: boolean;
  setSidebarCursorMode: (value: boolean) => void;
  sidebarCursorMode: boolean;
  searchOpen: boolean;
  findOpen: boolean;
  settingsOpen: boolean;
  modalOpen: boolean;
  toggleSidebar: () => void;
  isTabView: boolean;
  createNewWorkspaceTab: () => void;
  setWorkspaceSelectionConfirmOpen: (value: boolean) => void;
  openSidebarSearch: () => void;
  openSearch: (scope?: any) => void;
  closeSearch: () => void;
  openFind: () => void;
  closeFind: () => void;
  setSettingsOpen: (value: boolean) => void;
  activateTab: (tabId: string) => void;
  searchScope: any;
  toggleToc: () => void;
  toggleFocusMode: () => void;
  toggleDesktopViewMode: () => void;
  activeHtmlDocument: boolean;
  onToggleActiveHtmlDocumentPreview: () => void;
  toggleFullscreen: () => void;
}

export function useAppLayoutEffects({
  state,
  bridge,
  dispatch,
  termsAccepted,
  themeOnboardingComplete,
  setSidebarCursorMode,
  sidebarCursorMode,
  searchOpen,
  findOpen,
  settingsOpen,
  modalOpen,
  toggleSidebar,
  isTabView,
  createNewWorkspaceTab,
  setWorkspaceSelectionConfirmOpen,
  openSidebarSearch,
  openSearch,
  closeSearch,
  openFind,
  closeFind,
  setSettingsOpen,
  activateTab,
  searchScope,
  toggleToc,
  toggleFocusMode,
  toggleDesktopViewMode,
  activeHtmlDocument,
  onToggleActiveHtmlDocumentPreview,
  toggleFullscreen,
}: AppLayoutEffectsArgs) {
  const themeOnboardingOpen = termsAccepted && !themeOnboardingComplete;

  const closeSidebarCursorMode = useCallback(() => {
    setSidebarCursorMode(false);
  }, []);

  const toggleSidebarCursorMode = useCallback(() => {
    if (
      !state.workspaceName ||
      searchOpen ||
      findOpen ||
      settingsOpen ||
      modalOpen ||
      !termsAccepted ||
      themeOnboardingOpen
    ) {
      return;
    }
    if (sidebarCursorMode) {
      setSidebarCursorMode(false);
      return;
    }
    if (state.sidebarCollapsed) {
      toggleSidebar();
    }
    setSidebarCursorMode(true);
  }, [
    findOpen,
    modalOpen,
    searchOpen,
    settingsOpen,
    sidebarCursorMode,
    state.sidebarCollapsed,
    state.workspaceName,
    termsAccepted,
    themeOnboardingOpen,
    toggleSidebar,
  ]);

  useEffect(() => {
    if (
      !state.workspaceName ||
      state.sidebarCollapsed ||
      searchOpen ||
      findOpen ||
      settingsOpen ||
      modalOpen ||
      !termsAccepted ||
      themeOnboardingOpen
    ) {
      setSidebarCursorMode(false);
    }
  }, [
    findOpen,
    modalOpen,
    searchOpen,
    settingsOpen,
    state.sidebarCollapsed,
    state.workspaceName,
    termsAccepted,
    themeOnboardingOpen,
  ]);

  // Initialize sidebar width from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (stored) {
      document.documentElement.style.setProperty('--sidebar-width', `${stored}px`);
    }
  }, []);

  // Initialize TOC width from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TOC_WIDTH_STORAGE_KEY);
    if (stored) {
      document.documentElement.style.setProperty('--toc-width', `${stored}px`);
    }
  }, []);

  // Sidebar resize handle
  useResize('sidebarResize', 'sidebar', state.workspaceName, {
    min: 245,
    mode: 'synchronized',
    freezeContentId: 'sidebarTree',
  });

  // Table of contents resize handle
  useResize('tocResize', 'tocPanel', `${state.workspaceName}:${state.toc.length}`, {
    min: 180,
    max: 360,
    cssVar: '--toc-width',
    storageKey: TOC_WIDTH_STORAGE_KEY,
    direction: 'rtl',
  });

  // Expand / Collapse all sections
  const expandAll = useCallback(() => {
    expandAllHeadingSections();
  }, []);

  const collapseAll = useCallback(() => {
    collapseAllHeadingSections();
  }, []);

  const closeWorkspaceToSelection = useCallback(() => {
    dispatch({
      type: 'READY_ACK',
      fileList: [],
      tree: null,
      theme: state.theme,
      themeStyle: state.themeStyle,
      defaultExpanded: state.defaultExpanded,
      workspaceName: '',
      recentWorkspaces: state.recentWorkspaces,
    });
    bridge.postMessage({ command: 'closeWorkspace' });
  }, [bridge, dispatch, state.defaultExpanded, state.recentWorkspaces, state.theme, state.themeStyle]);

  const requestWorkspaceSelection = useCallback(() => {
    if (isTabView) {
      createNewWorkspaceTab();
      return;
    }
    if (!isTabView && state.workspaceName) {
      setWorkspaceSelectionConfirmOpen(true);
      return;
    }
    closeWorkspaceToSelection();
  }, [closeWorkspaceToSelection, createNewWorkspaceTab, isTabView, state.workspaceName]);

  const copyCurrentFileContent = useCallback((button?: HTMLElement | null) => {
    if (state.currentFile && state.markdownSource !== null) {
      bridge.copyToClipboard(state.markdownSource);
      (window as any).UI?.markCopyButtonCopied?.(button, 'Copy file content');
      return;
    }

    if (!state.currentFile) {
      (window as any).UI?.copyDocument?.(button);
    }
  }, [bridge, state.currentFile, state.markdownSource]);

  // Keyboard shortcuts
  useKeyboard({
    onSearchOpen: openSidebarSearch,
    onCrossTabSearchOpen: isTabView ? () => openSearch('all-tabs') : undefined,
    onSearchClose: closeSearch,
    onFindOpen: openFind,
    onFindClose: closeFind,
    onSettingsOpen: () => setSettingsOpen(true),
    onSettingsClose: () => setSettingsOpen(false),
    onWelcome: isTabView ? () => activateTab('home') : undefined,
    onExpandAll: expandAll,
    onCollapseAll: collapseAll,
    onSidebarCursorModeToggle: toggleSidebarCursorMode,
    onSidebarCursorModeClose: closeSidebarCursorMode,
    isSearchOpen: searchOpen,
    isFindOpen: findOpen,
    activeSearchScope: searchScope,
    isSidebarCursorMode: sidebarCursorMode,
    isSettingsOpen: settingsOpen,
    isModalOpen: modalOpen,
    isTermsOpen: !termsAccepted || themeOnboardingOpen,
    onToggleToc: toggleToc,
    onLocateFile: () => {
      window.dispatchEvent(new CustomEvent('locate-active-file'));
    },
    onOpenCurrentDocumentLocation: supportsShellLocation(state.appRuntime) && state.currentFile
      ? () => requestShellLocation(bridge, state.currentFile, 'open-parent-directory')
      : undefined,
    onToggleFocusMode: toggleFocusMode,
    onToggleDesktopViewMode: toggleDesktopViewMode,
    activeHtmlDocument,
    onToggleActiveHtmlDocumentPreview,
    onToggleFullscreen: toggleFullscreen,
    onWorkspaceSelection: requestWorkspaceSelection,
  });

  return {
    themeOnboardingOpen,
    closeWorkspaceToSelection,
    closeSidebarCursorMode,
    toggleSidebarCursorMode,
    expandAll,
    collapseAll,
    requestWorkspaceSelection,
    copyCurrentFileContent,
  };
}
