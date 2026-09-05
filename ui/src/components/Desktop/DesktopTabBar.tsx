import { useCallback, useEffect, useRef, useState } from 'react';
import { TooltipButton } from '../shared/TooltipButton';
import { ToolbarActionMenu } from '../shared/ToolbarActionMenu';
import { DocumentHeaderActions, NavigationHeaderActions } from '../shared/HeaderActionGroups';
import {
  PlusIcon,
} from '../shared/icons';
import logoUrl from '../../assets/logos/logo-500.png?inline';
import type { DesktopTab } from '../../desktop/types';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';
import type { TabContextMenuAction } from '../shared/TabContextMenu';
import { useTabBarScrollbar } from './useTabBarScrollbar';
import { useCssVars } from '../../utils/useCssVars';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { requestShellLocation, supportsShellLocation } from '../../desktop/shellLocation';
import { DesktopTabItem } from './DesktopTabItem';
import { DesktopTabContextMenu } from './DesktopTabContextMenu';
import { INSIGHTS_UI_TRANSLATIONS } from '../../contexts/insightsUiTranslations';

const TAB_CLOSE_FADE_MS = 90;
const TAB_CLOSE_COLLAPSE_MS = 140;

type TabClosePhase = 'idle' | 'fade' | 'collapse';

interface DesktopTabBarProps {
  tabs: DesktopTab[]; activeTabId: string;
  onSelectTab: (tabId: string) => void; onNewTab: () => void; onCloseTab: (tabId: string) => void;
  onReorderTabs: (sourceTabId: string, targetTabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void; onCloseOtherTabs: (tabId: string) => void; onCloseAllTabs: () => void;
  onAliasChange: (tabId: string, alias: string) => void;
  onThemeToggle: () => void; onSettingsOpen: () => void; onSidebarToggle: () => void;
  onBack: () => void; onForward: () => void; onRefresh: () => void;
  canGoBack: boolean; canGoForward: boolean;
  onCollapseAll: () => void; onExpandAll: () => void; onCopyFile: (button?: HTMLElement | null) => void;
  isDark: boolean; isMaximized: boolean; hasUpdate?: boolean; isFullscreen?: boolean;
  onFullscreenToggle?: () => void; isInsightsOpen?: boolean; onInsightsToggle?: () => void;
}

export function DesktopTabBar({
  tabs, activeTabId, onSelectTab, onNewTab, onCloseTab, onReorderTabs,
  onCloseTabsToRight, onCloseOtherTabs, onCloseAllTabs, onAliasChange,
  onThemeToggle, onSettingsOpen, onSidebarToggle, onBack, onForward, onRefresh,
  canGoBack, canGoForward, onCollapseAll, onExpandAll, onCopyFile,
  isDark, isMaximized, hasUpdate = false, isFullscreen = false, onFullscreenToggle,
  isInsightsOpen = false, onInsightsToggle,
}: DesktopTabBarProps) {
  const { state, openInEditor, toggleToc, toggleFocusMode } = useAppState();
  const bridge = usePlatform();
  const currentLang = state.settings.language || 'en';
  const insightsLang = currentLang as keyof typeof INSIGHTS_UI_TRANSLATIONS;
  const insightsT = INSIGHTS_UI_TRANSLATIONS[insightsLang] ?? INSIGHTS_UI_TRANSLATIONS.en;
  const t = getTranslations(currentLang);
  const themeToggleLabel = isDark ? t.topbar.switchToLightMode : t.topbar.switchToDarkMode;
  const workspaceTabs = tabs.filter((tab) => tab.kind !== 'home');

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedTabIdRef = useRef<string | null>(null);
  const didDragRef = useRef(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [closingTabIds, setClosingTabIds] = useState<Set<string>>(() => new Set());
  const [closingPhase, setClosingPhase] = useState<TabClosePhase>('idle');
  const tabElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const closeTimersRef = useRef<number[]>([]);
  const closeInProgressRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [ghostLabel, setGhostLabel] = useState<string>("");
  const {
    tabsScrollRef,
    scrollbarTrackRef,
    scrollbarMetrics,
    isScrollbarDragging,
    updateScrollbarMetrics,
    beginScrollbarDrag,
    handleScrollbarTrackPointerDown,
  } = useTabBarScrollbar(activeTabId, tabs);
  const scrollbarThumbRef = useRef<HTMLDivElement>(null);
  useCssVars(scrollbarThumbRef, {
    '--scrollbar-thumb-width': `${scrollbarMetrics.thumbWidth}px`,
    '--scrollbar-thumb-left': `${scrollbarMetrics.thumbLeft}px`,
  });

  useEffect(() => {
    if (!contextMenu) return;
    if (tabs.some((tab) => tab.kind !== 'home' && tab.id === contextMenu.tabId)) return;
    setContextMenu(null);
  }, [contextMenu, tabs]);

  useEffect(() => {
    const finishPointerDrag = () => {
      draggedTabIdRef.current = null;
      setDraggedTabId(null);
    };
    document.addEventListener('pointerup', finishPointerDrag);
    document.addEventListener('pointercancel', finishPointerDrag);
    return () => {
      document.removeEventListener('pointerup', finishPointerDrag);
      document.removeEventListener('pointercancel', finishPointerDrag);
    };
  }, []);

  useEffect(() => () => {
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    closeTimersRef.current = [];
    closeInProgressRef.current = false;
  }, []);

  const requestTabClose = useCallback((tabIds: string[], commitClose: () => void) => {
    if (closeInProgressRef.current || tabIds.length === 0) return;

    const prefersReducedMotion = typeof window === 'undefined'
      || (typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (prefersReducedMotion) {
      commitClose();
      return;
    }

    const renderedTabIds = tabIds.filter((tabId) => {
      const element = tabElementsRef.current.get(tabId);
      if (!element) return false;
      const measuredWidth = Math.max(
        element.getBoundingClientRect().width,
        element.offsetWidth,
      );
      if (measuredWidth <= 0) return false;
      element.style.setProperty('--desktop-tab-close-width', `${measuredWidth}px`);
      return true;
    });

    if (renderedTabIds.length === 0) {
      commitClose();
      return;
    }

    closeInProgressRef.current = true;
    setClosingTabIds(new Set(renderedTabIds));
    setClosingPhase('fade');

    const fadeTimer = window.setTimeout(() => {
      setClosingPhase('collapse');
      const collapseTimer = window.setTimeout(() => {
        setClosingTabIds(new Set());
        setClosingPhase('idle');
        closeInProgressRef.current = false;
        closeTimersRef.current = [];
        commitClose();
      }, TAB_CLOSE_COLLAPSE_MS);
      closeTimersRef.current.push(collapseTimer);
    }, TAB_CLOSE_FADE_MS);
    closeTimersRef.current = [fadeTimer];
  }, []);

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction) => {
      if (!contextMenu) return;
      const targetIndex = workspaceTabs.findIndex((tab) => tab.id === contextMenu.tabId);
      switch (action) {
        case 'openLocation': {
          const targetTab = workspaceTabs.find((tab) => tab.id === contextMenu.tabId);
          if (targetTab?.workspacePath && supportsShellLocation(state.appRuntime)) {
            requestShellLocation(bridge, targetTab.workspacePath, 'open-directory');
          }
          break;
        }
        case 'closeThisTab':
          requestTabClose([contextMenu.tabId], () => onCloseTab(contextMenu.tabId));
          break;
        case 'closeTabsToRight':
          requestTabClose(
            workspaceTabs.slice(targetIndex + 1).map((tab) => tab.id),
            () => onCloseTabsToRight(contextMenu.tabId),
          );
          break;
        case 'closeOtherTabs':
          requestTabClose(
            workspaceTabs.filter((tab) => tab.id !== contextMenu.tabId).map((tab) => tab.id),
            () => onCloseOtherTabs(contextMenu.tabId),
          );
          break;
        case 'closeAllTabs':
          requestTabClose(
            workspaceTabs.map((tab) => tab.id),
            onCloseAllTabs,
          );
          break;
      }
    },
    [
      bridge,
      contextMenu,
      onCloseAllTabs,
      onCloseOtherTabs,
      onCloseTab,
      onCloseTabsToRight,
      requestTabClose,
      state.appRuntime,
      workspaceTabs,
    ],
  );

  const startEditing = (tab: DesktopTab) => {
    if (tab.kind !== 'workspace') return;
    setEditingTabId(tab.id);
    setDraftAlias(tab.alias ?? tab.workspaceName ?? '');
  };

  const commitAlias = () => {
    if (editingTabId) onAliasChange(editingTabId, draftAlias.trim());
    setEditingTabId(null);
    setDraftAlias('');
  };

  const contextMenuTabIndex = contextMenu
    ? workspaceTabs.findIndex((tab) => tab.id === contextMenu.tabId)
    : -1;
  const shouldExitTauriFullscreenOnRestore =
    state.appRuntime === 'tauri' && isFullscreen && onFullscreenToggle;
  const showsRestoreControl = isMaximized || isFullscreen;

  return (
    <header className="desktop-tabbar">
      <div className="desktop-tabbar__brand topbar__logo" aria-label="Markdown Explorer">
        <span className="topbar__logo-icon">
          <img src={logoUrl} width={20} height={20} alt="Markdown Explorer" className="topbar__logo-img" />
        </span>
        <div className="topbar__logo-text-group">
          <div className="topbar__logo-title">Markdown Explorer</div>
          <div className="topbar__logo-subtitle">
            by <a href="https://github.com/the-long-ride/markdown-explorer" target="_blank" rel="noopener noreferrer">the-long-ride</a> with ❤️
          </div>
        </div>
      </div>
      <span
        className="topbar__crumb-separator desktop-tabbar__navigation-separator"
        aria-hidden="true"
      >
        |
      </span>
      <NavigationHeaderActions
        onBack={onBack}
        onForward={onForward}
        onRefresh={onRefresh}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        className="desktop-tabbar__navigation-actions"
      />
      <div className="desktop-tabbar__tabs-wrap">
        <div
          ref={tabsScrollRef}
          className="desktop-tabbar__tabs"
          role="tablist"
          aria-label={t.ui.workspaceTabs}
          onScroll={updateScrollbarMetrics}
        >
          {workspaceTabs.map((tab) => {
            const closePhaseClass = closingTabIds.has(tab.id)
              ? closingPhase === 'collapse' ? ' is-closing--collapse' : ' is-closing--fade'
              : '';
            return <DesktopTabItem key={tab.id} tab={tab} active={tab.id === activeTabId}
              editing={editingTabId === tab.id} dragged={draggedTabId === tab.id}
              closePhaseClass={closePhaseClass} draftAlias={draftAlias} closeLabel={t.tooltips.closeTab}
              draggedTabIdRef={draggedTabIdRef} didDragRef={didDragRef} ghostRef={ghostRef}
              tabElementsRef={tabElementsRef} onDraftAliasChange={setDraftAlias}
              onCommitAlias={commitAlias} onCancelAlias={() => { setEditingTabId(null); setDraftAlias(''); }}
              onStartEditing={startEditing} onSetDraggedTabId={setDraggedTabId} onSetGhostLabel={setGhostLabel}
              onReorder={onReorderTabs} onSelect={onSelectTab} onContextMenu={setContextMenu}
              onClose={(tabId) => requestTabClose([tabId], () => onCloseTab(tabId))} />;
          })}
        </div>
        {scrollbarMetrics.visible && (
          <div
            ref={scrollbarTrackRef}
            className={`desktop-tabbar__scrollbar${isScrollbarDragging ? ' is-dragging' : ''}`}
            aria-hidden="true"
            onPointerDown={handleScrollbarTrackPointerDown}
          >
            <div
              ref={scrollbarThumbRef}
              className="desktop-tabbar__scrollbar-thumb"
              onPointerDown={beginScrollbarDrag}
            />
          </div>
        )}
      </div>
      {contextMenu && (
        <DesktopTabContextMenu state={state} translations={t}
          position={contextMenu} tabIndex={contextMenuTabIndex} tabCount={workspaceTabs.length}
          onAction={handleContextMenuAction} onClose={() => setContextMenu(null)} />
      )}
      <TooltipButton
        className="btn btn--icon desktop-tabbar__new topbar__new-workspace-btn topbar__action-btn"
        onClick={onNewTab}
        tooltip={t.tooltips.newTab}
        shortcut={getEnabledShortcut(state.settings, 'workspaceSelection')}
        icon={<PlusIcon />}
      />
      <DocumentHeaderActions
        onCollapseAll={onCollapseAll}
        onExpandAll={onExpandAll}
        onCopyFile={onCopyFile}
        canCopyFile={!!state.currentFile}
        className="desktop-tabbar__document-actions"
      />
      <ToolbarActionMenu
        triggerTooltip={t.topbar.moreActions}
        homeLabel={t.topbar.home}
        themeLabel={themeToggleLabel}
        editLabel={t.topbar.editLabel}
        settingsLabel={t.topbar.settings}
        homeTooltip={t.topbar.welcomePage}
        themeTooltip={themeToggleLabel}
        editTooltip={t.topbar.edit}
        settingsTooltip={hasUpdate ? t.topbar.settingsUpdate : t.topbar.settings}
        homeShortcut={getEnabledShortcut(state.settings, 'welcome')}
        themeShortcut={getEnabledShortcut(state.settings, 'toggleTheme')}
        editShortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')}
        settingsShortcut={getEnabledShortcut(state.settings, 'settings')}
        canEdit={!!state.currentFile}
        isDark={isDark}
        hasUpdate={hasUpdate}
        onHome={() => onSelectTab('home')}
        onTheme={onThemeToggle}
        onEdit={openInEditor}
        showEdit={true}
        onSettings={onSettingsOpen}
        sidebarLabel={t.actions.toggleSidebar}
        sidebarTooltip={t.actions.toggleSidebar}
        sidebarShortcut={getEnabledShortcut(state.settings, 'toggleSidebar')}
        sidebarActive={!state.sidebarCollapsed}
        onSidebarToggle={onSidebarToggle}
        tocLabel={t.actions.toggleToc}
        tocTooltip={t.actions.toggleToc}
        tocShortcut={getEnabledShortcut(state.settings, 'toggleToc')}
        tocActive={!state.tocCollapsed && !!state.currentFile && state.toc.length > 0}
        tocToggleDisabled={!state.currentFile || state.toc.length === 0}
        onTocToggle={toggleToc}
        showInsights={state.settings.insightsEnabled}
        insightsLabel={insightsT.title}
        insightsTooltip={insightsT.title}
        insightsShortcut={getEnabledShortcut(state.settings, 'toggleWorkspaceInsights')}
        insightsActive={isInsightsOpen}
        canInsights={!!(state.workspacePath || state.workspaceName)}
        onInsightsToggle={onInsightsToggle}
        focusModeLabel={t.actions.toggleFocusMode}
        focusModeTooltip={t.actions.toggleFocusMode}
        focusModeShortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
        isFocusMode={state.focusMode}
        onFocusModeToggle={toggleFocusMode}
        showFullscreen
        fullscreenLabel={t.actions.toggleFullscreen}
        fullscreenTooltip={t.actions.toggleFullscreenTooltip}
        fullscreenShortcut="F11"
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
        showResetZoom
        resetZoomLabel={t.tooltips.resetZoom}
        resetZoomTooltip={t.tooltips.resetZoom}
        resetZoomShortcut={getEnabledShortcut(state.settings, 'resetZoom')}
        onResetZoom={() => bridge.postMessage({ command: 'zoom-reset' })}
      />
      <span
        className="topbar__crumb-separator desktop-tabbar__window-separator"
        aria-hidden="true"
      >
        |
      </span>
      <div className="desktop-tabbar__window-controls">
        <TooltipButton className="btn btn--icon window-control-btn" onClick={() => bridge.postMessage({ command: 'window-minimize' })} tooltip={t.tooltips.minimize} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>} />
        <TooltipButton className="btn btn--icon window-control-btn" onClick={() => shouldExitTauriFullscreenOnRestore ? onFullscreenToggle?.() : bridge.postMessage({ command: 'window-maximize' })} tooltip={showsRestoreControl ? t.tooltips.restore : t.tooltips.maximize} icon={showsRestoreControl ? (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M8 8V3h13v13h-5" /><path d="M3 8h13v13H3z" /></svg>) : (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>)} />
        <TooltipButton className="btn btn--icon window-control-btn window-control-btn--close" onClick={() => bridge.postMessage({ command: 'window-close' })} tooltip={t.tooltips.closeApp} tooltipAlign="right" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
      </div>
      {draggedTabId && (
        <div
          ref={ghostRef}
          className="tab-drag-ghost"
        >
          {ghostLabel}
        </div>
      )}
    </header>
  );
}
