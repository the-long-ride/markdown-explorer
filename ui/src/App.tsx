// =============================================================================
// App.tsx — Root component
// =============================================================================

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useAppState } from './contexts/AppStateContext';
import { usePlatform } from './contexts/PlatformContext';
import { useNavigation } from './contexts/NavigationContext';
import { getTranslations } from './contexts/translations';

const TermsModal = lazy(() => import('./components/Modal/TermsModal').then(m => ({ default: m.TermsModal })));
import { TooltipButton } from './components/shared/TooltipButton';
import type { PendingSearchJump, SearchScope } from './desktop/types';
// Defer global DOM handlers until after mount
import { initGlobalHandlers } from './dom/globalHandlers';
import { useDesktopTabs } from './hooks/useDesktopTabs';
import { useFileDropOpen } from './hooks/useFileDropOpen';
import { useScrollVisibility } from './hooks/useScrollVisibility';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { formatShortcutLabel, getEnabledShortcut } from './utils/shortcuts';
import { AppView } from './AppView';
import { useAppSearchEffects } from './useAppSearchEffects';
import { useAppLayoutEffects } from './useAppLayoutEffects';

export function App() {
  // AppView owns the root class: state.appRuntime === 'tauri' ? ' app--tauri' : ''.
  // Register global DOM handlers after first paint (not needed for initial render)
  useEffect(() => { initGlobalHandlers(); }, []);
  const { state, toggleTheme, toggleSidebar, toggleToc, toggleFocusMode, toggleDesktopViewMode, dispatch, navigate, refresh } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const bridge = usePlatform();
  const {
    back,
    forward,
    canGoBack,
    canGoForward,
    setScope: setNavigationScope,
  } = useNavigation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('current');
  const [findOpen, setFindOpen] = useState(false);
  const [pendingSearchJump, setPendingSearchJump] = useState<PendingSearchJump | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [workspaceSelectionConfirmOpen, setWorkspaceSelectionConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<HTMLElement | null>(null);
  const [sidebarCursorMode, setSidebarCursorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isWebFileMode = typeof (window as any).__webDemoBus !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'file';
  const isDesktopLike = isDesktop || isChrome;
  const isTabView = isDesktop && state.settings.desktopViewMode === 'tabs';
  const updateCheck = useUpdateCheck({
    currentVersion: state.appVersion,
    runtime: state.appRuntime,
    hostPlatform: state.hostPlatform,
    hostArch: state.hostArch,
  });
  const currentSearchShortcutLabel = formatShortcutLabel(
    isDesktopLike ? getEnabledShortcut(state.settings, 'searchCurrent') ?? '' : 'Ctrl+K',
  );
  const allTabsSearchShortcutLabel = formatShortcutLabel(
    getEnabledShortcut(state.settings, 'searchAllTabs') ?? '',
  );
  const findShortcutLabel = formatShortcutLabel(
    getEnabledShortcut(state.settings, 'findCurrentFile') ?? (isDesktopLike ? '' : 'K'),
  );
  const { isVisible: scrollTopVisible, scrollToTop } = useScrollVisibility(
    scrollRef,
    200,
    state.workspaceName,
  );
  const isDark =
    state.theme === 'dark' ||
    (state.theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const {
    activeTabId,
    tabs,
    workspaceAliases,
    toolbarPosition,
    setToolbarPosition,
    activateTab,
    createNewWorkspaceTab,
    prepareWorkspaceOpen,
    openDroppedPath,
    pendingDroppedPath,
    setPendingDroppedPath,
    confirmSwitchWorkspace,
    closeTab,
    reorderTabs,
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    cancelCurrentWorkspaceScan,
    updateTabAlias,
    updateWorkspaceAlias,
    crossTabSearchItems,
    isIndexingAcrossTabs,
  } = useDesktopTabs({
    state,
    dispatch,
    bridge,
    isDesktop,
    isTabView,
    setNavigationScope,
  });
  const { isDragging } = useFileDropOpen({
    isDesktop,
    isChrome,
    isWebDemo: isWebFileMode,
    modalOpen,
    openDroppedPath,
    openDroppedFolder: useCallback((handle: any) => {
      const operation = prepareWorkspaceOpen();
      bridge.postMessage({ command: 'openFolder', handle, openFirstFile: true, ...operation });
    }, [bridge, prepareWorkspaceOpen]),
    openDroppedFileHandle: useCallback((handle: any) => {
      const operation = prepareWorkspaceOpen();
      bridge.postMessage({ command: 'openFileHandle', handle, ...operation });
    }, [bridge, prepareWorkspaceOpen]),
  });
  const openSearch = useCallback((scope: SearchScope = 'current') => {
    setSearchScope(scope);
    setFindOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const openFind = useCallback(() => {
    if (!state.currentFile) return;
    setSearchOpen(false);
    setFindOpen(true);
  }, [state.currentFile]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
  }, []);

  const {
    toggleFullscreen,
    openSidebarSearch,
    handleWorkspaceSearchSelect,
    handleCrossTabSelect,
  } = useAppSearchEffects({
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
  });

  const [termsAccepted, setTermsAccepted] = useState(() => {
    if (!isDesktopLike) return true;
    return localStorage.getItem('markdown-explorer-terms-accepted') === 'true';
  });
  const [themeOnboardingComplete, setThemeOnboardingComplete] = useState(() => {
    try {
      return localStorage.getItem('markdown-explorer-theme-onboarding-complete') === 'true';
    } catch {
      return false;
    }
  });

  const handleAgreeTerms = useCallback(() => {
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    setTermsAccepted(true);
  }, []);

  const handleThemeOnboardingComplete = useCallback(() => {
    try {
      localStorage.setItem('markdown-explorer-theme-onboarding-complete', 'true');
    } catch {
      // Ignore storage failures; the user can still continue.
    }
    setThemeOnboardingComplete(true);
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    if (!url) return;
    bridge.postMessage({ command: 'openExternal', url });
  }, [bridge]);

  const downloadUpdate = useCallback(() => {
    if (state.canInstallUpdates && updateCheck.canInstallUpdate && updateCheck.downloadUrl) {
      bridge.postMessage({
        command: 'downloadUpdate',
        version: updateCheck.latestVersion,
        url: updateCheck.downloadUrl,
      });
      return;
    }
    openExternalUrl(updateCheck.downloadUrl);
  }, [
    bridge,
    openExternalUrl,
    state.canInstallUpdates,
    updateCheck.canInstallUpdate,
    updateCheck.downloadUrl,
    updateCheck.latestVersion,
  ]);

  const scheduleUpdateOnExit = useCallback(() => {
    if (!state.canInstallUpdates) return;
    bridge.postMessage({ command: 'scheduleDownloadedUpdate' });
  }, [bridge, state.canInstallUpdates]);

  const restartAndApplyUpdate = useCallback(() => {
    if (!state.canInstallUpdates) return;
    bridge.postMessage({ command: 'restartAndApplyUpdate' });
  }, [bridge, state.canInstallUpdates]);

  const openUpdateChangelog = useCallback(() => {
    openExternalUrl(updateCheck.changelogUrl);
  }, [openExternalUrl, updateCheck.changelogUrl]);

  const {
    themeOnboardingOpen,
    closeWorkspaceToSelection,
    closeSidebarCursorMode,
    expandAll,
    collapseAll,
    copyCurrentFileContent,
  } = useAppLayoutEffects({
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
    toggleFullscreen,
  });

  const isAllTabsSearch = isTabView && searchScope === 'all-tabs';

  // Image click → open media modal
  const onImageClick = useCallback((el: HTMLElement) => {
    setModalTarget(el);
    setModalOpen(true);
  }, []);

  if (!termsAccepted && isDesktopLike) {
    return (
      <div className="app app--terms-gate">
        {/* Custom top bar for window dragging & controls */}
        <div className="app--terms-gate__dragbar">
          {isDesktop && (
            <div className="window-controls">
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={toggleTheme}
                tooltip={isDark ? t.topbar.switchToLightMode : t.topbar.switchToDarkMode}
                shortcut={getEnabledShortcut(state.settings, 'toggleTheme')}
                icon={
                  state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  )
                }
              />
              <div className="app--terms-gate__divider" />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => bridge.postMessage({ command: 'window-minimize' })}
                tooltip={t.tooltips.minimize}
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => bridge.postMessage({ command: 'window-maximize' })}
                tooltip={state.isMaximized ? t.tooltips.restore : t.tooltips.maximize}
                icon={state.isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M8 8V3h13v13h-5" />
                    <path d="M3 8h13v13H3z" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn window-control-btn--close"
                onClick={() => bridge.postMessage({ command: 'window-close' })}
                tooltip={t.tooltips.closeApp}
                tooltipAlign="right"
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              />
            </div>
          )}
        </div>
        <Suspense fallback={null}><TermsModal
          isOpen={true}
          onAgree={handleAgreeTerms}
          onOpenExternal={openExternalUrl}
        /></Suspense>
      </div>
    );
  }

  if (!isTabView && (state.isLoading || state.isWorkspaceScanning) && !state.workspaceName) {
    return (
      <div className="state-screen state-screen--initial-loading">
        <div className="spinner" />
        <div className="state-screen__title">
          {state.loadingLabel || 'Loading docs...'}
        </div>
        {state.isWorkspaceScanning && (
          <div className="state-screen__sub">
            Scanning {state.scannedFiles.toLocaleString()} files…
          </div>
        )}
        {state.loadingDetail && (
          <div className="state-screen__sub">{state.loadingDetail}</div>
        )}
      </div>
    );
  }

  return (
    <AppView
      isTabView={isTabView}
       sidebarCursorMode={sidebarCursorMode}
       closeSidebarCursorMode={closeSidebarCursorMode}
      state={state}
      activeTabId={activeTabId}
      tabs={tabs}
      activateTab={activateTab}
      createNewWorkspaceTab={createNewWorkspaceTab}
      closeTab={closeTab}
      reorderTabs={reorderTabs}
      closeTabsToRight={closeTabsToRight}
      closeOtherTabs={closeOtherTabs}
      closeAllTabs={closeAllTabs}
      cancelCurrentWorkspaceScan={cancelCurrentWorkspaceScan}
      updateTabAlias={updateTabAlias}
      toggleTheme={toggleTheme}
      setSettingsOpen={setSettingsOpen}
      toggleSidebar={toggleSidebar}
      isDark={isDark}
      updateCheck={updateCheck}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      prepareWorkspaceOpen={prepareWorkspaceOpen}
      workspaceAliases={workspaceAliases}
      updateWorkspaceAlias={updateWorkspaceAlias}
      scrollRef={scrollRef}
      scrollTopVisible={scrollTopVisible}
      scrollToTop={scrollToTop}
      t={t}
      expandAll={expandAll}
      collapseAll={collapseAll}
      copyCurrentFileContent={copyCurrentFileContent}
      refresh={refresh}
      back={back}
      forward={forward}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
       currentFile={state.currentFile}
      searchOpen={searchOpen}
      closeSearch={closeSearch}
      searchScope={searchScope}
      isAllTabsSearch={isAllTabsSearch}
      allTabsSearchShortcutLabel={allTabsSearchShortcutLabel}
      currentSearchShortcutLabel={currentSearchShortcutLabel}
      crossTabSearchItems={crossTabSearchItems}
      handleWorkspaceSearchSelect={handleWorkspaceSearchSelect}
      handleCrossTabSelect={handleCrossTabSelect}
      isIndexingAcrossTabs={isIndexingAcrossTabs}
      findOpen={findOpen}
      closeFind={closeFind}
      findShortcutLabel={findShortcutLabel}
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      modalTarget={modalTarget}
      setModalTarget={setModalTarget}
      settingsOpen={settingsOpen}
      downloadUpdate={downloadUpdate}
      scheduleUpdateOnExit={scheduleUpdateOnExit}
      restartAndApplyUpdate={restartAndApplyUpdate}
      openUpdateChangelog={openUpdateChangelog}
      themeOnboardingOpen={themeOnboardingOpen}
      handleThemeOnboardingComplete={handleThemeOnboardingComplete}
      pendingDroppedPath={pendingDroppedPath}
      setPendingDroppedPath={setPendingDroppedPath}
      confirmSwitchWorkspace={confirmSwitchWorkspace}
      workspaceSelectionConfirmOpen={workspaceSelectionConfirmOpen}
      setWorkspaceSelectionConfirmOpen={setWorkspaceSelectionConfirmOpen}
      closeWorkspaceToSelection={closeWorkspaceToSelection}
       focusMode={state.focusMode}
      toggleFocusMode={toggleFocusMode}
      isDragging={isDragging}
      toolbarPosition={toolbarPosition}
      setToolbarPosition={setToolbarPosition}
      onImageClick={onImageClick}
    />
  );
}

initGlobalHandlers();



