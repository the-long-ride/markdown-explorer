import type { ButtonHTMLAttributes } from 'react';
export { createSwitchButtonElement } from '../../dom/switchButtonElement';
export type { DomSwitchButtonOptions } from '../../dom/switchButtonElement';

export interface SwitchButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'aria-checked'> {
  checked: boolean;
  label: string;
  tooltip?: string;
  tooltipPos?: 'above' | 'below';
  tooltipAlign?: 'center' | 'left' | 'right';
}

export function SwitchButton({
  checked,
  label,
  className = '',
  disabled,
  tooltip,
  tooltipPos = 'below',
  tooltipAlign = 'center',
  title,
  children,
  ...rest
}: SwitchButtonProps) {
  const tooltipText = tooltip || title;
  const classes = `app-switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}${tooltipText ? ' tooltip-container' : ''}`;
  return (
    <button
      type="button"
      className={classes}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-tooltip-pos={tooltipText ? tooltipPos : undefined}
      data-tooltip-align={tooltipText && tooltipAlign !== 'center' ? tooltipAlign : undefined}
      {...rest}
    >
      <span className="app-switch__thumb" aria-hidden="true" />
      {children}
      {tooltipText && <span className="tooltip-text">{tooltipText}</span>}
    </button>
  );
}
