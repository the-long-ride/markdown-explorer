// =============================================================================
// App.tsx — Root component
// =============================================================================

import { useState, useCallback, useRef, lazy, Suspense, useEffect, useMemo } from 'react';
import { useAppState } from './contexts/AppStateContext';
import { usePlatform } from './contexts/PlatformContext';
import { useNavigation } from './contexts/NavigationContext';
import { getTranslations } from './contexts/translations';
import { TERMS_ACCEPTED_STORAGE_KEY, THEME_ONBOARDING_COMPLETE_STORAGE_KEY, USER_TOUR_COMPLETE_STORAGE_KEY } from './constants/storage';
import { requestStartUserTour } from './components/Tour/tourEvents';
import { executeThemeTransition } from './utils/themeTransition';

const TermsModal = lazy(() => import('./components/Modal/TermsModal').then(m => ({ default: m.TermsModal })));
import { TooltipButton } from './components/shared/TooltipButton';
import type { PendingSearchJump, SearchScope } from './desktop/types';
// Defer global DOM handlers until after mount
import { initGlobalHandlers } from './dom/globalHandlers';
import { useDesktopTabs } from './hooks/useDesktopTabs';
import { useDirtyDocumentsGuard, useRequestWindowClose } from './hooks/useDirtyDocumentsGuard';
import { useFileDropOpen } from './hooks/useFileDropOpen';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { formatShortcutLabel, getEnabledShortcut } from './utils/shortcuts';
import { AppView } from './AppView';
import { useAppSearchEffects } from './useAppSearchEffects';
import { useAppLayoutEffects } from './useAppLayoutEffects';
import { useAppUpdateActions } from './useAppUpdateActions';
import { createMediaGallery, type MediaGallery } from './components/Modal/mediaGallery';
import { useBookmarkNavigation } from './hooks/useBookmarkNavigation';
import { useUserManualActions } from './hooks/useUserManualActions';
import { useUpdateNotificationState } from './hooks/useUpdateNotificationState';

export function App() {
  // AppView owns the root class: state.appRuntime === 'tauri' ? ' app--tauri' : ''.
  const { state, toggleTheme, toggleSidebar, toggleToc, toggleFocusMode, toggleDesktopViewMode, setContentTabHtmlPreview, dispatch, navigate, refresh } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const activeHtmlTab = state.contentTabs.find((tab) => tab.filePath === state.activeContentTabPath);
  const activeHtmlDocument = /\.html?$/i.test(state.currentFile || '') && Boolean(activeHtmlTab || state.sourceDocumentText !== null);
  const handleToggleActiveHtmlDocumentPreview = useCallback(() => {
    if (!activeHtmlDocument || !state.currentFile) return;
    const currentEnabled = activeHtmlTab?.htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
    setContentTabHtmlPreview(state.currentFile, !currentEnabled);
    window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', {
      detail: currentEnabled ? t.htmlPreviewDisabled : t.htmlPreviewEnabled,
    }));
  }, [activeHtmlDocument, activeHtmlTab?.htmlPreviewOverride, setContentTabHtmlPreview, state.currentFile, state.settings.defaultHtmlPreview, t.htmlPreviewDisabled, t.htmlPreviewEnabled]);

  const bridge = usePlatform();
  const requestWindowClose = useRequestWindowClose();
  const guardWorkspaceLeave = useDirtyDocumentsGuard();
  const {
    back,
    forward,
    canGoBack,
    canGoForward,
    setScope: setNavigationScope,
  } = useNavigation();
  const [searchOpen, setSearchOpen] = useState(false); const [searchScope, setSearchScope] = useState<SearchScope>('current');
  const [findOpen, setFindOpen] = useState(false); const [pendingSearchJump, setPendingSearchJump] = useState<PendingSearchJump | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false); const [isFullscreen, setIsFullscreen] = useState(false);
  const [workspaceSelectionConfirmOpen, setWorkspaceSelectionConfirmOpen] = useState(false); const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);
  const modalOpen = mediaGallery !== null;
  const [sidebarCursorMode, setSidebarCursorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const isWeb = typeof (window as any).__webBus !== 'undefined';
  const isWebFileMode = isWeb && new URLSearchParams(window.location.search).get('mode')?.toLowerCase() !== 'test';
  const isDesktopLike = isDesktop;
  const isTabView = (isDesktop || isWeb) && state.settings.desktopViewMode === 'tabs';
  const updateCheck = useUpdateCheck({
    currentVersion: state.appVersion,
    runtime: state.appRuntime,
    hostPlatform: state.hostPlatform,
    hostArch: state.hostArch,
    delayMs: 800,
  });
  const currentSearchShortcutLabel = formatShortcutLabel(isDesktopLike ? getEnabledShortcut(state.settings, 'searchCurrent') ?? '' : 'Ctrl+K');
  const allTabsSearchShortcutLabel = formatShortcutLabel(getEnabledShortcut(state.settings, 'searchAllTabs') ?? '');
  const findShortcutLabel = formatShortcutLabel(getEnabledShortcut(state.settings, 'findCurrentFile') ?? (isDesktopLike ? '' : 'K'));
  const isDark = state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const {
    activeTabId, tabs, workspaceAliases, activateTab, createNewWorkspaceTab,
    prepareWorkspaceOpen, reopenUnavailableWorkspace, openDroppedPath,
    pendingDroppedPath, setPendingDroppedPath, confirmSwitchWorkspace,
    closeTab, reorderTabs, closeTabsToRight, closeOtherTabs, closeAllTabs,
    cancelCurrentWorkspaceScan, updateTabAlias, updateWorkspaceAlias,
    crossTabSearchItems, isIndexingAcrossTabs,
  } = useDesktopTabs({ state, dispatch, bridge, isDesktop: isDesktop || isWebFileMode, isTabView, setNavigationScope, guardWorkspaceLeave });
  const openDroppedWebFiles = useCallback((files: File[]) => {
    guardWorkspaceLeave(async () => {
      const operation = prepareWorkspaceOpen();
      const filePayloads = await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.text() })));
      (bridge as any).postMessage({ command: 'openDroppedFiles', files: filePayloads, ...operation });
    });
  }, [bridge, guardWorkspaceLeave, prepareWorkspaceOpen]);

  const { isDragging } = useFileDropOpen({
    isDesktop, isWeb: isWebFileMode, modalOpen, openDroppedPath,
    openDroppedFolder: useCallback((handle: any) => {
      guardWorkspaceLeave(() => {
        const operation = prepareWorkspaceOpen();
        bridge.postMessage({ command: 'openFolder', handle, openFirstFile: true, ...operation });
      });
    }, [bridge, guardWorkspaceLeave, prepareWorkspaceOpen]),
    openDroppedFileHandle: useCallback((handle: any) => {
      guardWorkspaceLeave(() => {
        const operation = prepareWorkspaceOpen();
        bridge.postMessage({ command: 'openFileHandle', handle, ...operation });
      });
    }, [bridge, guardWorkspaceLeave, prepareWorkspaceOpen]),
    openDroppedWebFiles,
  });
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
    queueBookmarkJump,
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

  const openWorkspaceTabs = useMemo(() => tabs.filter((tab) => tab.kind === 'workspace'), [tabs]);
  const canOpenAllWorkspacesSearch = isDesktop && isTabView && openWorkspaceTabs.length >= 2;
  const canUseCrossTabSearch = canOpenAllWorkspacesSearch || Boolean(state.workspaceName) || openWorkspaceTabs.length === 1;

  const openSearch = useCallback((scope: SearchScope = 'current') => {
    if (scope === 'all-tabs' && !canOpenAllWorkspacesSearch) {
      if (isTabView && openWorkspaceTabs.length === 1 && activeTabId !== openWorkspaceTabs[0].id) {
        activateTab(openWorkspaceTabs[0].id);
      }
      if (state.workspaceName || openWorkspaceTabs.length === 1) {
        openSidebarSearch();
      }
      return;
    }
    setSearchScope(scope);
    setFindOpen(false);
    setSearchOpen(true);
  }, [activateTab, activeTabId, canOpenAllWorkspacesSearch, isTabView, openSidebarSearch, openWorkspaceTabs, state.workspaceName]);

  useEffect(() => {
    if (searchOpen && searchScope === 'all-tabs' && !canOpenAllWorkspacesSearch) {
      setSearchOpen(false);
    }
  }, [canOpenAllWorkspacesSearch, searchOpen, searchScope]);

  const { activeBookmarkWorkspaceKey, bookmarkWorkspaces, handleBookmarkNavigate } = useBookmarkNavigation({
    state,
    tabs,
    isTabView,
    translations: t.bookmarks,
    activateTab,
    navigate,
    queueBookmarkJump,
  });

  const [termsAccepted, setTermsAccepted] = useState(() => {
    if (!isDesktopLike) return true;
    return localStorage.getItem(TERMS_ACCEPTED_STORAGE_KEY) === 'true';
  });
  const [themeOnboardingComplete, setThemeOnboardingComplete] = useState(() => {
    try {
      return localStorage.getItem(THEME_ONBOARDING_COMPLETE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleAgreeTerms = useCallback(() => {
    localStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, 'true');
    setTermsAccepted(true);
  }, []);

  const handleThemeOnboardingComplete = useCallback(() => {
    let shouldStartTour = false;
    try {
      localStorage.setItem(THEME_ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
      shouldStartTour = localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY) !== 'true';
    } catch {
      // Ignore storage failures; the user can still continue.
    }
    setThemeOnboardingComplete(true);
    if (shouldStartTour) {
      window.setTimeout(() => requestStartUserTour(), 120);
    }
  }, []);

  const { openExternalUrl, downloadUpdate, scheduleUpdateOnExit, restartAndApplyUpdate, openUpdateChangelog } = useAppUpdateActions({
    bridge,
    canInstallUpdates: state.canInstallUpdates,
    canInstallUpdate: updateCheck.canInstallUpdate,
    downloadUrl: updateCheck.downloadUrl,
    latestVersion: updateCheck.latestVersion,
    changelogUrl: updateCheck.changelogUrl,
  });

  const updateNotification = useUpdateNotificationState(updateCheck, downloadUpdate, {
    enabled: termsAccepted && !isWeb,
  });

  const [initialUpdateSettled, setInitialUpdateSettled] = useState(
    () => updateCheck.status !== 'checking',
  );

  useEffect(() => {
    if (updateCheck.status !== 'checking') {
      setInitialUpdateSettled(true);
    }
  }, [updateCheck.status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialUpdateSettled(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!termsAccepted || !themeOnboardingComplete) return;
    let shouldStartTour = false;
    try {
      shouldStartTour = localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY) !== 'true';
    } catch {
      shouldStartTour = false;
    }
    if (shouldStartTour) {
      const timer = setTimeout(() => {
        requestStartUserTour();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [termsAccepted, themeOnboardingComplete]);

  const {
    themeOnboardingOpen, closeWorkspaceToSelection, closeSidebarCursorMode,
    expandAll, collapseAll, openSidebarBookmarks, copyCurrentFileContent,
  } = useAppLayoutEffects({
    state, bridge, dispatch, termsAccepted, themeOnboardingComplete,
    updatePromptOpen: updateNotification.promptOpen, setSidebarCursorMode,
    sidebarCursorMode, searchOpen, findOpen, settingsOpen, modalOpen, toggleSidebar,
    isTabView, createNewWorkspaceTab, setWorkspaceSelectionConfirmOpen,
    openSidebarSearch, openSearch, closeSearch, canUseCrossTabSearch, openFind, closeFind,
    setSettingsOpen, activateTab, searchScope, toggleToc, toggleFocusMode,
    toggleDesktopViewMode, activeHtmlDocument,
    onToggleActiveHtmlDocumentPreview: handleToggleActiveHtmlDocumentPreview,
    toggleFullscreen,
  });

  useUserManualActions({
    isTabView, createNewWorkspaceTab, closeWorkspaceToSelection,
    openSidebarSearch, openSidebarBookmarks, openSettings: useCallback(() => setSettingsOpen(true), []),
  });

  const isAllTabsSearch = canOpenAllWorkspacesSearch && searchScope === 'all-tabs';

  // Image click → open media modal
  const onImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
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
                onClick={(e) => executeThemeTransition(toggleTheme, { originElement: e.currentTarget, event: e, nextTheme: isDark ? 'light' : 'dark' })}
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
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M8 8V3h13v13h-5" /><path d="M3 8h13v13H3z" /></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn window-control-btn--close"
                onClick={requestWindowClose}
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
      <main className="tab-loading tab-loading--fullscreen">
        <div className="state-screen state-screen--initial-loading">
          <div className="spinner" />
          <div className="state-screen__title">
            {state.loadingLabel || t.ui.loadingDocs}
          </div>
          {state.isWorkspaceScanning && (
            <div className="state-screen__sub">
              {t.ui.scanningFiles.replace('{count}', state.scannedFiles.toLocaleString(currentLang))}
            </div>
          )}
          {state.loadingDetail && (
            <div className="state-screen__sub">{state.loadingDetail}</div>
          )}
        </div>
      </main>
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
      bookmarkWorkspaces={bookmarkWorkspaces}
      activeBookmarkWorkspaceKey={activeBookmarkWorkspaceKey}
      handleBookmarkNavigate={handleBookmarkNavigate}
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
      updateNotification={updateNotification}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      prepareWorkspaceOpen={prepareWorkspaceOpen}
      reopenUnavailableWorkspace={reopenUnavailableWorkspace}
      workspaceAliases={workspaceAliases}
      updateWorkspaceAlias={updateWorkspaceAlias}
      scrollRef={scrollRef}
      t={t}
      expandAll={expandAll} collapseAll={collapseAll}
      copyCurrentFileContent={copyCurrentFileContent} refresh={refresh}
      back={back} forward={forward} canGoBack={canGoBack} canGoForward={canGoForward}
      currentFile={state.currentFile}
      searchOpen={searchOpen} closeSearch={closeSearch} searchScope={searchScope}
      isAllTabsSearch={isAllTabsSearch} allTabsSearchShortcutLabel={allTabsSearchShortcutLabel}
      currentSearchShortcutLabel={currentSearchShortcutLabel} crossTabSearchItems={crossTabSearchItems}
      handleWorkspaceSearchSelect={handleWorkspaceSearchSelect} handleCrossTabSelect={handleCrossTabSelect}
      isIndexingAcrossTabs={isIndexingAcrossTabs} findOpen={findOpen} closeFind={closeFind} findShortcutLabel={findShortcutLabel}
      mediaGallery={mediaGallery} setMediaGallery={setMediaGallery} settingsOpen={settingsOpen}
      downloadUpdate={downloadUpdate} scheduleUpdateOnExit={scheduleUpdateOnExit}
      restartAndApplyUpdate={restartAndApplyUpdate} openUpdateChangelog={openUpdateChangelog}
      themeOnboardingOpen={themeOnboardingOpen} handleThemeOnboardingComplete={handleThemeOnboardingComplete}
      termsAccepted={termsAccepted} initialUpdateSettled={initialUpdateSettled}
      pendingDroppedPath={pendingDroppedPath} setPendingDroppedPath={setPendingDroppedPath} confirmSwitchWorkspace={confirmSwitchWorkspace}
      workspaceSelectionConfirmOpen={workspaceSelectionConfirmOpen} setWorkspaceSelectionConfirmOpen={setWorkspaceSelectionConfirmOpen}
      closeWorkspaceToSelection={closeWorkspaceToSelection}
      focusMode={state.focusMode} toggleFocusMode={toggleFocusMode}
      isDragging={isDragging} onImageClick={onImageClick} onOpenExternal={openExternalUrl}
    />
  );
}

initGlobalHandlers();
