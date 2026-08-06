// =============================================================================
// components/Sidebar/TreeNode.tsx — Recursive file/folder tree node
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { FolderNode, MdFile, SidebarSortMode } from '../../types';
import { FolderIcon, FolderChevronIcon, MoreVerticalIcon } from '../shared/icons';
import { PinIcon } from './sidebarPinIcons';
import { orderSidebarLevel } from './sidebarTreeOrdering';

export interface SidebarItemMenuTarget {
  kind: 'file' | 'folder';
  path: string;
  anchor: HTMLElement;
}

export interface ScopeFocusTreeProps {
  editing: boolean;
  hideUnselected: boolean;
  selectedFilePaths: Set<string>;
  onFileChange: (filePath: string, checked: boolean) => void;
  onFolderChange: (filePaths: readonly string[], checked: boolean) => void;
}

export interface TreeOrderingProps {
  pinnedKeys: ReadonlySet<string>;
  sortMode: SidebarSortMode;
}

export const DEFAULT_TREE_ORDERING: TreeOrderingProps = {
  pinnedKeys: new Set(),
  sortMode: 'name-asc',
};

export interface FolderExpansionCommand {
  version: number;
  expanded: boolean;
}

function matchesFileSearch(file: MdFile, q: string): boolean {
  if (!q) return true;
  return file.title.toLowerCase().includes(q)
    || file.relativePath.toLowerCase().includes(q);
}

function getFolderFilePaths(node: FolderNode): string[] {
  return [
    ...node.files.map((file) => file.fsPath),
    ...node.children.flatMap(getFolderFilePaths),
  ];
}

function getFolderSelectionState(
  node: FolderNode,
  selectedFilePaths: ReadonlySet<string>,
): { totalCount: number; selectedCount: number } {
  let totalCount = node.files.length;
  let selectedCount = node.files.reduce(
    (count, file) => count + (selectedFilePaths.has(file.fsPath) ? 1 : 0),
    0,
  );
  for (const child of node.children) {
    const childState = getFolderSelectionState(child, selectedFilePaths);
    totalCount += childState.totalCount;
    selectedCount += childState.selectedCount;
  }
  return { totalCount, selectedCount };
}

function isFileVisible(file: MdFile, q: string, scopeFocus: ScopeFocusTreeProps): boolean {
  if (!matchesFileSearch(file, q)) return false;
  return !scopeFocus.hideUnselected || scopeFocus.selectedFilePaths.has(file.fsPath);
}

function folderHasVisibleContent(
  node: FolderNode,
  q: string,
  scopeFocus: ScopeFocusTreeProps,
): boolean {
  if (!q && !scopeFocus.hideUnselected) return true;
  return node.files.some((file) => isFileVisible(file, q, scopeFocus))
    || node.children.some((child) => folderHasVisibleContent(child, q, scopeFocus));
}

function ScopeCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="scope-focus-checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}

export function FileNode({
  file,
  scopeFocus,
  ordering = DEFAULT_TREE_ORDERING,
  cursorMode = false,
  cursorItemId = null,
  onRequestItemMenu,
  canRequestItemMenu,
  openMenuPath = null,
  itemActionsLabel,
  pinnedLabel = 'Pinned',
}: {
  file: MdFile;
  scopeFocus?: ScopeFocusTreeProps;
  ordering: TreeOrderingProps;
  cursorMode?: boolean;
  cursorItemId?: string | null;
  onRequestItemMenu?: (target: SidebarItemMenuTarget) => void;
  canRequestItemMenu?: (target: Pick<SidebarItemMenuTarget, 'kind' | 'path'>) => boolean;
  openMenuPath?: string | null;
  itemActionsLabel?: string;
  pinnedLabel?: string;
}) {
  const { state, navigate } = useAppState();
  const isActive = state.currentFile === file.fsPath;
  const isCursor = cursorMode && cursorItemId === file.fsPath;
  const displayName = state.settings.showTitle ? file.title : file.fileName;
  const isChecked = scopeFocus?.selectedFilePaths.has(file.fsPath) ?? true;
  const isPinned = ordering.pinnedKeys.has(`file:${file.fsPath}`);

  return (
    <div
      className={`tree-file${isActive ? ' is-active' : ''}${isCursor ? ' is-cursor' : ''}${isPinned ? ' is-pinned' : ''}${scopeFocus?.editing ? ' is-scope-editing' : ''}`}
      data-path={file.fsPath}
      data-title={file.title}
      data-filename={file.fileName}
      data-sidebar-cursor-item="true"
      data-sidebar-kind="file"
      data-sidebar-id={file.fsPath}
      onClick={() => navigate(file.fsPath)}
      onKeyDown={(event) => { if (event.key === 'Enter') navigate(file.fsPath); }}
      onContextMenu={(event) => {
        if (onRequestItemMenu && (canRequestItemMenu?.({ kind: 'file', path: file.fsPath }) ?? true)) {
          event.preventDefault();
          event.stopPropagation();
          const target = (event.currentTarget as HTMLElement).querySelector('.sidebar-tree-item__menu-button') as HTMLElement | null;
          onRequestItemMenu({ kind: 'file', path: file.fsPath, anchor: target || (event.currentTarget as HTMLElement) });
        }
      }}
      title={file.relativePath}
      role="treeitem"
      tabIndex={0}
      aria-selected={isCursor || isActive}
    >
      <span className="tree-file__name">{displayName}</span>
      {isPinned && (
        <span className="sidebar-tree-item__pin" title={pinnedLabel} aria-label={pinnedLabel}>
          <PinIcon size={10} />
        </span>
      )}
      {onRequestItemMenu && itemActionsLabel
        && (canRequestItemMenu?.({ kind: 'file', path: file.fsPath }) ?? true) && (
        <button
          type="button"
          className={`sidebar-tree-item__menu-button${openMenuPath === file.fsPath ? ' is-open' : ''}`}
          aria-label={itemActionsLabel.replace('{name}', displayName)}
          title={itemActionsLabel.replace('{name}', displayName)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRequestItemMenu({ kind: 'file', path: file.fsPath, anchor: event.currentTarget });
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreVerticalIcon />
        </button>
      )}
      {scopeFocus?.editing && (
        <ScopeCheckbox
          checked={isChecked}
          label={`Show ${displayName}`}
          onChange={(checked) => scopeFocus.onFileChange(file.fsPath, checked)}
        />
      )}
    </div>
  );
}

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
}) {
  const [isOpen, setIsOpen] = useState(() => expansionCommand?.expanded ?? true);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);
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
        className={`tree-folder__header${isCursor ? ' is-cursor' : ''}`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
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
        <span className="tree-folder__chevron" aria-hidden="true"><FolderChevronIcon /></span>
        <FolderIcon />
        <span className="tree-folder__name">{node.name}</span>
        {isPinned && (
          <span className="sidebar-tree-item__pin" title={pinnedLabel} aria-label={pinnedLabel}>
            <PinIcon size={10} />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
