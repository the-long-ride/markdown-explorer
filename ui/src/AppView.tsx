import { lazy, Suspense } from "react";
import { TooltipButton } from "./components/shared/TooltipButton";
import { DesktopTabBar } from "./components/Desktop/DesktopTabBar";
import { ChevronUpIcon, MinimizeIcon } from "./components/shared/icons";
import { Topbar } from "./components/Topbar/Topbar";
import { getEnabledShortcut } from "./utils/shortcuts";

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
const ThemeOnboardingModal = lazy(() => import("./components/Modal/ThemeOnboardingModal").then((m) => ({ default: m.ThemeOnboardingModal })));
const SwitchWorkspaceModal = lazy(() => import("./components/Modal/SwitchWorkspaceModal").then((m) => ({ default: m.SwitchWorkspaceModal })));
const WorkspaceSelectionConfirmModal = lazy(() => import("./components/Modal/WorkspaceSelectionConfirmModal").then((m) => ({ default: m.WorkspaceSelectionConfirmModal })));


export function AppView(props: any) {
  const {
    isTabView,
    sidebarCursorMode,
    closeSidebarCursorMode,
  state,
  activeTabId,
  tabs,
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
  isFullscreen,
  toggleFullscreen,
  prepareWorkspaceOpen,
  reopenUnavailableWorkspace,
  workspaceAliases,
  updateWorkspaceAlias,
  scrollRef,
  scrollTopVisible,
  scrollToTop,
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
  modalOpen,
  setModalOpen,
  modalTarget,
  setModalTarget,
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
          hasUpdate={updateCheck.hasUpdate}
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
        />
      )}
      {state.isWorkspaceScanning && (
        <div className="workspace-scan-progress" role="status" aria-live="polite">
          <span>Scanning {state.scannedFiles.toLocaleString()} files…</span>
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
              <div className="state-screen__title">{state.loadingLabel || 'Loading docs...'}</div>
              {state.isWorkspaceScanning && (
                <div className="state-screen__sub">
                  Scanning {state.scannedFiles.toLocaleString()} files…
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
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onCopyFile={copyCurrentFileContent}
              hasUpdate={updateCheck.hasUpdate}
              isFullscreen={isFullscreen}
              onFullscreenToggle={toggleFullscreen}
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

              <div className="content-shell__main">
                <Content
                  onImageClick={onImageClick}
                  scrollRef={scrollRef}
                  suppressWelcome={isTabView}
                  onCancelWorkspaceScan={isTabView ? cancelCurrentWorkspaceScan : undefined}
                  onOpenWorkspaceAgain={reopenUnavailableWorkspace}
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

            </div>
            {state.toc.length > 0 && (
              <>
                <div className={`toc-resize${state.tocCollapsed ? ' is-collapsed' : ''}`} id="tocResize" role="separator" aria-label="Resize table of contents" />
                <Suspense fallback={null}><TableOfContents variant="panel" /></Suspense>
              </>
            )}
          </div>
        </>
      )}

      {/* Overlays — lazy-loaded components, Suspense fallback is a no-op (invisible when closed) */}
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
          tooltip={t.actions.toggleFocusMode || "Exit Focus Mode"}
          shortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
          tooltipPos="below"
          tooltipAlign="right"
          icon={<MinimizeIcon size={12} />}
        />
      )}

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__title">Drop folder or file to open</div>
          <div className="drop-overlay__detail">
            Supports folders, DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, and RTF files
          </div>
        </div>
      )}
    </div>
  );;
}
