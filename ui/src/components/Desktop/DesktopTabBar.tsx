import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const SCROLLBAR_TRACK_INLINE_INSET = 8;

interface DesktopTabBarProps {
  tabs: DesktopTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
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
}

export function DesktopTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
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
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    maxScrollLeft: number;
    maxThumbLeft: number;
  } | null>(null);
  const [scrollbarMetrics, setScrollbarMetrics] = useState({
    visible: false,
    thumbLeft: 0,
    thumbWidth: 0,
  });
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

  const updateScrollbarMetrics = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScrollLeft <= 1) {
      setScrollbarMetrics((current) =>
        current.visible ? { visible: false, thumbLeft: 0, thumbWidth: 0 } : current,
      );
      return;
    }

    const track = scrollbarTrackRef.current;
    const trackWidth = track?.clientWidth ?? Math.max(0, el.clientWidth - SCROLLBAR_TRACK_INLINE_INSET);
    const thumbWidth = Math.min(
      trackWidth,
      Math.max(44, (el.clientWidth / el.scrollWidth) * trackWidth),
    );
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = maxThumbLeft === 0
      ? 0
      : (el.scrollLeft / maxScrollLeft) * maxThumbLeft;

    setScrollbarMetrics((current) => {
      const next = {
        visible: true,
        thumbLeft,
        thumbWidth,
      };
      if (
        current.visible === next.visible &&
        Math.abs(current.thumbLeft - next.thumbLeft) < 0.5 &&
        Math.abs(current.thumbWidth - next.thumbWidth) < 0.5
      ) {
        return current;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const handle = requestAnimationFrame(updateScrollbarMetrics);
    return () => cancelAnimationFrame(handle);
  }, [activeTabId, tabs, updateScrollbarMetrics]);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollbarMetrics)
      : null;
    resizeObserver?.observe(el);

    window.addEventListener('resize', updateScrollbarMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScrollbarMetrics);
    };
  }, [updateScrollbarMetrics]);

  const beginScrollbarDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!el || !track || !scrollbarMetrics.visible) return;

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
    if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;

    scrollbarDragRef.current = {
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      maxScrollLeft,
      maxThumbLeft,
    };
    setIsScrollbarDragging(true);
    event.preventDefault();
    event.stopPropagation();
  }, [scrollbarMetrics.thumbWidth, scrollbarMetrics.visible]);

  const handleScrollbarTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!el || !track || !scrollbarMetrics.visible) return;

    const trackRect = track.getBoundingClientRect();
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
    if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;

    const nextThumbLeft = Math.min(
      maxThumbLeft,
      Math.max(0, event.clientX - trackRect.left - scrollbarMetrics.thumbWidth / 2),
    );
    el.scrollLeft = (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
    updateScrollbarMetrics();
    beginScrollbarDrag(event);
  }, [beginScrollbarDrag, scrollbarMetrics.thumbWidth, scrollbarMetrics.visible, updateScrollbarMetrics]);

  useEffect(() => {
    if (!isScrollbarDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const el = tabsScrollRef.current;
      const drag = scrollbarDragRef.current;
      if (!el || !drag) return;

      const deltaX = event.clientX - drag.startX;
      const nextScrollLeft = drag.startScrollLeft +
        (deltaX / drag.maxThumbLeft) * drag.maxScrollLeft;
      el.scrollLeft = Math.min(drag.maxScrollLeft, Math.max(0, nextScrollLeft));
      updateScrollbarMetrics();
    };

    const handlePointerUp = () => {
      scrollbarDragRef.current = null;
      setIsScrollbarDragging(false);
      updateScrollbarMetrics();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isScrollbarDragging, updateScrollbarMetrics]);

  useEffect(() => {
    if (!contextMenu) return;
    if (tabs.some((tab) => tab.kind !== 'home' && tab.id === contextMenu.tabId)) return;
    setContextMenu(null);
  }, [contextMenu, tabs]);

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction) => {
      if (!contextMenu) return;
      switch (action) {
        case 'closeThisTab':
          onCloseTab(contextMenu.tabId);
          break;
        case 'closeTabsToRight':
          onCloseTabsToRight(contextMenu.tabId);
          break;
        case 'closeOtherTabs':
          onCloseOtherTabs(contextMenu.tabId);
          break;
        case 'closeAllTabs':
          onCloseAllTabs();
          break;
      }
    },
    [
      contextMenu,
      onCloseAllTabs,
      onCloseOtherTabs,
      onCloseTab,
      onCloseTabsToRight,
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
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`desktop-tab${active ? ' is-active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
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
                  onCloseTab(tab.id);
                }}
                onDoubleClick={() => startEditing(tab)}
                title={tab.workspacePath ?? getTabLabel(tab)}
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
                    onCloseTab(tab.id);
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
              className="desktop-tabbar__scrollbar-thumb"
              style={{
                width: `${scrollbarMetrics.thumbWidth}px`,
                transform: `translateX(${scrollbarMetrics.thumbLeft}px)`,
              }}
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
      <TooltipButton className="btn btn--icon desktop-tabbar__new" onClick={onNewTab} tooltip={t.tooltips.newTab} icon={<PlusIcon />} />
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
        homeShortcut={state.settings.keybindings?.welcome}
        themeShortcut={state.settings.keybindings?.toggleTheme}
        settingsShortcut={state.settings.keybindings?.settings}
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
        sidebarShortcut={state.settings.keybindings?.toggleSidebar}
        sidebarActive={!state.sidebarCollapsed}
        onSidebarToggle={onSidebarToggle}
        tocLabel={t.actions.toggleToc}
        tocTooltip={t.actions.toggleToc}
        tocShortcut={state.settings.keybindings?.toggleToc}
        tocActive={!state.tocCollapsed && !!state.currentFile && state.toc.length > 0}
        tocToggleDisabled={!state.currentFile || state.toc.length === 0}
        onTocToggle={toggleToc}
        focusModeLabel={t.actions.toggleFocusMode || "Toggle focus mode"}
        focusModeTooltip={t.actions.toggleFocusMode || "Toggle focus mode"}
        focusModeShortcut={state.settings.keybindings?.toggleFocusMode}
        isFocusMode={state.focusMode}
        onFocusModeToggle={toggleFocusMode}
      />
      <div className="desktop-tabbar__window-controls">
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => bridge.postMessage({ command: 'window-minimize' })}
          tooltip={t.tooltips.minimize}
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => bridge.postMessage({ command: 'window-maximize' })}
          tooltip={isMaximized ? t.tooltips.restore : t.tooltips.maximize}
          icon={isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M8 8V3h13v13h-5" />
              <path d="M3 8h13v13H3z" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
          )}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn window-control-btn--close"
          onClick={() => bridge.postMessage({ command: 'window-close' })}
          tooltip={t.tooltips.closeApp}
          tooltipAlign="right"
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
        />
      </div>
    </header>
  );
}

