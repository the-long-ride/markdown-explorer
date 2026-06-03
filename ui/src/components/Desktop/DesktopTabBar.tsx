import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TooltipButton } from '../shared/TooltipButton';
import {
  CloseIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
  SunIcon,
} from '../shared/icons';
import logoUrl from '../../assets/logos/logo-128.png';
import { getTabLabel } from '../../desktop/desktopTabs';
import type { DesktopTab } from '../../desktop/types';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';

const SCROLLBAR_TRACK_INLINE_INSET = 8;

interface DesktopTabBarProps {
  tabs: DesktopTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onAliasChange: (tabId: string, alias: string) => void;
  onSearchOpen: () => void;
  searchShortcutLabel: string;
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
  onAliasChange,
  onSearchOpen,
  searchShortcutLabel,
  onThemeToggle,
  onSettingsOpen,
  onSidebarToggle,
  isDark,
  isMaximized,
  hasUpdate = false,
}: DesktopTabBarProps) {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');
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
      <button
        type="button"
        className={`desktop-tabbar__home${activeTabId === 'home' ? ' is-active' : ''}`}
        aria-label="Home"
        onClick={() => onSelectTab('home')}
      >
        <HomeIcon size={14} />
      </button>
      <div className="desktop-tabbar__tabs-wrap">
        <div
          ref={tabsScrollRef}
          className="desktop-tabbar__tabs"
          role="tablist"
          aria-label="Workspace tabs"
          onScroll={updateScrollbarMetrics}
        >
          {tabs.filter((tab) => tab.kind !== 'home').map((tab) => {
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
      <TooltipButton className="btn btn--icon desktop-tabbar__new" onClick={onNewTab} tooltip={t.tooltips.newTab} icon={<PlusIcon />} />
      <div className="desktop-tabbar__spacer" />
      <button type="button" className="desktop-tabbar__search" onClick={onSearchOpen} aria-label={t.actions.searchAllTabs}>
        <SearchIcon size={13} />
        <span>{t.actions.searchAllTabs}... ({searchShortcutLabel})</span>
      </button>
      <TooltipButton className="btn btn--icon" onClick={onThemeToggle} tooltip={t.topbar.theme} icon={isDark ? <SunIcon /> : <MoonIcon />} />
      <TooltipButton
        className={`btn btn--icon${hasUpdate ? ' has-update' : ''}`}
        onClick={onSettingsOpen}
        tooltip={hasUpdate ? t.topbar.settingsUpdate : t.topbar.settings}
        icon={<SettingsIcon />}
      />
      <TooltipButton className="btn btn--icon" onClick={onSidebarToggle} tooltip={t.topbar.sidebar} icon={<SidebarIcon />} />
      <div className="desktop-tabbar__window-controls">
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })}
          tooltip={t.tooltips.minimize}
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
          tooltip={isMaximized ? t.tooltips.restore : t.tooltips.maximize}
          icon={isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M8 3h13v13H8z" />
              <path d="M16 16v5H3V8h5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
          )}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn window-control-btn--close"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })}
          tooltip={t.tooltips.closeApp}
          tooltipAlign="right"
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
        />
      </div>
    </header>
  );
}
