import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { TooltipButton } from '../shared/TooltipButton';

type TooltipPosition = 'above' | 'below';
type TooltipAlignment = 'center' | 'left' | 'right';

interface SettingsOutlineButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
  tooltip?: string;
  shortcut?: string;
  iconOnly?: boolean;
  tooltipPos?: TooltipPosition;
  tooltipAlign?: TooltipAlignment;
}

export function SettingsOutlineButton({
  icon,
  label,
  tooltip,
  shortcut,
  iconOnly = false,
  tooltipPos = 'below',
  tooltipAlign = 'center',
  className = '',
  children,
  ...buttonProps
}: SettingsOutlineButtonProps) {
  return (
    <TooltipButton
      {...buttonProps}
      className={`settings-outline-button${iconOnly ? ' settings-outline-button--icon' : ''}${className ? ` ${className}` : ''}`}
      tooltip={tooltip ?? label}
      shortcut={shortcut}
      tooltipPos={tooltipPos}
      tooltipAlign={tooltipAlign}
      icon={icon}
      label={iconOnly ? undefined : label}
      onlyIcon={iconOnly}
    >
      {children}
    </TooltipButton>
  );
}
