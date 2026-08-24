import { lazy, Suspense, useEffect, useState } from "react";
import { TooltipButton } from "./components/shared/TooltipButton";
import { EXPORT_CENTER_OPEN_EVENT } from "./components/shared/ToolbarActionMenu";
import { DesktopTabBar } from "./components/Desktop/DesktopTabBar";
import { ExitFocusIcon } from "./components/shared/icons";
import { ScrollToTopButton } from "./components/shared/ScrollToTopButton";
import { Topbar } from "./components/Topbar/Topbar";
import { getEnabledShortcut } from "./utils/shortcuts";
import { useModalRegionAnchor } from "./utils/useModalRegionAnchor";
import { AvailableUpdateDialog } from "./components/Settings/AvailableUpdateDialog";

const Sidebar = lazy(() => import("./components/Sidebar/Sidebar").then((m) => ({ default: m.Sidebar })));
const Content = lazy(() => import("./components/Content/Content").then((m) => ({ default: m.Content })));
const WorkspaceSelection = lazy(() => import("./components/Workspace/WorkspaceSelection").then((m) => ({ default: m.WorkspaceSelection })));
const ContentTabs = lazy(() => import("./components/Content/ContentTabs").then((m) => ({ default: m.ContentTabs })));
const WelcomePage = lazy(() => import("./components/Content/WelcomePage").then((m) => ({ default: m.WelcomePage })));
const TableOfContents = lazy(() => import("./components/TOC/TableOfContents").then((m) => ({ default: m.TableOfContents })));
const SearchOverlay = lazy(() => import("./components/Search/SearchOverlay").then((m) => ({ default: m.SearchOverlay })));
const FindInFilePanel = lazy(() => import("./components/Search/FindInFilePanel").then((m) => ({ default: m.FindInFilePanel })));
const MediaModal = lazy(() => import("./components/Modal/MediaModal").then((m) => ({ default: m.MediaModal })));
const SettingsModal = lazy(() => import("./components/Settings/SettingsModal").then((m) => ({ default: m.SettingsModal })));
const ExportCenterModal = lazy(() => import("./components/Export/ExportCenterModal").then((m) => ({ default: m.ExportCenterModal })));
const ThemeOnboardingModal = lazy(() => import("./components/Modal/ThemeOnboardingModal").then((m) => ({ default: m.ThemeOnboardingModal })));
const SwitchWorkspaceModal = lazy(() => import("./components/Modal/SwitchWorkspaceModal").then((m) => ({ default: m.SwitchWorkspaceModal })));
const WorkspaceSelectionConfirmModal = lazy(() => import("./components/Modal/WorkspaceSelectionConfirmModal").then((m) => ({ default: m.WorkspaceSelectionConfirmModal })));


export function AppView(props: any) {
  const [exportCenterOpen, setExportCenterOpen] = useState(false);
  const {
    isTabView,
    sidebarCursorMode,
    closeSidebarCursorMode,
  state,
  activeTabId,
  tabs,
  bookmarkWorkspaces,
  activeBookmarkWorkspaceKey,
  handleBookmarkNavigate,
  activateTab,
  createNewWorkspaceTab,
  closeTab,
  reorderTabs,
  closeTabsToRight,
  closeOtherTabs,
  closeAllTabs,
  cancelCurrentWorkspaceScan,
  updateTabAlias,
  toggleTheme,
  setSettingsOpen,
  toggleSidebar,
  isDark,
  updateCheck,
  updateNotification,
  isFullscreen,
  toggleFullscreen,
  prepareWorkspaceOpen,
  reopenUnavailableWorkspace,
  workspaceAliases,
  updateWorkspaceAlias,
  scrollRef,
  t,
  expandAll,
  collapseAll,
  copyCurrentFileContent,
  refresh,
  back,
  forward,
  canGoBack,
  canGoForward,
  searchOpen,
  closeSearch,
  searchScope,
  isAllTabsSearch,
  allTabsSearchShortcutLabel,
  currentSearchShortcutLabel,
  crossTabSearchItems,
  handleWorkspaceSearchSelect,
  handleCrossTabSelect,
  isIndexingAcrossTabs,
  findOpen,
  closeFind,
  findShortcutLabel,
  mediaGallery,
  setMediaGallery,
  settingsOpen,
  downloadUpdate,
  scheduleUpdateOnExit,
  restartAndApplyUpdate,
  openUpdateChangelog,
  themeOnboardingOpen,
  handleThemeOnboardingComplete,
  pendingDroppedPath,
  setPendingDroppedPath,
  confirmSwitchWorkspace,
  workspaceSelectionConfirmOpen,
  setWorkspaceSelectionConfirmOpen,
  closeWorkspaceToSelection,
  toggleFocusMode,
  isDragging,
  onImageClick
  } = props;

  useEffect(() => {
    const openExportCenter = () => setExportCenterOpen(true);
    window.addEventListener(EXPORT_CENTER_OPEN_EVENT, openExportCenter);
    return () => window.removeEventListener(EXPORT_CENTER_OPEN_EVENT, openExportCenter);
  }, []);

  useModalRegionAnchor();

  return (
    <div className={`app${isTabView ? ' app--tab-view' : ''}${sidebarCursorMode ? ' app--sidebar-cursor-mode' : ''}${state.focusMode ? ' app--focus-mode' : ''}${state.appRuntime === 'tauri' ? ' app--tauri' : ''}${isFullscreen ? ' app--fullscreen' : ''}${state.isMaximized && state.hostPlatform === 'windows' ? ' is-maximized-windows' : ''}${state.hostPlatform === 'windows' ? ' is-windows' : ''}`}>
      <div className="sidebar-cursor-backdrop" aria-hidden="true" />
      {isTabView && (
        <DesktopTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={activateTab}
          onNewTab={createNewWorkspaceTab}
          onCloseTab={closeTab}
          onReorderTabs={reorderTabs}
          onCloseTabsToRight={closeTabsToRight}
          onCloseOtherTabs={closeOtherTabs}
          onCloseAllTabs={closeAllTabs}
          onAliasChange={updateTabAlias}
          onThemeToggle={toggleTheme}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSidebarToggle={toggleSidebar}
          onBack={back}
          onForward={forward}
          onRefresh={refresh}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onCollapseAll={collapseAll}
          onExpandAll={expandAll}
          onCopyFile={copyCurrentFileContent}
          isDark={isDark}
          isMaximized={state.isMaximized}
          hasUpdate={updateNotification.attention}
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
        />
      )}
      {state.isWorkspaceScanning && (
        <div className="workspace-scan-progress" role="status" aria-live="polite">
          <span>{t.ui.scanningFiles.replace('{count}', state.scannedFiles.toLocaleString(state.settings.language || 'en'))}</span>
          {isTabView && (
            <button type="button" className="workspace-scan-progress__cancel" onClick={cancelCurrentWorkspaceScan}>
              {t.tooltips.cancelScan}
            </button>
          )}
        </div>
      )}
      {isTabView && activeTabId === 'home' ? (
        <main className="tab-home">
          <div className="content__scroll" id="homeContentScroll">
            <WelcomePage />
          </div>
        </main>
      ) : !state.workspaceName ? (
        state.appRuntime === 'vscode' ? (
          <main className="tab-home">
            <div className="content__scroll" id="homeContentScroll">
              <WelcomePage />
            </div>
          </main>
        ) : isTabView && (state.isLoading || state.isWorkspaceScanning) ? (
          <main className="tab-loading">
            <div className="state-screen state-screen--tab-loading">
              <div className="spinner" />
              <div className="state-screen__title">{state.loadingLabel || t.ui.loadingDocs}</div>
              {state.isWorkspaceScanning && (
                <div className="state-screen__sub">
                  {t.ui.scanningFiles.replace('{count}', state.scannedFiles.toLocaleString(state.settings.language || 'en'))}
                </div>
              )}
              {state.loadingDetail && <div className="state-screen__sub">{state.loadingDetail}</div>}
              <button type="button" className="btn state-screen__cancel" onClick={cancelCurrentWorkspaceScan}>
                {t.tooltips.cancelScan}
              </button>
            </div>
          </main>
        ) : (
          <WorkspaceSelection
            onBeforeOpenWorkspace={prepareWorkspaceOpen}
            embeddedInTabs={isTabView}
            workspaceAliases={workspaceAliases}
            onWorkspaceAliasChange={updateWorkspaceAlias}
          />
        )
      ) : (
        <>
          {!isTabView && (
            <Topbar
              onSettingsOpen={() => setSettingsOpen(true)}
              onExportOpen={() => setExportCenterOpen(true)}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onCopyFile={copyCurrentFileContent}
              hasUpdate={updateNotification.attention}
              isFullscreen={isFullscreen}
              onFullscreenToggle={toggleFullscreen}
            />
          )}
          <div className="body">
            <Sidebar
              cursorMode={sidebarCursorMode}
              onCursorModeClose={closeSidebarCursorMode}
              bookmarkViewMode={isTabView ? 'tabs' : 'focus'}
              bookmarkWorkspaces={bookmarkWorkspaces}
              activeBookmarkWorkspaceKey={activeBookmarkWorkspaceKey}
              onBookmarkNavigate={handleBookmarkNavigate}
            />
            <div className="sidebar-resize" id="sidebarResize" role="separator" aria-label={t.ui.resizeSidebar} />
            <div className="content-shell">
              <ContentTabs />

              <div className="content-shell__main">
                <Content
                  onImageClick={onImageClick}
                  scrollRef={scrollRef}
                  suppressWelcome={isTabView}
                  onCancelWorkspaceScan={isTabView ? cancelCurrentWorkspaceScan : undefined}
                  onOpenWorkspaceAgain={reopenUnavailableWorkspace}
                />
                <ScrollToTopButton
                  scrollRef={scrollRef}
                  observeKey={state.workspaceName}
                  tooltip={t.tooltips.scrollToTop}
                  withToc={state.toc.length > 0 && !state.tocCollapsed && !state.focusMode}
                />
              </div>

            </div>
            {state.toc.length > 0 && (
              <>
                <div className={`toc-resize${state.tocCollapsed ? ' is-collapsed' : ''}`} id="tocResize" role="separator" aria-label={t.ui.resizeToc} />
                <Suspense fallback={null}><TableOfContents variant="panel" /></Suspense>
              </>
            )}
          </div>
        </>
      )}

      <Suspense fallback={null}>
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
        isIndexing={isAllTabsSearch && isIndexingAcrossTabs}
      />
      <FindInFilePanel
        isOpen={findOpen}
        onClose={closeFind}
        renderVersion={state.renderVersion}
        shortcutLabel={findShortcutLabel}
      />
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
      <ExportCenterModal isOpen={exportCenterOpen} onClose={() => setExportCenterOpen(false)} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        updateCheck={updateCheck}
        hostUpdateState={state.updateState}
        onDownloadUpdate={downloadUpdate}
        onScheduleUpdateOnExit={scheduleUpdateOnExit}
        onRestartAndApplyUpdate={restartAndApplyUpdate}
        onOpenChangelog={openUpdateChangelog}
        hasUpdateAttention={updateNotification.attention}
      />
      {updateNotification.promptOpen && (
        <AvailableUpdateDialog
          version={updateCheck.latestVersion}
          currentVersion={updateCheck.currentVersion || state.appVersion}
          t={t}
          canDownloadUpdate={state.appRuntime !== 'vscode'}
          onDownload={updateNotification.download}
          onLater={updateNotification.later}
          onSkipVersion={updateNotification.skipVersion}
          onChangelog={openUpdateChangelog}
        />
      )}
      <ThemeOnboardingModal
        isOpen={themeOnboardingOpen}
        onComplete={handleThemeOnboardingComplete}
        onOpenSettings={() => {
          handleThemeOnboardingComplete();
          setSettingsOpen(true);
        }}
      />
      <SwitchWorkspaceModal
        isOpen={pendingDroppedPath !== null}
        onClose={() => setPendingDroppedPath(null)}
        onConfirm={confirmSwitchWorkspace}
        targetPath={pendingDroppedPath || ''}
      />
      <WorkspaceSelectionConfirmModal
        isOpen={workspaceSelectionConfirmOpen}
        onClose={() => setWorkspaceSelectionConfirmOpen(false)}
        onConfirm={() => {
          setWorkspaceSelectionConfirmOpen(false);
          closeWorkspaceToSelection();
        }}
      />
      </Suspense>

      {state.focusMode && (
        <TooltipButton
          type="button"
          className="exit-focus-btn focus-mode-btn"
          onClick={toggleFocusMode}
          tooltip={t.actions.toggleFocusMode}
          shortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
          tooltipPos="below"
          tooltipAlign="right"
          icon={<ExitFocusIcon size={12} />}
        />
      )}

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__title">{t.ui.dropOpenTitle}</div>
          <div className="drop-overlay__detail">
            {t.ui.dropOpenSupported}
          </div>
        </div>
      )}
    </div>
  );;
}
