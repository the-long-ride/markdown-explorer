import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';
import { parseShortcutText } from '../shared/parseShortcutText';

interface PreferenceDescriptionTooltipProps {
  id: string;
  description: string;
  anchor: HTMLElement | null;
  visible: boolean;
}

const TOOLTIP_GAP = 8;
const VIEWPORT_MARGIN = 12;

export function PreferenceDescriptionTooltip({
  id,
  description,
  anchor,
  visible,
}: PreferenceDescriptionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; placement: 'top' | 'bottom'; arrowLeft: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchor || typeof window === 'undefined') {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      const tooltipHeight = tooltipRect?.height || 64;
      const tooltipWidth = tooltipRect?.width || 280;

      const modalElement = anchor.closest('.settings-card--settings') || anchor.closest('.settings-modal');
      const modalRect = modalElement ? modalElement.getBoundingClientRect() : {
        top: 0,
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Preferred placement: ABOVE option (using viewport Y coordinates)
      const topAbove = rect.top - tooltipHeight - TOOLTIP_GAP;
      const minTopAllowed = modalRect.top + 12;

      let top = topAbove;
      let placement: 'top' | 'bottom' = 'top';

      // If placing above would exceed the settings modal top boundary, flip to bottom of option
      if (topAbove < minTopAllowed) {
        placement = 'bottom';
        top = rect.bottom + TOOLTIP_GAP;
      }

      // Horizontal position: align to option row left, clamped within modal bounds
      let left = rect.left;
      const minLeft = Math.max(VIEWPORT_MARGIN, modalRect.left + 12);
      const maxLeft = Math.min(window.innerWidth - tooltipWidth - VIEWPORT_MARGIN, modalRect.right - tooltipWidth - 12);
      left = Math.max(minLeft, Math.min(left, maxLeft));

      // Calculate arrow position relative to tooltip container pointing at option target
      const targetX = rect.left + 24;
      let arrowLeft = targetX - left;
      arrowLeft = Math.max(14, Math.min(tooltipWidth - 22, arrowLeft));

      setPosition({ left, top, placement, arrowLeft });
    };

    updatePosition();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition);
    resizeObserver?.observe(anchor);
    if (tooltipRef.current) resizeObserver?.observe(tooltipRef.current);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchor, description, visible]);

  const cssVariables = useMemo(() => {
    if (!position) return {};
    return {
      '--preference-tooltip-left': `${position.left}px`,
      '--preference-tooltip-top': `${position.top}px`,
      '--preference-tooltip-arrow-left': `${position.arrowLeft}px`,
    };
  }, [position]);
  useCssVars(tooltipRef, cssVariables);

  if (!visible || !anchor || typeof document === 'undefined') return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      data-placement={position?.placement || 'top'}
      className={`settings-preference-description-panel ${position ? 'is-visible' : ''} settings-preference-description-panel--${position?.placement || 'top'}`}
      role="tooltip"
    >
      {parseShortcutText(description)}
    </div>,
    portalTarget,
  );
}
