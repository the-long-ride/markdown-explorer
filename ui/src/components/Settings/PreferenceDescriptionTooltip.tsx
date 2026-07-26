import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';

interface PreferenceDescriptionTooltipProps {
  id: string;
  description: string;
  anchor: HTMLElement | null;
  visible: boolean;
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 10;

export function PreferenceDescriptionTooltip({
  id,
  description,
  anchor,
  visible,
}: PreferenceDescriptionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!visible || !anchor || typeof window === 'undefined') return;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.getBoundingClientRect().height || 96;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const placeOnRight = rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH + VIEWPORT_MARGIN <= viewportWidth;
      const left = placeOnRight
        ? rect.right + TOOLTIP_GAP
        : Math.max(VIEWPORT_MARGIN, rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH);
      const centerTop = rect.top + rect.height / 2 - tooltipHeight / 2;
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN, centerTop),
        Math.max(VIEWPORT_MARGIN, viewportHeight - tooltipHeight - VIEWPORT_MARGIN),
      );
      setPosition({ left, top });
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

  const cssVariables = useMemo(() => ({
    '--preference-tooltip-left': `${position.left}px`,
    '--preference-tooltip-top': `${position.top}px`,
  }), [position.left, position.top]);
  useCssVars(tooltipRef, cssVariables);

  if (!visible || !anchor || typeof document === 'undefined') return null;
  const portalTarget = anchor.closest('.settings-modal') ?? document.body;

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      className="settings-preference-description-panel is-visible"
      role="tooltip"
    >
      {description}
    </div>,
    portalTarget,
  );
}
