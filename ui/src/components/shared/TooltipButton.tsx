// =============================================================================
// components/shared/TooltipButton.tsx — Reusable button with tooltip
// =============================================================================

import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { buildShortcutTooltip } from '../../utils/toolbar-menu.js';

interface TooltipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  shortcut?: string;
  tooltipPos?: 'above' | 'below';
  tooltipAlign?: 'center' | 'left' | 'right';
  icon?: ReactNode;
  label?: string;
  onlyIcon?: boolean;
}

export function TooltipButton({
  tooltip,
  shortcut,
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
  const tooltipText = buildShortcutTooltip(tooltip ?? label ?? '', shortcut);

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
