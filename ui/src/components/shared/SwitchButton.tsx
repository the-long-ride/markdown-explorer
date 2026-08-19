import type { ButtonHTMLAttributes } from 'react';
export { createSwitchButtonElement } from '../../dom/switchButtonElement';
export type { DomSwitchButtonOptions } from '../../dom/switchButtonElement';

export interface SwitchButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'aria-checked'> {
  checked: boolean;
  label: string;
}

export function SwitchButton({ checked, label, className = '', disabled, ...rest }: SwitchButtonProps) {
  return (
    <button
      type="button"
      className={`app-switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      {...rest}
    >
      <span className="app-switch__thumb" aria-hidden="true" />
    </button>
  );
}
