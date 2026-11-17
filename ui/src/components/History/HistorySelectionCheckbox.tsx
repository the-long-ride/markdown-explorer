import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from '../shared/CheckboxIcons';
import { TooltipButton } from '../shared/TooltipButton';

interface HistorySelectionCheckboxProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
}

export function HistorySelectionCheckbox({ checked, label, onToggle }: HistorySelectionCheckboxProps) {
  return (
    <TooltipButton
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="document-history-panel__select"
      tooltip={label}
      tooltipPos="below"
      tooltipAlign="left"
      portalTooltip
      icon={checked ? <CheckboxCheckedIcon size={18} /> : <CheckboxUncheckedIcon size={18} />}
      onClick={onToggle}
    />
  );
}
