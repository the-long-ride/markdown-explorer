import { useCallback, useEffect, useRef, useState } from 'react';
import { TooltipButton } from '../shared/TooltipButton';
import { ToolbarActionMenu } from '../shared/ToolbarActionMenu';
import {
  CloseIcon,
  PlusIcon,
} from '../shared/icons';
import logoUrl from '../../assets/logos/logo-500.png?inline';
import { getTabLabel } from '../../desktop/desktopTabs';
import type { DesktopTab } from '../../desktop/types';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';
import {
  TabContextMenu,
  type TabContextMenuAction,
} from '../shared/TabContextMenu';
import { useTabBarScrollbar } from './useTabBarScrollbar';
import { useCssVars } from '../../utils/useCssVars';
import { getEnabledShortcut } from '../../utils/shortcuts';

const TAB_CLOSE_FADE_MS = 90;
const TAB_CLOSE_COLLAPSE_MS = 140;

type TabClosePhase = 'idle' | 'fade' | 'collapse';

interface DesktopTabBarProps {
  tabs: DesktopTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onReorderTabs: (sourceTabId: string, targetTabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onAliasChange: (tabId: string, alias: string) => void;
  onThemeToggle: () => void;
  onSettingsOpen: () => void;
  onSidebarToggle: () => void;
  isDark: boolean;
  isMaximized: boolean;
  hasUpdate?: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

export function DesktopTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
  onReorderTabs,
  onCloseTabsToRight,
  onCloseOtherTabs,
  onCloseAllTabs,
  onAliasChange,
  onThemeToggle,
  onSettingsOpen,
  onSidebarToggle,
  isDark,
  isMaximized,
  hasUpdate = false,
  isFullscreen = false,
  onFullscreenToggle,
}: DesktopTabBarProps) {
  const { state, openInEditor, toggleToc, toggleFocusMode } = useAppState();
  const bridge = usePlatform();
  const currentLang = state.settings.language || 'en';
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
        1,
      );
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
      contextMenu,
      onCloseAllTabs,
      onCloseOtherTabs,
      onCloseTab,
      onCloseTabsToRight,
      requestTabClose,
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
      <div className="desktop-tabbar__tabs-wrap">
        <div
          ref={tabsScrollRef}
          className="desktop-tabbar__tabs"
          role="tablist"
          aria-label="Workspace tabs"
          onScroll={updateScrollbarMetrics}
        >
          {workspaceTabs.map((tab) => {
            const active = tab.id === activeTabId;
            const editing = editingTabId === tab.id;
            const label = getTabLabel(tab);
            const closePhaseClass = closingTabIds.has(tab.id)
              ? closingPhase === 'collapse'
                ? ' is-closing--collapse'
                : ' is-closing--fade'
              : '';
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  if (element) tabElementsRef.current.set(tab.id, element);
                  else tabElementsRef.current.delete(tab.id);
                }}
                type="button"
                role="tab"
                aria-selected={active}
                className={`desktop-tab${active ? ' is-active' : ''}${draggedTabId === tab.id ? ' is-dragging' : ''}${closePhaseClass}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({
                    tabId: tab.id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onMouseDown={(event) => {
                  if (event.button === 1) event.preventDefault();
                }}
                onAuxClick={(event) => {
                  if (event.button !== 1) return;
                  event.preventDefault();
                  event.stopPropagation();
                  requestTabClose([tab.id], () => onCloseTab(tab.id));
                }}
                onDoubleClick={() => startEditing(tab)}
                title={tab.workspacePath ?? label}
                onPointerDown={(event) => {
                  if (editing || event.button !== 0 || (event.target as HTMLElement).closest('.desktop-tab__close')) return;
                  draggedTabIdRef.current = tab.id;
                  didDragRef.current = false;
                  setDraggedTabId(tab.id);
                  setGhostLabel(label);

                  const handlePointerMove = (moveEvent: PointerEvent) => {
                    if (ghostRef.current) {
                      ghostRef.current.style.transform = `translate3d(${moveEvent.clientX + 10}px, ${moveEvent.clientY + 10}px, 0)`;
                      ghostRef.current.style.display = 'flex';
                    }
                  };

                  document.addEventListener('pointermove', handlePointerMove);

                  const cleanUpMove = () => {
                    document.removeEventListener('pointermove', handlePointerMove);
                    document.removeEventListener('pointerup', cleanUpMove);
                    document.removeEventListener('pointercancel', cleanUpMove);
                    if (ghostRef.current) {
                      ghostRef.current.style.display = 'none';
                    }
                  };
                  document.addEventListener('pointerup', cleanUpMove);
                  document.addEventListener('pointercancel', cleanUpMove);
                }}
                onPointerEnter={() => {
                  if (draggedTabIdRef.current && draggedTabIdRef.current !== tab.id) {
                    onReorderTabs(draggedTabIdRef.current, tab.id);
                    didDragRef.current = true;
                  }
                }}
                onClick={(event) => {
                  if (didDragRef.current) {
                    event.preventDefault();
                    didDragRef.current = false;
                    return;
                  }
                  onSelectTab(tab.id);
                }}
              >
                {editing ? (
                  <input
                    className="desktop-tab__alias-input"
                    value={draftAlias}
                    autoFocus
                    onChange={(event) => setDraftAlias(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={commitAlias}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitAlias();
                      if (event.key === 'Escape') {
                        setEditingTabId(null);
                        setDraftAlias('');
                      }
                    }}
                  />
                ) : (
                  <span className="desktop-tab__label">{getTabLabel(tab)}</span>
                )}
                <span
                  className="desktop-tab__close"
                  role="button"
                  tabIndex={-1}
                  aria-label="Close tab"
                  title={t.tooltips.closeTab}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestTabClose([tab.id], () => onCloseTab(tab.id));
                  }}
                >
                  <CloseIcon size={11} />
                </span>
              </button>
            );
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
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
        labels={t.tabContextMenu}
          disabled={{
            closeThisTab: contextMenuTabIndex === -1,
            closeTabsToRight:
              contextMenuTabIndex === -1 ||
              contextMenuTabIndex >= workspaceTabs.length - 1,
            closeOtherTabs: workspaceTabs.length <= 1,
            closeAllTabs: workspaceTabs.length === 0,
          }}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
      <div className="desktop-tabbar__spacer" />
      <TooltipButton
        className="btn btn--icon desktop-tabbar__new"
        onClick={onNewTab}
        tooltip={t.tooltips.newTab}
        shortcut={getEnabledShortcut(state.settings, 'workspaceSelection')}
        icon={<PlusIcon />}
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
        focusModeLabel={t.actions.toggleFocusMode || "Toggle focus mode"}
        focusModeTooltip={t.actions.toggleFocusMode || "Toggle focus mode"}
        focusModeShortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
        isFocusMode={state.focusMode}
        onFocusModeToggle={toggleFocusMode}
        showFullscreen
        fullscreenLabel={t.actions.toggleFullscreen}
        fullscreenTooltip={t.actions.toggleFullscreenTooltip}
        fullscreenShortcut="F11"
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
      />
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
