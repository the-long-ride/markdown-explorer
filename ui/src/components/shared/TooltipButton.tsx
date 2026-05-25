// =============================================================================
// components/shared/TooltipButton.tsx — Reusable button with tooltip
// =============================================================================

import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface TooltipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  tooltipPos?: 'above' | 'below';
  tooltipAlign?: 'center' | 'right';
  icon?: ReactNode;
  label?: string;
  onlyIcon?: boolean;
}

export function TooltipButton({
  tooltip,
  tooltipPos = 'below',
  tooltipAlign = 'center',
  icon,
  label,
  onlyIcon = true,
  className = '',
  children,
  ...rest
}: TooltipButtonProps) {
  const classes = `${className} tooltip-container`.trim();
  const tooltipText = tooltip ?? label ?? '';

  return (
    <button
      className={classes}
      data-tooltip-pos={tooltipPos}
      data-tooltip-align={tooltipAlign}
      aria-label={label || tooltip}
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
