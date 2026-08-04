import { useState } from 'react';
import type { SidebarSortMode } from '../../types';
import { CollapseIcon, ExpandIcon, LocateIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { ClearPinsIcon, SortIcon } from './sidebarPinIcons';
import { SidebarSortMenu } from './SidebarSortMenu';

interface SidebarFilesActionsProps {
  canLocate: boolean;
  hasPins: boolean;
  locateLabel: string;
  clearPinsLabel: string;
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
}

export function SidebarFilesActions({
  canLocate,
  hasPins,
  locateLabel,
  clearPinsLabel,
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
}: SidebarFilesActionsProps) {
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const sidebar = sortAnchor?.closest('.sidebar') as HTMLElement | null;

  return (
    <div className="sidebar__files-actions">
      <TooltipButton
        type="button"
        className={`sidebar__files-action sidebar__files-action--sort${sortAnchor ? ' is-open' : ''}`}
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
        className="sidebar__files-action sidebar__files-action--clear-pins"
        onClick={onClearPins}
        tooltip={clearPinsLabel}
        label={clearPinsLabel}
        tooltipPos="below"
        icon={<ClearPinsIcon size={14} />}
        disabled={!hasPins}
      />
      <TooltipButton
        type="button"
        className="sidebar__files-action sidebar__files-action--locate"
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
        className="sidebar__files-action sidebar__files-action--collapse"
        onClick={onCollapseAll}
        tooltip={collapseLabel}
        label={collapseLabel}
        tooltipPos="below"
        icon={<CollapseIcon size={13} />}
      />
      <TooltipButton
        type="button"
        className="sidebar__files-action sidebar__files-action--expand"
        onClick={onExpandAll}
        tooltip={expandLabel}
        label={expandLabel}
        tooltipPos="below"
        tooltipAlign="right"
        icon={<ExpandIcon size={13} />}
      />
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
  );
}
