import { useCallback, useLayoutEffect, useRef } from 'react';
import type { SidebarTabId } from '../../contexts/appStateModel';
import type { SidebarSearchStatus } from './SidebarSearch';
import type { SidebarTabDescriptor } from './sidebarTabs';

interface SidebarTabsHeaderProps {
  activeTab: SidebarTabId;
  tabs: readonly SidebarTabDescriptor[];
  searchStatus: SidebarSearchStatus;
  onSelect: (tab: SidebarTabId) => void;
}

export function SidebarTabsHeader({
  activeTab,
  tabs,
  searchStatus,
  onSelect,
}: SidebarTabsHeaderProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Partial<Record<SidebarTabId, HTMLButtonElement | null>>>({});
  const iconOnly = tabs.length > 3;

  const positionIndicator = useCallback(() => {
    const activeButton = tabRefs.current[activeTab];
    const indicator = indicatorRef.current;
    if (!activeButton || !indicator) return;
    indicator.style.width = `${activeButton.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeButton.offsetLeft}px)`;
  }, [activeTab]);

  useLayoutEffect(() => {
    positionIndicator();
    const strip = stripRef.current;
    const observer = strip && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(positionIndicator)
      : null;
    if (strip) observer?.observe(strip);
    window.addEventListener('resize', positionIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', positionIndicator);
    };
  }, [positionIndicator, tabs]);

  const activeDescriptor = tabs.find((tab) => tab.id === activeTab);
  return (
    <div className="sidebar__title-row">
      <div className={`sidebar__tab-strip${iconOnly ? ' is-icon-only' : ''}`} ref={stripRef}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[tab.id] = node; }}
            type="button"
            className={`sidebar__tab-btn sidebar__tab-btn--${tab.id}${activeTab === tab.id ? ' is-active' : ''}`}
            aria-label={tab.label}
            title={iconOnly ? tab.label : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.icon}
            {!iconOnly && <span className="sidebar__tab-label">{tab.label}</span>}
          </button>
        ))}
        <span className={`sidebar__tab-indicator is-${activeTab}`} ref={indicatorRef} />
      </div>
      {activeTab === 'search' ? (
        <div className="sidebar__title-actions" key="search-actions">
          {searchStatus.isSearching && <div className="spinner sidebar__search-spinner" />}
          {searchStatus.showCount && <span className="sidebar__count">{searchStatus.resultCount}</span>}
        </div>
      ) : activeDescriptor?.count !== undefined ? (
        <div className="sidebar__title-actions" key={`${activeTab}-actions`}>
          <span className="sidebar__count" id={activeTab === 'files' ? 'fileCount' : undefined}>{activeDescriptor.count}</span>
        </div>
      ) : null}
    </div>
  );
}
