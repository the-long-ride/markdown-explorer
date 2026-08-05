import { useEffect, useMemo, useRef, useState } from 'react';
import { bookmarkStore } from '../../bookmarks/bookmarkStore.ts';
import { renameBookmarkWithVerification } from '../../bookmarks/bookmarkCommands.ts';
import { filterAndSortBookmarks, groupBookmarksByOpenWorkspace } from '../../bookmarks/bookmarkModel.ts';
import type { BookmarkRecord, BookmarkSortMode, OpenBookmarkWorkspace } from '../../bookmarks/types.ts';
import { useBookmarks } from '../../bookmarks/useBookmarks.ts';
import type { Translations } from '../../contexts/translations';
import { CheckIcon, CollapseIcon, ExpandIcon, MoreVerticalIcon, SearchIcon, TrashIcon } from '../shared/icons';
import { SortIcon, SortStatusIcon } from '../Sidebar/sidebarPinIcons';
import { SidebarItemMenu } from '../Sidebar/SidebarItemMenu';
import { BookmarkBatchDeleteDialog } from './BookmarkBatchDeleteDialog';
import { BookmarkDialog } from './BookmarkDialog';
import { BookmarkGroupChevron, BookmarkIcon, SelectionModeIcon, SelectAllIcon } from './BookmarkIcons';
import { BookmarkItemMenu } from './BookmarkItemMenu';
import { TooltipButton } from '../shared/TooltipButton';
import { dispatchActionNotice } from '../../utils/actionNotice.ts';

interface BookmarksPanelProps {
  visible: boolean;
  viewMode: 'focus' | 'tabs';
  workspaces: readonly OpenBookmarkWorkspace[];
  activeWorkspaceKey: string;
  translations: Translations['bookmarks'];
  onNavigate: (bookmark: BookmarkRecord) => void;
}

function bookmarkFailureMessage(template: string, reason: string): string {
  return template.includes('{reason}') ? template.replace('{reason}', reason) : `${template} ${reason}`.trim();
}

export function BookmarksPanel({ visible, viewMode, workspaces, activeWorkspaceKey, translations, onNavigate }: BookmarksPanelProps) {
  const document = useBookmarks();
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useState<BookmarkSortMode>('name-asc');
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([activeWorkspaceKey]));
  const [menu, setMenu] = useState<{ bookmark: BookmarkRecord; anchor: HTMLElement } | null>(null);
  const [renameTarget, setRenameTarget] = useState<BookmarkRecord | null>(null);
  const workspaceSignature = workspaces.map((workspace) => workspace.workspaceKey).join('\n');

  useEffect(() => {
    if (viewMode === 'tabs') setExpanded(new Set(activeWorkspaceKey ? [activeWorkspaceKey] : []));
  }, [activeWorkspaceKey, viewMode, workspaceSignature]);

  useEffect(() => {
    if (!visible) {
      setMenu(null);
      setSortAnchor(null);
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [visible]);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => document.items.some((item) => item.id === id))));
  }, [document.items]);

  const filteredItems = useMemo(() => filterAndSortBookmarks(document.items, filter, sortMode), [document.items, filter, sortMode]);
  const groups = useMemo(() => groupBookmarksByOpenWorkspace(filteredItems, workspaces, activeWorkspaceKey), [activeWorkspaceKey, filteredItems, workspaces]);
  const focusItems = filteredItems.filter((item) => item.workspaceKey === activeWorkspaceKey);
  const visibleBookmarks = useMemo(() => (viewMode === 'tabs' ? filteredItems : focusItems), [viewMode, filteredItems, focusItems]);
  const hasAny = viewMode === 'tabs' ? groups.some((group) => group.bookmarks.length > 0) : focusItems.length > 0;
  const hasStoredForScope = viewMode === 'tabs'
    ? groupBookmarksByOpenWorkspace(document.items, workspaces, activeWorkspaceKey).some((group) => group.bookmarks.length > 0)
    : document.items.some((item) => item.workspaceKey === activeWorkspaceKey);

  const toggleSelectionMode = () => {
    setSelectionMode((current) => !current);
    setSelectedIds(new Set());
    setMenu(null);
  };
  const selectAllBookmarks = () => {
    setSelectedIds(new Set(visibleBookmarks.map((item) => item.id)));
  };
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openMenu = (bookmark: BookmarkRecord, anchor: HTMLElement) => setMenu({ bookmark, anchor });
  const activateItem = (bookmark: BookmarkRecord) => selectionMode ? toggleSelected(bookmark.id) : onNavigate(bookmark);
  const saveRenamedBookmark = (name: string) => {
    if (!renameTarget) return;
    const result = renameBookmarkWithVerification(renameTarget.id, name);
    if (!result.ok) {
      dispatchActionNotice(bookmarkFailureMessage(translations.renameFailed, translations.storageUnavailable), 'error');
      return;
    }
    dispatchActionNotice(translations.renamedSuccess, 'success');
    setRenameTarget(null);
  };

  const renderItem = (bookmark: BookmarkRecord) => (
    <div
      key={bookmark.id}
      className={`bookmark-item${selectedIds.has(bookmark.id) ? ' is-selected' : ''}`}
      tabIndex={0}
      onClick={() => { if (selectionMode) toggleSelected(bookmark.id); }}
      onDoubleClick={() => { if (!selectionMode) onNavigate(bookmark); }}
      onContextMenu={(event) => { event.preventDefault(); if (!selectionMode) openMenu(bookmark, event.currentTarget); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateItem(bookmark); } }}
    >
      {selectionMode ? (
        <input type="checkbox" checked={selectedIds.has(bookmark.id)} aria-label={translations.selectBookmark.replace('{name}', bookmark.name)} onChange={() => toggleSelected(bookmark.id)} onClick={(event) => event.stopPropagation()} />
      ) : <BookmarkIcon size={13} />}
      <div className="bookmark-item__copy">
        <span className="bookmark-item__name">{bookmark.name}</span>
        <span className="bookmark-item__text">{bookmark.renderedText || bookmark.selectedText}</span>
      </div>
      {!selectionMode && (
        <button type="button" className="bookmark-item__menu" aria-label={translations.menuLabel} title={translations.menuLabel} onClick={(event) => { event.stopPropagation(); openMenu(bookmark, event.currentTarget); }}>
          <MoreVerticalIcon size={14} />
        </button>
      )}
    </div>
  );

  const sortStatusLabel =
    sortMode === 'name-asc'
      ? translations.sortNameAsc
      : sortMode === 'name-desc'
      ? translations.sortNameDesc
      : sortMode === 'created-desc'
      ? translations.sortNewest
      : translations.sortOldest;

  return (
    <div ref={panelRef} className="bookmarks-panel">
      <div className="bookmarks-panel__toolbar">
        <div className="bookmarks-panel__search-row">
          <div className="sidebar__search bookmarks-panel__search">
            <SearchIcon size={15} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={translations.searchPlaceholder} aria-label={translations.searchPlaceholder} />
          </div>
        </div>
        <div className="bookmarks-panel__action-row">
          <div className="sidebar__sort-status" title={sortStatusLabel} aria-label={sortStatusLabel}>
            <SortStatusIcon mode={sortMode} size={14} />
          </div>
          <div className="bookmarks-panel__actions">
            {selectionMode && (
              <>
                <TooltipButton type="button" className="btn btn--icon bookmarks-panel__select-all" label={translations.selectAll} tooltip={translations.selectAll} icon={<SelectAllIcon size={14} />} disabled={visibleBookmarks.length === 0} onClick={selectAllBookmarks} />
                <TooltipButton type="button" className="btn btn--icon bookmarks-panel__delete-selected" label={translations.deleteSelected} tooltip={translations.deleteSelected} icon={<TrashIcon size={13} />} disabled={selectedIds.size === 0} onClick={() => setConfirmDelete(true)} />
              </>
            )}
            <TooltipButton type="button" className={`btn btn--icon${selectionMode ? ' is-active' : ''}`} label={translations.toggleSelection} tooltip={translations.toggleSelection} icon={<SelectionModeIcon size={14} />} aria-pressed={selectionMode} onClick={toggleSelectionMode} />
            <TooltipButton
              type="button"
              className={`btn btn--icon${sortAnchor ? ' is-active' : ''}`}
              label={translations.sortLabel}
              tooltip={translations.sortLabel}
              icon={<SortIcon size={14} />}
              aria-haspopup="menu"
              aria-expanded={Boolean(sortAnchor)}
              onClick={(event) => setSortAnchor((current) => (current ? null : event.currentTarget))}
            />
            {viewMode === 'tabs' && <>
              <TooltipButton type="button" className="btn btn--icon" label={translations.collapseAll} tooltip={translations.collapseAll} icon={<CollapseIcon size={13} />} onClick={() => setExpanded(new Set())} />
              <TooltipButton type="button" className="btn btn--icon" label={translations.expandAll} tooltip={translations.expandAll} icon={<ExpandIcon size={13} />} onClick={() => setExpanded(new Set(workspaces.map((workspace) => workspace.workspaceKey)))} />
            </>}
            {sortAnchor && panelRef.current && (
              <SidebarItemMenu
                anchor={sortAnchor}
                sidebar={panelRef.current}
                menuLabel={translations.sortLabel}
                items={[
                  {
                    id: 'sort-name-asc',
                    label: translations.sortNameAsc,
                    icon: sortMode === 'name-asc' ? <CheckIcon size={12} /> : <span aria-hidden="true" />,
                    onSelect: () => setSortMode('name-asc'),
                  },
                  {
                    id: 'sort-name-desc',
                    label: translations.sortNameDesc,
                    icon: sortMode === 'name-desc' ? <CheckIcon size={12} /> : <span aria-hidden="true" />,
                    onSelect: () => setSortMode('name-desc'),
                  },
                  {
                    id: 'sort-created-desc',
                    label: translations.sortNewest,
                    icon: sortMode === 'created-desc' ? <CheckIcon size={12} /> : <span aria-hidden="true" />,
                    onSelect: () => setSortMode('created-desc'),
                  },
                  {
                    id: 'sort-created-asc',
                    label: translations.sortOldest,
                    icon: sortMode === 'created-asc' ? <CheckIcon size={12} /> : <span aria-hidden="true" />,
                    onSelect: () => setSortMode('created-asc'),
                  },
                ]}
                onClose={() => setSortAnchor(null)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="bookmarks-panel__list">
        {viewMode === 'focus' ? focusItems.map(renderItem) : groups.map((group) => {
          const isExpanded = expanded.has(group.workspaceKey);
          return <section key={group.id} className={`bookmark-group${group.active ? ' is-active' : ''}`}>
            <button type="button" className="bookmark-group__header" aria-expanded={isExpanded} title={isExpanded ? translations.collapseAll : translations.expandAll} onClick={() => setExpanded((current) => {
              const next = new Set(current);
              if (next.has(group.workspaceKey)) next.delete(group.workspaceKey); else next.add(group.workspaceKey);
              return next;
            })}>
              <BookmarkGroupChevron expanded={isExpanded} />
              <span className="bookmark-group__name">{group.workspaceName}</span>
              <span className="sidebar__count">{group.bookmarks.length}</span>
            </button>
            {isExpanded && <div className="bookmark-group__items">{group.bookmarks.map(renderItem)}</div>}
          </section>;
        })}
        {!hasAny && <div className="bookmarks-panel__empty">{hasStoredForScope ? translations.noResults : translations.empty}</div>}
      </div>

      {menu && panelRef.current && <BookmarkItemMenu bookmark={menu.bookmark} anchor={menu.anchor} sidebar={panelRef.current} labels={translations} onNavigate={onNavigate} onRename={setRenameTarget} onDelete={(bookmark) => bookmarkStore.remove(bookmark.id)} onClose={() => setMenu(null)} />}
      <BookmarkDialog open={renameTarget !== null} title={translations.dialogEditTitle} label={translations.nameLabel} placeholder={translations.namePlaceholder} initialValue={renameTarget?.name ?? ''} saveLabel={translations.save} cancelLabel={translations.cancel} onClose={() => setRenameTarget(null)} onSave={saveRenamedBookmark} />
      <BookmarkBatchDeleteDialog open={confirmDelete} count={selectedIds.size} title={translations.deleteSelectedTitle} message={translations.deleteSelectedConfirm} cancelLabel={translations.cancel} confirmLabel={translations.deleteSelected} onCancel={() => setConfirmDelete(false)} onConfirm={() => { bookmarkStore.removeMany([...selectedIds]); setSelectedIds(new Set()); setSelectionMode(false); setConfirmDelete(false); }} />
    </div>
  );
}
