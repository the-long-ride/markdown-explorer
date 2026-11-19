import { CheckIcon, CloseIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';

interface SidebarScopeControlsProps {
  editing: boolean;
  hasEntry: boolean;
  count: number;
  total: number;
  allSelected: boolean;
  narrowed?: boolean;
  labels: {
    focus: string;
    applyFocus?: string;
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
  narrowed,
  labels,
  onToggleEditing,
  onToggleAll,
  onClear,
}: SidebarScopeControlsProps) {
  const bulkLabel = allSelected ? labels.uncheckAll : labels.checkAll;
  const isNarrowed = typeof narrowed === 'boolean' ? narrowed : (hasEntry && total > 0 && count < total);
  const focusTooltip = editing && hasEntry ? labels.applyFocus : undefined;
  return (
    <div className="sidebar__scope">
      <button
        type="button"
        className={`sidebar__scope-btn${editing || hasEntry ? ' is-active' : ''}${isNarrowed ? ' is-scope-narrowed' : ''}`}
        onClick={onToggleEditing}
        aria-pressed={editing}
        data-scope-narrowed={isNarrowed ? 'true' : undefined}
        data-hover-tooltip={focusTooltip}
        data-hover-tooltip-pos={focusTooltip ? 'bottom' : undefined}
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
