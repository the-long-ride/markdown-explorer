import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SidebarSortMode } from '../../types';
import { CollapseIcon, ExpandIcon, LocateIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { ClearPinsIcon, SortIcon, SortStatusIcon } from './sidebarPinIcons';
import { SidebarSortMenu } from './SidebarSortMenu';
import { SidebarConfirmDialog } from './SidebarConfirmDialog';

interface SidebarFilesActionsProps {
  canLocate: boolean;
  hasPins: boolean;
  workspaceKey: string;
  locateLabel: string;
  clearPinsLabel: string;
  clearPinsConfirmBody: string;
  cancelLabel: string;
  sortLabel: string;
  sortNameAscLabel: string;
  sortNameDescLabel: string;
  sortModifiedDescLabel: string;
  sortModifiedAscLabel: string;
  collapseLabel: string;
  expandLabel: string;
  locateShortcut?: string;
  sortMode: SidebarSortMode;
  onLocate: () => void;
  onClearPins: () => void;
  onSortChange: (mode: SidebarSortMode) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  leftActions?: ReactNode;
}

export function SidebarFilesActions({
  canLocate,
  hasPins,
  workspaceKey,
  locateLabel,
  clearPinsLabel,
  clearPinsConfirmBody,
  cancelLabel,
  sortLabel,
  sortNameAscLabel,
  sortNameDescLabel,
  sortModifiedDescLabel,
  sortModifiedAscLabel,
  collapseLabel,
  expandLabel,
  locateShortcut,
  sortMode,
  onLocate,
  onClearPins,
  onSortChange,
  onCollapseAll,
  onExpandAll,
  leftActions,
}: SidebarFilesActionsProps) {
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [confirmWorkspaceKey, setConfirmWorkspaceKey] = useState<string | null>(null);
  const clearPinsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sidebar = sortAnchor?.closest('.sidebar') as HTMLElement | null;

  useEffect(() => { setConfirmWorkspaceKey(null); }, [workspaceKey]);
  useEffect(() => { if (!hasPins) setConfirmWorkspaceKey(null); }, [hasPins]);

  const closeClearPinsDialog = () => {
    setConfirmWorkspaceKey(null);
    if (clearPinsTriggerRef.current?.isConnected && !clearPinsTriggerRef.current.disabled) {
      clearPinsTriggerRef.current.focus();
    }
  };

  const confirmClearPins = () => {
    if (confirmWorkspaceKey === workspaceKey && hasPins) onClearPins();
    closeClearPinsDialog();
  };

  const sortStatusLabel =
    sortMode === 'name-asc'
      ? sortNameAscLabel
      : sortMode === 'name-desc'
      ? sortNameDescLabel
      : sortMode === 'modified-desc'
      ? sortModifiedDescLabel
      : sortModifiedAscLabel;

  return (
    <>
    <div className="sidebar__files-actions">
      {leftActions && <div className="sidebar__files-action-group sidebar__files-action-group--left">{leftActions}</div>}
      <div className="sidebar__files-action-group sidebar__files-action-group--right">
        <div className="sidebar__sort-status" title={sortStatusLabel} aria-label={sortStatusLabel}>
          <SortStatusIcon mode={sortMode} size={14} />
        </div>
        <TooltipButton
          type="button"
          className={`btn btn--icon sidebar__files-action sidebar__files-action--sort${sortAnchor ? ' is-open is-active' : ''}`}
          onClick={(event) => setSortAnchor((current) => current ? null : event.currentTarget)}
          tooltip={sortLabel}
          label={sortLabel}
          tooltipPos="below"
          tooltipAlign="left"
          icon={<SortIcon size={14} />}
          aria-haspopup="menu"
          aria-expanded={Boolean(sortAnchor)}
        />
        <TooltipButton
          type="button"
          className="btn btn--icon sidebar__files-action sidebar__files-action--clear-pins"
          onClick={(event) => {
            setSortAnchor(null);
            clearPinsTriggerRef.current = event.currentTarget;
            setConfirmWorkspaceKey(workspaceKey);
          }}
          tooltip={clearPinsLabel}
          label={clearPinsLabel}
          tooltipPos="below"
          icon={<ClearPinsIcon size={14} />}
          disabled={!hasPins}
        />
        <TooltipButton
          type="button"
          className="btn btn--icon sidebar__files-action sidebar__files-action--locate"
          onClick={onLocate}
          tooltip={locateLabel}
          label={locateLabel}
          shortcut={locateShortcut}
          tooltipPos="below"
          icon={<LocateIcon size={13} />}
          disabled={!canLocate}
        />
        <TooltipButton
          type="button"
          className="btn btn--icon sidebar__files-action sidebar__files-action--collapse"
          onClick={onCollapseAll}
          tooltip={collapseLabel}
          label={collapseLabel}
          tooltipPos="below"
          icon={<CollapseIcon size={13} />}
        />
        <TooltipButton
          type="button"
          className="btn btn--icon sidebar__files-action sidebar__files-action--expand"
          onClick={onExpandAll}
          tooltip={expandLabel}
          label={expandLabel}
          tooltipPos="below"
          tooltipAlign="right"
          icon={<ExpandIcon size={13} />}
        />
      </div>
      {sortAnchor && sidebar && (
        <SidebarSortMenu
          anchor={sortAnchor}
          sidebar={sidebar}
          value={sortMode}
          labels={{
            menu: sortLabel,
            nameAsc: sortNameAscLabel,
            nameDesc: sortNameDescLabel,
            modifiedDesc: sortModifiedDescLabel,
            modifiedAsc: sortModifiedAscLabel,
          }}
          onChange={onSortChange}
          onClose={() => setSortAnchor(null)}
        />
      )}
    </div>
    {confirmWorkspaceKey === workspaceKey && hasPins && (
      <SidebarConfirmDialog
        title={clearPinsLabel}
        message={clearPinsConfirmBody}
        cancelLabel={cancelLabel}
        onCancel={closeClearPinsDialog}
        onConfirm={confirmClearPins}
      />
    )}
    </>
  );
}
