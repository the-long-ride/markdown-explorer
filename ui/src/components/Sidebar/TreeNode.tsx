import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { FolderNode, MdFile } from '../../types';
import { FolderIcon, FolderChevronIcon, MoreVerticalIcon } from '../shared/icons';
import { PinIcon } from './sidebarPinIcons';
import { ScopeCheckbox, SidebarEntryCheckbox } from './SidebarTreeCheckboxes';
import { sidebarTreeForcesOpen, useSidebarTreeEntry } from './sidebarTreeContext';
import { orderSidebarLevel } from './sidebarTreeOrdering';
import { FileNode } from './FileNode';
import { DEFAULT_TREE_ORDERING, folderHasVisibleContent, isFileVisible, getFolderFilePaths, getFolderSelectionState, type ScopeFocusTreeProps, type TreeOrderingProps, type SidebarItemMenuTarget, type FolderExpansionCommand } from './sidebarTreeModel';
export { FileNode } from './FileNode';
export { DEFAULT_TREE_ORDERING } from './sidebarTreeModel';
export type { ScopeFocusTreeProps, TreeOrderingProps, SidebarItemMenuTarget, FolderExpansionCommand } from './sidebarTreeModel';

export function FolderNodeView({
  node,
  filter,
  scopeFocus,
  ordering = DEFAULT_TREE_ORDERING,
  cursorMode = false,
  cursorItemId = null,
  onRequestItemMenu,
  canRequestItemMenu,
  openMenuPath = null,
  itemActionsLabel,
  pinnedLabel = 'Pinned',
  activeFolderPaths,
  locateRequest = 0,
  expansionCommand,
  onNavigate,
}: {
  node: FolderNode;
  filter: string;
  scopeFocus: ScopeFocusTreeProps;
  ordering: TreeOrderingProps;
  cursorMode?: boolean;
  cursorItemId?: string | null;
  onRequestItemMenu?: (target: SidebarItemMenuTarget) => void;
  canRequestItemMenu?: (target: Pick<SidebarItemMenuTarget, 'kind' | 'path'>) => boolean;
  openMenuPath?: string | null;
  itemActionsLabel?: string;
  pinnedLabel?: string;
  activeFolderPaths?: ReadonlySet<string>;
  locateRequest?: number;
  expansionCommand?: FolderExpansionCommand;
  onNavigate?: (file: MdFile) => void;
}) {
  const [isOpen, setIsOpen] = useState(() => expansionCommand?.expanded ?? true);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);
  const entry = useSidebarTreeEntry();
  const forcedOpen = entry ? sidebarTreeForcesOpen(entry, node.path) : false;
  const activate = () => {
    entry?.rememberFocus('folder', node.path);
    if (entry?.selectionActive) return entry.toggleSelected('folder', node.path);
    if (isOpen) entry?.onFolderCollapsed?.(node.path);
    toggle();
  };
  const { state } = useAppState();
  const q = filter.toLowerCase().trim();
  const containsActiveFile = activeFolderPaths?.has(node.path) ?? false;
  const lastExpandedFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (expansionCommand && expansionCommand.version > 0) {
      setIsOpen(expansionCommand.expanded);
    }
  }, [expansionCommand]);

  useEffect(() => {
    if (state.currentFile && containsActiveFile) {
      if (lastExpandedFileRef.current !== state.currentFile) {
        lastExpandedFileRef.current = state.currentFile;
        setIsOpen(true);
      }
    } else {
      lastExpandedFileRef.current = null;
    }
  }, [containsActiveFile, state.currentFile]);

  useEffect(() => {
    if (locateRequest > 0 && containsActiveFile) setIsOpen(true);
  }, [containsActiveFile, locateRequest]);

  // Declared after the expansion effects so a forced-open path wins over a collapse command on mount.
  useEffect(() => { if (forcedOpen) setIsOpen(true); }, [forcedOpen]);

  const folderSelectionState = scopeFocus.editing
    ? getFolderSelectionState(node, scopeFocus.selectedFilePaths)
    : { totalCount: 0, selectedCount: 0 };
  const folderChecked = folderSelectionState.totalCount > 0
    && folderSelectionState.selectedCount === folderSelectionState.totalCount;
  const folderIndeterminate = folderSelectionState.selectedCount > 0
    && folderSelectionState.selectedCount < folderSelectionState.totalCount;
  const hasVisibilityFilter = Boolean(q) || scopeFocus.hideUnselected;
  if (hasVisibilityFilter && !folderHasVisibleContent(node, q, scopeFocus)) return null;

  const visibleFiles = !isOpen
    ? []
    : hasVisibilityFilter
      ? node.files.filter((file) => isFileVisible(file, q, scopeFocus))
      : node.files;
  const visibleChildren = !isOpen
    ? []
    : hasVisibilityFilter
      ? node.children.filter((child) => folderHasVisibleContent(child, q, scopeFocus))
      : node.children;
  const unpinnedFiles = ordering.pinnedKeys.size
    ? visibleFiles.filter((file) => !ordering.pinnedKeys.has(`file:${file.fsPath}`))
    : visibleFiles;
  const unpinnedChildren = ordering.pinnedKeys.size
    ? visibleChildren.filter((child) => !ordering.pinnedKeys.has(`folder:${child.path}`))
    : visibleChildren;
  const orderedItems = isOpen
    ? orderSidebarLevel(unpinnedFiles, unpinnedChildren, {
      ...ordering,
      showTitle: state.settings.showTitle,
    })
    : [];
  const folderCursorId = `folder:${node.path}`;
  const isCursor = cursorMode && cursorItemId === folderCursorId;
  const isPinned = ordering.pinnedKeys.has(`folder:${node.path}`);

  return (
    <div
      className={`tree-folder${isOpen ? ' is-open' : ''}${isPinned ? ' is-pinned' : ''}${scopeFocus.editing ? ' is-scope-editing' : ''}`}
      role="treeitem"
    >
      <div
        className={`tree-folder__header${entry?.focusedKey === `folder:${node.path}` ? ' is-entry-focused' : ''}${isCursor ? ' is-cursor' : ''}${entry?.isSelected(`folder:${node.path}`) ? ' is-selected' : ''}`}
        onFocus={(event) => { if (event.target === event.currentTarget) entry?.rememberFocus('folder', node.path); }}
        onClick={(event) => { if (!document.activeElement?.closest('.sidebar-entry-input')) event.currentTarget.focus(); activate(); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        }}
        onContextMenu={(event) => {
          if (onRequestItemMenu && (canRequestItemMenu?.({ kind: 'folder', path: node.path }) ?? true)) {
            event.preventDefault();
            event.stopPropagation();
            const target = (event.currentTarget as HTMLElement).querySelector('.sidebar-tree-item__menu-button') as HTMLElement | null;
            onRequestItemMenu({ kind: 'folder', path: node.path, anchor: target || (event.currentTarget as HTMLElement) });
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        data-sidebar-cursor-item="true"
        data-sidebar-kind="folder"
        data-sidebar-id={folderCursorId}
      >
        <SidebarEntryCheckbox kind="folder" path={node.path} name={node.name} />
        <span
          className="tree-folder__chevron"
          aria-hidden="true"
          onClick={entry?.selectionActive ? (event) => { event.stopPropagation(); toggle(); } : undefined}
        ><FolderChevronIcon /></span>
        <FolderIcon />
        {entry?.renameKey === `folder:${node.path}` ? entry.renameInput : <span className="tree-folder__name">{node.name}</span>}
        {isPinned && (
          <span className="sidebar-tree-item__pin" title={pinnedLabel} aria-label={pinnedLabel}>
            <PinIcon size={12} />
          </span>
        )}
        {onRequestItemMenu && itemActionsLabel
          && (canRequestItemMenu?.({ kind: 'folder', path: node.path }) ?? true) && (
          <button
            type="button"
            className={`sidebar-tree-item__menu-button${openMenuPath === node.path ? ' is-open' : ''}`}
            aria-label={itemActionsLabel.replace('{name}', node.name)}
            title={itemActionsLabel.replace('{name}', node.name)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestItemMenu({ kind: 'folder', path: node.path, anchor: event.currentTarget });
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <MoreVerticalIcon />
          </button>
        )}
        {scopeFocus.editing && (
          <ScopeCheckbox
            checked={folderChecked}
            indeterminate={folderIndeterminate}
            label={`Show ${node.name}`}
            onChange={(checked) => scopeFocus.onFolderChange(getFolderFilePaths(node), checked)}
          />
        )}
      </div>
      {isOpen && (
        <div className="tree-folder__children" role="group">
          {entry?.inlineParentPath === node.path && entry.inlineInput}
          {orderedItems.map((item) => item.kind === 'file' ? (
            <FileNode
              key={item.key}
              file={item.file}
              scopeFocus={scopeFocus}
              ordering={ordering}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={onRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={openMenuPath}
              itemActionsLabel={itemActionsLabel}
              pinnedLabel={pinnedLabel}
              onNavigate={onNavigate}
            />
          ) : (
            <FolderNodeView
              key={item.key}
              node={item.folder}
              filter={filter}
              scopeFocus={scopeFocus}
              ordering={ordering}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={onRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={openMenuPath}
              itemActionsLabel={itemActionsLabel}
              pinnedLabel={pinnedLabel}
              activeFolderPaths={activeFolderPaths}
              locateRequest={locateRequest}
              expansionCommand={expansionCommand}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
