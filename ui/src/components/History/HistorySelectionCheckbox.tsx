import { TooltipButton } from '../shared/TooltipButton';

interface HistorySelectionCheckboxProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
}

// Visual reference: SVG Repo Checkbox Checked, CC0
// https://www.svgrepo.com/svg/309414/checkbox-checked
function CheckedIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 12 3 3 7-7"/></svg>;
}

function UncheckedIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
}

export function HistorySelectionCheckbox({ checked, label, onToggle }: HistorySelectionCheckboxProps) {
  return (
    <TooltipButton
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="document-history-panel__select"
      tooltip={label}
      icon={checked ? <CheckedIcon /> : <UncheckedIcon />}
      onClick={onToggle}
    />
  );
}
