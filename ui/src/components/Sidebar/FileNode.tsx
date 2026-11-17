import { memo, useCallback } from 'react';
import type { MdFile } from '../../types';
import { MoreVerticalIcon } from '../shared/icons';
import { PinIcon } from './sidebarPinIcons';
import { ScopeCheckbox, SidebarEntryCheckbox } from './SidebarTreeCheckboxes';
import { useResolvedSidebarTreeEntry, useSidebarTreeEntry, type SidebarTreeEntryContextValue } from './sidebarTreeContext';
import { DEFAULT_TREE_ORDERING, type ScopeFocusTreeProps, type TreeOrderingProps, type SidebarItemMenuTarget } from './sidebarTreeModel';

export interface FileNodeProps {
  file: MdFile;
  scopeFocus?: ScopeFocusTreeProps;
  ordering?: TreeOrderingProps;
  cursorMode?: boolean;
  cursorItemId?: string | null;
  onRequestItemMenu?: (target: SidebarItemMenuTarget) => void;
  canRequestItemMenu?: (target: Pick<SidebarItemMenuTarget, 'kind' | 'path'>) => boolean;
  openMenuPath?: string | null;
  itemActionsLabel?: string;
  pinnedLabel?: string;
  onNavigate?: (file: MdFile) => void;
}

function FileNodeView({
  entry,
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
  onNavigate,
}: FileNodeProps & { entry: SidebarTreeEntryContextValue }) {
  const isActive = entry.currentFile === file.fsPath;
  const isCursor = cursorMode && cursorItemId === file.fsPath;
  const displayName = (entry.showTitle ?? true) ? file.title : file.fileName;
  const isChecked = scopeFocus?.selectedFilePaths.has(file.fsPath) ?? true;
  const isPinned = ordering.pinnedKeys.has(`file:${file.fsPath}`);
  const openFile = useCallback(() => {
    entry.rememberFocus('file', file.fsPath);
    if (entry.selectionActive) return entry.toggleSelected('file', file.fsPath);
    if (onNavigate) onNavigate(file);
    else if (entry.navigate) entry.navigate(file.fsPath);
  }, [entry, file, onNavigate]);

  return (
    <div
      className={`tree-file${entry.focusedKey === `file:${file.fsPath}` ? ' is-entry-focused' : ''}${isActive ? ' is-active' : ''}${isCursor ? ' is-cursor' : ''}${isPinned ? ' is-pinned' : ''}${scopeFocus?.editing ? ' is-scope-editing' : ''}${entry.isSelected(`file:${file.fsPath}`) ? ' is-selected' : ''}`}
      data-path={file.fsPath}
      data-title={file.title}
      data-filename={file.fileName}
      data-sidebar-cursor-item="true"
      data-sidebar-kind="file"
      data-sidebar-id={file.fsPath}
      onFocus={(event) => { if (event.target === event.currentTarget) entry.rememberFocus('file', file.fsPath); }}
      onClick={(event) => { if (!document.activeElement?.closest('.sidebar-entry-input')) event.currentTarget.focus(); openFile(); }}
      onKeyDown={(event) => { if (event.key === 'Enter') openFile(); }}
      onContextMenu={(event) => {
        if (onRequestItemMenu && (canRequestItemMenu?.({ kind: 'file', path: file.fsPath }) ?? true)) {
          event.preventDefault();
          event.stopPropagation();
          const target = (event.currentTarget as HTMLElement).querySelector('.sidebar-tree-item__menu-button') as HTMLElement | null;
          onRequestItemMenu({ kind: 'file', path: file.fsPath, anchor: target || (event.currentTarget as HTMLElement) });
        }
      }}
      data-hover-tooltip={file.relativePath}
      data-hover-tooltip-pos="right"
      role="treeitem"
      tabIndex={0}
      aria-selected={isCursor || isActive}
    >
      <SidebarEntryCheckbox kind="file" path={file.fsPath} name={displayName} />
      {entry.renameKey === `file:${file.fsPath}` ? entry.renameInput : <span className="tree-file__name">{displayName}</span>}
      {isPinned && (
        <span className="sidebar-tree-item__pin" data-hover-tooltip={pinnedLabel} aria-label={pinnedLabel}>
          <PinIcon size={12} />
        </span>
      )}
      {onRequestItemMenu && itemActionsLabel
        && (canRequestItemMenu?.({ kind: 'file', path: file.fsPath }) ?? true) && (
        <button
          type="button"
          className={`sidebar-tree-item__menu-button${openMenuPath === file.fsPath ? ' is-open' : ''}`}
          aria-label={itemActionsLabel.replace('{name}', displayName)}
          data-hover-tooltip={itemActionsLabel.replace('{name}', displayName)}
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

const MemoizedFileNodeView = memo(FileNodeView);

function FileNodeWithAppState(props: FileNodeProps) {
  const entry = useResolvedSidebarTreeEntry();
  return <MemoizedFileNodeView {...props} entry={entry} />;
}

export function FileNode(props: FileNodeProps) {
  const entry = useSidebarTreeEntry();
  if (!entry || entry.currentFile === undefined) {
    return <FileNodeWithAppState {...props} />;
  }
  return <MemoizedFileNodeView {...props} entry={entry} />;
}
