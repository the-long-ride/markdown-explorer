// =============================================================================
// App.tsx — Root component
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from './contexts/AppStateContext';
import { usePlatform } from './contexts/PlatformContext';
import { useNavigation } from './contexts/NavigationContext';
import { getTranslations } from './contexts/translations';
import { WorkspaceSelection } from './components/Workspace/WorkspaceSelection';
import { Topbar } from './components/Topbar/Topbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Content } from './components/Content/Content';
import { ContentTabs } from './components/Content/ContentTabs';
import { WelcomePage } from './components/Content/WelcomePage';
import { TableOfContents } from './components/TOC/TableOfContents';
import { SearchOverlay } from './components/Search/SearchOverlay';
import { FindInFilePanel } from './components/Search/FindInFilePanel';
import { MediaModal } from './components/Modal/MediaModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { TermsModal } from './components/Modal/TermsModal';
import { ThemeOnboardingModal } from './components/Modal/ThemeOnboardingModal';
import { SwitchWorkspaceModal } from './components/Modal/SwitchWorkspaceModal';
import { TooltipButton } from './components/shared/TooltipButton';
import { DesktopTabBar } from './components/Desktop/DesktopTabBar';
import { FloatingTabToolbar } from './components/Desktop/FloatingTabToolbar';
import { ChevronUpIcon, DoubleChevronLeftIcon, ExpandIcon, CollapseIcon, MaximizeIcon, MinimizeIcon } from './components/shared/icons';
import type { PendingSearchJump, SearchScope } from './desktop/types';
import { initGlobalHandlers } from './dom/globalHandlers';
import { useDesktopTabs } from './hooks/useDesktopTabs';
import { useFileDropOpen } from './hooks/useFileDropOpen';
import { useKeyboard } from './hooks/useKeyboard';
import { useResize } from './hooks/useResize';
import { useScrollVisibility } from './hooks/useScrollVisibility';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { formatShortcutLabel } from './utils/shortcuts';
import { clearSearchJumpMarks, scrollToRenderedSearchMatch } from './utils/searchJump';

export function App() {
  const { state, toggleTheme, toggleSidebar, toggleToc, toggleFocusMode, dispatch, navigate, refresh, openInEditor } = useAppState();
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<HTMLElement | null>(null);
  const [sidebarCursorMode, setSidebarCursorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isElectron || isChrome;
  const isTabView = isElectron && state.settings.desktopViewMode === 'tabs';
  const updateCheck = useUpdateCheck({
    currentVersion: state.appVersion,
    runtime: state.appRuntime,
    hostPlatform: state.hostPlatform,
    hostArch: state.hostArch,
  });
  const currentSearchShortcutLabel = formatShortcutLabel(
    isDesktopLike ? state.settings.keybindings?.searchCurrent ?? 'Ctrl+F' : 'Ctrl+K',
  );
  const allTabsSearchShortcutLabel = formatShortcutLabel(
    state.settings.keybindings?.searchAllTabs ?? 'Ctrl+Shift+F',
  );
  const findShortcutLabel = formatShortcutLabel(
    state.settings.keybindings?.findCurrentFile ?? (isDesktopLike ? 'F' : 'K'),
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
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    updateTabAlias,
    crossTabSearchItems,
  } = useDesktopTabs({
    state,
    dispatch,
    bridge,
    isElectron,
    isTabView,
    setNavigationScope,
  });
  const { isDragging } = useFileDropOpen({
    isElectron,
    isChrome,
    modalOpen,
    openDroppedPath,
    openDroppedFolder: useCallback((handle: any) => {
      bridge.postMessage({ command: 'openFolder', handle, openFirstFile: true });
    }, [bridge]),
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

  useEffect(() => () => clearSearchJumpMarks(), []);

  useEffect(() => {
    if (!pendingSearchJump) return;
    if (state.currentFile !== pendingSearchJump.filePath) return;

    const handle = window.setTimeout(() => {
      scrollToRenderedSearchMatch(
        pendingSearchJump.query, 
        pendingSearchJump.matchOrdinal, 
        pendingSearchJump.matchIndex,
        state.markdownSource
      );
      setPendingSearchJump((current) =>
        current?.token === pendingSearchJump.token ? null : current,
      );
    }, 80);

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
    if (isElectron && state.hostPlatform === 'windows' && updateCheck.downloadUrl) {
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
    isElectron,
    openExternalUrl,
    state.hostPlatform,
    updateCheck.downloadUrl,
    updateCheck.latestVersion,
  ]);

  const scheduleUpdateOnExit = useCallback(() => {
    if (!isElectron) return;
    bridge.postMessage({ command: 'scheduleDownloadedUpdate' });
  }, [bridge, isElectron]);

  const restartAndApplyUpdate = useCallback(() => {
    if (!isElectron) return;
    bridge.postMessage({ command: 'restartAndApplyUpdate' });
  }, [bridge, isElectron]);

  const openUpdateChangelog = useCallback(() => {
    openExternalUrl(updateCheck.changelogUrl);
  }, [openExternalUrl, updateCheck.changelogUrl]);

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
    const stored = localStorage.getItem('markdown-explorer-sidebar-width');
    if (stored) {
      document.documentElement.style.setProperty('--sidebar-width', `${stored}px`);
    }
  }, []);

  // Initialize TOC width from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('markdown-explorer-toc-width');
    if (stored) {
      document.documentElement.style.setProperty('--toc-width', `${stored}px`);
    }
  }, []);

  // Sidebar resize handle
  useResize('sidebarResize', 'sidebar', state.workspaceName);

  // Table of contents resize handle
  useResize('tocResize', 'tocPanel', `${state.workspaceName}:${state.toc.length}`, {
    min: 180,
    max: 360,
    cssVar: '--toc-width',
    storageKey: 'markdown-explorer-toc-width',
    direction: 'rtl',
  });

  // Expand / Collapse all sections
  const expandAll = useCallback(() => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'true';
    });
  }, []);

  const collapseAll = useCallback(() => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'false';
    });
  }, []);

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
    onSearchOpen: () => openSearch('current'),
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
    onToggleFocusMode: toggleFocusMode,
  });

  const isAllTabsSearch = isTabView && searchScope === 'all-tabs';

  // Image click → open media modal
  const onImageClick = useCallback((el: HTMLElement) => {
    setModalTarget(el);
    setModalOpen(true);
  }, []);

  if (!termsAccepted && isDesktopLike) {
    return (
      <div className="app" style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Custom top bar for window dragging & controls */}
        <div style={{
          height: '44px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '12px',
          WebkitAppRegion: 'drag',
          position: 'relative',
          zIndex: 200000
        } as any}>
          {isElectron && (
            <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={toggleTheme}
                tooltip={t.topbar.theme}
                shortcut={state.settings.keybindings?.toggleTheme}
                icon={
                  state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  )
                }
              />
              <div style={{ width: '1px', height: '16px', background: 'var(--bd-s)' }} />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })}
                tooltip={t.tooltips.minimize}
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
                tooltip={state.isMaximized ? t.tooltips.restore : t.tooltips.maximize}
                icon={state.isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M8 3h13v13H8z" />
                    <path d="M16 16v5H3V8h5" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn window-control-btn--close"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })}
                tooltip={t.tooltips.closeApp}
                tooltipAlign="right"
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              />
            </div>
          )}
        </div>
        <TermsModal
          isOpen={true}
          onAgree={handleAgreeTerms}
          onOpenExternal={openExternalUrl}
        />
      </div>
    );
  }

  if (state.isLoading && !state.workspaceName) {
    return (
      <div className="state-screen" style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--tx)' }}>
        <div className="spinner" />
        <div className="state-screen__title" style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>
          {state.loadingLabel || 'Loading docs...'}
        </div>
        {state.loadingDetail && (
          <div className="state-screen__sub">{state.loadingDetail}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`app${isTabView ? ' app--tab-view' : ''}${sidebarCursorMode ? ' app--sidebar-cursor-mode' : ''}${state.focusMode ? ' app--focus-mode' : ''}${state.isMaximized && state.hostPlatform === 'windows' ? ' is-maximized-windows' : ''}`}>
      <div className="sidebar-cursor-backdrop" aria-hidden="true" />
      {isTabView && (
        <DesktopTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={activateTab}
          onNewTab={createNewWorkspaceTab}
          onCloseTab={closeTab}
          onCloseTabsToRight={closeTabsToRight}
          onCloseOtherTabs={closeOtherTabs}
          onCloseAllTabs={closeAllTabs}
          onAliasChange={updateTabAlias}
          onSearchOpen={() => openSearch('all-tabs')}
          searchShortcutLabel={allTabsSearchShortcutLabel}
          onThemeToggle={toggleTheme}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSidebarToggle={toggleSidebar}
          isDark={isDark}
          isMaximized={state.isMaximized}
          hasUpdate={updateCheck.hasUpdate}
        />
      )}
      {isTabView && activeTabId === 'home' ? (
        <main className="tab-home">
          <div className="content__scroll" id="homeContentScroll">
            <WelcomePage />
          </div>
        </main>
      ) : !state.workspaceName ? (
        <WorkspaceSelection
          onBeforeOpenWorkspace={prepareWorkspaceOpen}
          embeddedInTabs={isTabView}
          workspaceAliases={workspaceAliases}
        />
      ) : (
        <>
          {!isTabView && (
            <Topbar
              onSearchOpen={() => openSearch('current')}
              onSettingsOpen={() => setSettingsOpen(true)}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onCopyFile={copyCurrentFileContent}
              searchShortcutLabel={currentSearchShortcutLabel}
              hasUpdate={updateCheck.hasUpdate}
            />
          )}
          <div className="body">
            <Sidebar
              cursorMode={sidebarCursorMode}
              onCursorModeClose={closeSidebarCursorMode}
            />
            <div className="sidebar-resize" id="sidebarResize" role="separator" aria-label="Resize sidebar" />
            <div className="content-shell">
              <ContentTabs />
              {state.toc.length > 0 && state.currentFile && (
                <div className={`toc-compact-bar${state.tocCollapsed ? ' is-collapsed' : ''}`}>
                  <TableOfContents variant="compact" />
                  <TooltipButton
                    type="button"
                    className="toc-compact-bar__toggle-btn"
                    onClick={toggleToc}
                    tooltip={t.actions.toggleToc}
                    shortcut={state.settings.keybindings?.toggleToc}
                    tooltipPos="below"
                    tooltipAlign="right"
                    icon={state.tocCollapsed ? <ExpandIcon size={14} /> : <CollapseIcon size={14} />}
                  />
                </div>
              )}
              <div className="content-shell__main">
                {state.currentFile && (
                  <TooltipButton
                    type="button"
                    className={`focus-mode-btn${state.focusMode ? ' is-active' : ''}`}
                    onClick={toggleFocusMode}
                    tooltip={state.focusMode ? "Exit Focus Mode" : "Focus Mode"}
                    shortcut={state.settings.keybindings?.toggleFocusMode}
                    tooltipPos="below"
                    tooltipAlign="left"
                    icon={state.focusMode ? <MinimizeIcon size={12} /> : <MaximizeIcon size={12} />}
                  />
                )}
                {state.toc.length > 0 && state.tocCollapsed && (
                  <TooltipButton
                    type="button"
                    className="toc-panel__open-btn"
                    onClick={toggleToc}
                    tooltip={t.actions.toggleToc}
                    shortcut={state.settings.keybindings?.toggleToc}
                    tooltipPos="below"
                    tooltipAlign="right"
                    icon={<DoubleChevronLeftIcon size={14} />}
                  />
                )}
                <Content
                  onImageClick={onImageClick}
                  scrollRef={scrollRef}
                  suppressWelcome={isTabView}
                />
                {/* Scroll to top button */}
                <TooltipButton
                  className={`scroll-to-top-btn${scrollTopVisible ? ' is-visible' : ''}${state.toc.length > 0 && !state.tocCollapsed && !state.focusMode ? ' scroll-to-top-btn--with-toc' : ''}`}
                  onClick={scrollToTop}
                  tooltip={t.tooltips.scrollToTop}
                  tooltipPos="above"
                  tooltipAlign="right"
                  icon={<ChevronUpIcon />}
                />
              </div>
              {isTabView && (
                <FloatingTabToolbar
                  position={toolbarPosition}
                  onPositionChange={setToolbarPosition}
                  onSearchOpen={() => openSearch('current')}
                  searchShortcutLabel={currentSearchShortcutLabel}
                  onExpandAll={expandAll}
                  onCollapseAll={collapseAll}
                  onEdit={openInEditor}
                  onCopyFile={copyCurrentFileContent}
                  onRefresh={refresh}
                  onBack={back}
                  onForward={forward}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  canEdit={!!state.currentFile}
                />
              )}
            </div>
            {state.toc.length > 0 && (
              <>
                <div className={`toc-resize${state.tocCollapsed ? ' is-collapsed' : ''}`} id="tocResize" role="separator" aria-label="Resize table of contents" />
                <TableOfContents variant="panel" />
              </>
            )}
          </div>
        </>
      )}

      {/* Overlays */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={closeSearch}
        scopeKey={searchScope}
        scopeLabel={
          isAllTabsSearch
            ? `${t.actions.searchAllTabs}... (${allTabsSearchShortcutLabel})`
            : isTabView
              ? `${t.actions.searchCurrent}... (${currentSearchShortcutLabel})`
              : undefined
        }
        crossTabItems={isAllTabsSearch ? crossTabSearchItems : undefined}
        onWorkspaceSelect={handleWorkspaceSearchSelect}
        onCrossTabSelect={isAllTabsSearch ? handleCrossTabSelect : undefined}
      />
      <FindInFilePanel
        isOpen={findOpen}
        onClose={closeFind}
        renderVersion={state.renderVersion}
        shortcutLabel={findShortcutLabel}
      />
      <MediaModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setModalTarget(null); }} clickedElement={modalTarget} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        updateCheck={updateCheck}
        hostUpdateState={state.updateState}
        onDownloadUpdate={downloadUpdate}
        onScheduleUpdateOnExit={scheduleUpdateOnExit}
        onRestartAndApplyUpdate={restartAndApplyUpdate}
        onOpenChangelog={openUpdateChangelog}
      />
      <ThemeOnboardingModal
        isOpen={themeOnboardingOpen}
        onComplete={handleThemeOnboardingComplete}
      />
      <SwitchWorkspaceModal
        isOpen={pendingDroppedPath !== null}
        onClose={() => setPendingDroppedPath(null)}
        onConfirm={confirmSwitchWorkspace}
        targetPath={pendingDroppedPath || ''}
      />

      {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '2.5px dashed var(--accent)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, color: 'var(--tx)',
          pointerEvents: 'none', transition: 'all 0.2s ease'
        }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Drop folder or file to open</div>
          <div style={{ fontSize: '13px', color: 'var(--tx2)', marginTop: '8px' }}>
            {state.settings.documentConversion
              ? 'Supports folders, Markdown, DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files'
              : 'Supports folders, .md / .mdx, and .txt files'}
          </div>
        </div>
      )}
    </div>
  );
}

initGlobalHandlers();
