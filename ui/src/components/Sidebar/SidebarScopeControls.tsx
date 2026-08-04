import { CheckIcon, CloseIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';

interface SidebarScopeControlsProps {
  editing: boolean;
  hasEntry: boolean;
  count: number;
  total: number;
  allSelected: boolean;
  labels: {
    focus: string;
    clear: string;
    checkAll: string;
    uncheckAll: string;
  };
  onToggleEditing: () => void;
  onToggleAll: () => void;
  onClear: () => void;
}

export function SidebarScopeControls({
  editing,
  hasEntry,
  count,
  total,
  allSelected,
  labels,
  onToggleEditing,
  onToggleAll,
  onClear,
}: SidebarScopeControlsProps) {
  const bulkLabel = allSelected ? labels.uncheckAll : labels.checkAll;
  return (
    <div className="sidebar__scope">
      <button
        type="button"
        className={`sidebar__scope-btn${editing || hasEntry ? ' is-active' : ''}`}
        onClick={onToggleEditing}
        aria-pressed={editing}
      >
        <span>{labels.focus}</span>
        <span className="sidebar__scope-count">{count}/{total}</span>
      </button>
      {editing && total > 0 && (
        <TooltipButton
          type="button"
          className="sidebar__scope-toggle-all"
          onClick={onToggleAll}
          tooltip={bulkLabel}
          label={bulkLabel}
          tooltipPos="below"
          tooltipAlign="right"
          icon={allSelected ? <CloseIcon size={13} /> : <CheckIcon size={13} />}
        />
      )}
      {hasEntry && (
        <TooltipButton
          type="button"
          className="sidebar__scope-clear"
          onClick={onClear}
          tooltip={labels.clear}
          tooltipPos="below"
          tooltipAlign="right"
          icon={<CloseIcon size={12} />}
        />
      )}
    </div>
  );
}
