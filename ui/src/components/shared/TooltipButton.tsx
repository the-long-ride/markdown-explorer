// =============================================================================
// components/shared/TooltipButton.tsx — Reusable button with tooltip & 3D keycaps
// =============================================================================

import { useLayoutEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { buildShortcutTooltip } from '../../utils/toolbar-menu.js';
import { useCssVars } from '../../utils/useCssVars';
import { parseShortcutText } from './parseShortcutText';

interface TooltipButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'as'> {
  as?: 'button' | 'span';
  tooltip?: string;
  shortcut?: string;
  tooltipPos?: 'above' | 'below';
  tooltipAlign?: 'center' | 'left' | 'right';
  icon?: ReactNode;
  label?: string;
  onlyIcon?: boolean;
  portalTooltip?: boolean;
}

export function parseTooltipContent(tooltipText?: string, _shortcutProp?: string) {
  if (!tooltipText) return null;
  return parseShortcutText(tooltipText);
}

export function TooltipButton({
  as: Component = 'button',
  type = 'button',
  disabled,
  tooltip,
  shortcut,
  tooltipPos = 'below',
  tooltipAlign = 'center',
  icon,
  label,
  onlyIcon = true,
  portalTooltip = false,
  className = '',
  children,
  onClick,
  ...rest
}: TooltipButtonProps) {
  const classes = `${className} tooltip-container`.trim();
  const tooltipText = buildShortcutTooltip(tooltip ?? label ?? '', shortcut);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalPosition, setPortalPosition] = useState({ left: 0, top: 0, ready: false });
  const { onMouseEnter, onMouseLeave, onFocus, onBlur, ...otherProps } = rest;

  useLayoutEffect(() => {
    if (!portalTooltip || !portalOpen || !tooltipText || typeof window === 'undefined') return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltipNode = tooltipRef.current;
      if (!trigger || !tooltipNode) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltipNode.getBoundingClientRect();
      const gap = 8;
      const edge = 8;
      let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      if (tooltipAlign === 'left') left = triggerRect.left;
      if (tooltipAlign === 'right') left = triggerRect.right - tooltipRect.width;
      let resolvedPos = tooltipPos;
      if (resolvedPos === 'below') {
        if (triggerRect.bottom + gap + tooltipRect.height > window.innerHeight - edge && triggerRect.top - tooltipRect.height - gap >= edge) {
          resolvedPos = 'above';
        }
      } else if (resolvedPos === 'above') {
        if (triggerRect.top - tooltipRect.height - gap < edge && triggerRect.bottom + gap + tooltipRect.height <= window.innerHeight - edge) {
          resolvedPos = 'below';
        }
      }
      let top = resolvedPos === 'below'
        ? triggerRect.bottom + gap
        : triggerRect.top - tooltipRect.height - gap;

      left = Math.max(edge, Math.min(left, window.innerWidth - tooltipRect.width - edge));
      top = Math.max(edge, Math.min(top, window.innerHeight - tooltipRect.height - edge));
      setPortalPosition({ left, top, ready: true });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [portalOpen, portalTooltip, tooltipAlign, tooltipPos, tooltipText]);

  const showPortalTooltip = () => {
    if (portalTooltip && tooltipText) {
      const trigger = triggerRef.current;
      const rect = trigger?.getBoundingClientRect();
      const initialLeft = rect ? rect.left : 0;
      const initialTop = rect ? (tooltipPos === 'below' ? rect.bottom + 8 : rect.top - 8) : 0;
      setPortalPosition({ left: initialLeft, top: initialTop, ready: false });
      setPortalOpen(true);
    }
  };
  const hidePortalTooltip = () => {
    if (portalTooltip) setPortalOpen(false);
  };

  useCssVars(tooltipRef, {
    '--portal-left': `${portalPosition.left}px`,
    '--portal-top': `${portalPosition.top}px`,
    '--portal-visibility': portalPosition.ready ? 'visible' : 'hidden',
  });

  const triggerNode = (
    <Component
      ref={triggerRef as any}
      className={classes}
      data-tooltip-pos={tooltipPos}
      data-tooltip-align={tooltipAlign}
      aria-label={label || tooltip}
      onMouseEnter={(event) => { onMouseEnter?.(event); showPortalTooltip(); }}
      onMouseLeave={(event) => { onMouseLeave?.(event); hidePortalTooltip(); }}
      onFocus={(event) => { onFocus?.(event); showPortalTooltip(); }}
      onBlur={(event) => { onBlur?.(event); hidePortalTooltip(); }}
      onClick={(event: any) => { hidePortalTooltip(); onClick?.(event); }}
      {...(Component === 'button' ? { type, disabled } : { role: (otherProps as any).role ?? 'button', 'aria-disabled': disabled })}
      {...otherProps}
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
      {!portalTooltip && tooltipText && (
        <span className="tooltip-text">
          {parseTooltipContent(tooltipText, shortcut)}
        </span>
      )}
    </Component>
  );

  return (
    <>
      {portalTooltip && Component === 'button' ? (
        <span
          className={disabled ? 'tooltip-disabled-wrap' : 'tooltip-trigger-wrap'}
          onMouseEnter={showPortalTooltip}
          onMouseLeave={hidePortalTooltip}
        >
          {triggerNode}
        </span>
      ) : triggerNode}
      {portalTooltip && portalOpen && tooltipText && typeof document !== 'undefined' && createPortal(
        <span
          ref={tooltipRef}
          className="tooltip-text tooltip-portal"
          aria-hidden="true"
        >
          {parseTooltipContent(tooltipText, shortcut)}
        </span>,
        document.body,
      )}
    </>
  );
}
