import { useCallback, useLayoutEffect, useRef } from 'react';
import type { SidebarSearchStatus } from './SidebarSearch';
import { SearchIcon, FolderIcon } from '../shared/icons';
import { BookmarkIcon } from '../Bookmarks/BookmarkIcons';

type SidebarTab = 'files' | 'search' | 'bookmarks';

interface SidebarTabsHeaderProps {
  activeTab: SidebarTab;
  bookmarksEnabled: boolean;
  fileCount: number;
  bookmarkCount: number;
  searchStatus: SidebarSearchStatus;
  filesLabel: string;
  searchLabel: string;
  bookmarksLabel: string;
  onSelect: (tab: SidebarTab) => void;
}

export function SidebarTabsHeader({
  activeTab,
  bookmarksEnabled,
  fileCount,
  bookmarkCount,
  searchStatus,
  filesLabel,
  searchLabel,
  bookmarksLabel,
  onSelect,
}: SidebarTabsHeaderProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Record<SidebarTab, HTMLButtonElement | null>>({ files: null, search: null, bookmarks: null });

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
  }, [bookmarksEnabled, bookmarksLabel, filesLabel, positionIndicator, searchLabel]);

  const isFiles = activeTab === 'files';
  const isSearch = activeTab === 'search';
  const isBookmarks = activeTab === 'bookmarks';
  return (
    <div className="sidebar__title-row">
      <div className="sidebar__tab-strip" ref={stripRef}>
        <button ref={(node) => { tabRefs.current.files = node; }} type="button" className={`sidebar__tab-btn${isFiles ? ' is-active' : ''}`} onClick={() => onSelect('files')}>
          <FolderIcon size={14} /><span>{filesLabel}</span>
        </button>
        <button ref={(node) => { tabRefs.current.search = node; }} type="button" className={`sidebar__tab-btn${isSearch ? ' is-active' : ''}`} onClick={() => onSelect('search')}>
          <SearchIcon size={14} /><span>{searchLabel}</span>
        </button>
        {bookmarksEnabled && (
          <button ref={(node) => { tabRefs.current.bookmarks = node; }} type="button" className={`sidebar__tab-btn${isBookmarks ? ' is-active' : ''}`} onClick={() => onSelect('bookmarks')}>
            <BookmarkIcon size={14} /><span>{bookmarksLabel}</span>
          </button>
        )}
        <span className="sidebar__tab-indicator" ref={indicatorRef} />
      </div>
      {isFiles ? (
        <div className="sidebar__title-actions" key="files-actions"><span className="sidebar__count" id="fileCount">{fileCount}</span></div>
      ) : isSearch ? (
        <div className="sidebar__title-actions" key="search-actions">
          {searchStatus.isSearching && <div className="spinner sidebar__search-spinner" />}
          {searchStatus.showCount && <span className="sidebar__count">{searchStatus.resultCount}</span>}
        </div>
      ) : (
        <div className="sidebar__title-actions" key="bookmarks-actions"><span className="sidebar__count">{bookmarkCount}</span></div>
      )}
    </div>
  );
}
