// =============================================================================
// components/shared/Button.tsx — Reusable button with tooltip
// =============================================================================

import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  tooltipPos?: 'above' | 'below';
  icon?: ReactNode;
  label?: string;
  onlyIcon?: boolean;
}

export function Button({
  tooltip,
  tooltipPos = 'below',
  icon,
  label,
  onlyIcon = true,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = `${className} tooltip-container`.trim();
  const tooltipText = tooltip ?? label ?? '';

  return (
    <button
      className={classes}
      data-tooltip-pos={tooltipPos}
      aria-label={label}
      {...rest}
    >
      {onlyIcon ? (
        icon
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {label && <span className="btn-label">{label}</span>}
        </>
      )}
      {children}
      {tooltipText && <span className="tooltip-text">{tooltipText}</span>}
    </button>
  );
}
