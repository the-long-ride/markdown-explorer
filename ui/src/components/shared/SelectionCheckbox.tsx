import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from './CheckboxIcons';
import './SelectionCheckbox.css';

interface SelectionCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
  onChange: (checked: boolean) => void;
}

export function SelectionCheckbox({ checked, disabled = false, label, className = '', onChange }: SelectionCheckboxProps) {
  return (
    <span className={`selection-checkbox ${className}`} onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <span className="selection-checkbox__icon" aria-hidden="true">
        {checked ? <CheckboxCheckedIcon size={18} /> : <CheckboxUncheckedIcon size={18} />}
      </span>
    </span>
  );
}
