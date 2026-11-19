// =============================================================================
// components/shared/HoverTooltipPortal.tsx — Global Delayed Tooltip for Data Items
// Automatically displays a viewport-unclipped tooltip after a short hover delay (320ms)
// for any element with [data-hover-tooltip].
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';

interface TooltipState {
  text: string;
  targetRect: DOMRect;
  pos?: string | null;
}

export function HoverTooltipPortal() {
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false,
  });

  const timerRef = useRef<number | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearPendingTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const hideTooltip = () => {
      clearPendingTimer();
      if (!currentTargetRef.current && !isVisibleRef.current) return;
      currentTargetRef.current = null;
      isVisibleRef.current = false;
      setTooltipState(null);
      setCoords((prev) => (prev.ready ? { ...prev, ready: false } : prev));
    };

    const handlePointerOver = (event: MouseEvent) => {
      const rawTarget = event.target as HTMLElement | null;
      if (!rawTarget) return;

      const element = rawTarget.closest('[data-hover-tooltip]') as HTMLElement | null;
      if (!element) {
        if (currentTargetRef.current) {
          hideTooltip();
        }
        return;
      }

      if (currentTargetRef.current === element) {
        return;
      }

      clearPendingTimer();
      currentTargetRef.current = element;

      const text = element.getAttribute('data-hover-tooltip');
      if (!text || text.trim() === '') {
        hideTooltip();
        return;
      }

      const delay = isVisibleRef.current ? 60 : 320;

      timerRef.current = window.setTimeout(() => {
        if (!currentTargetRef.current || currentTargetRef.current !== element) return;
        const rect = element.getBoundingClientRect();
        const pos = element.getAttribute('data-hover-tooltip-pos');
        isVisibleRef.current = true;
        const initialLeft = pos === 'left' ? rect.left : rect.left;
        const initialTop = pos === 'top' || pos === 'above' ? rect.top : rect.bottom;
        setCoords({ left: initialLeft, top: initialTop, ready: false });
        setTooltipState({ text, targetRect: rect, pos });
      }, delay);
    };

    const handlePointerOut = (event: MouseEvent) => {
      const related = event.relatedTarget as HTMLElement | null;
      if (currentTargetRef.current && related && currentTargetRef.current.contains(related)) {
        return;
      }
      hideTooltip();
    };

    const handleDismiss = () => {
      hideTooltip();
    };

    document.addEventListener('mouseover', handlePointerOver, { passive: true });
    document.addEventListener('mouseout', handlePointerOut, { passive: true });
    document.addEventListener('pointerdown', handleDismiss, { passive: true });
    document.addEventListener('keydown', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleDismiss, { capture: true, passive: true });
    window.addEventListener('blur', handleDismiss);

    return () => {
      clearPendingTimer();
      document.removeEventListener('mouseover', handlePointerOver);
      document.removeEventListener('mouseout', handlePointerOut);
      document.removeEventListener('pointerdown', handleDismiss);
      document.removeEventListener('keydown', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, { capture: true });
      window.removeEventListener('blur', handleDismiss);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tooltipState || !tooltipRef.current || typeof window === 'undefined') {
      return;
    }

    const { targetRect, pos } = tooltipState;
    const tooltipNode = tooltipRef.current;
    const tooltipRect = tooltipNode.getBoundingClientRect();

    const gap = 8;
    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let preferred = pos;
    if (!preferred) {
      if (targetRect.right + 260 < vw && targetRect.left < vw * 0.45) {
        preferred = 'right';
      } else if (targetRect.left > vw * 0.55 && targetRect.left - 260 > 0) {
        preferred = 'left';
      } else {
        preferred = 'bottom';
      }
    }

    let left = 0;
    let top = 0;

    if (preferred === 'right') {
      left = targetRect.right + gap;
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      if (left + tooltipRect.width > vw - padding && targetRect.left - tooltipRect.width - gap >= padding) {
        left = targetRect.left - tooltipRect.width - gap;
      }
    } else if (preferred === 'left') {
      left = targetRect.left - tooltipRect.width - gap;
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      if (left < padding && targetRect.right + tooltipRect.width + gap <= vw - padding) {
        left = targetRect.right + gap;
      }
    } else if (preferred === 'top' || preferred === 'above') {
      top = targetRect.top - tooltipRect.height - gap;
      left = targetRect.left;
      if (top < padding && targetRect.bottom + tooltipRect.height + gap <= vh - padding) {
        top = targetRect.bottom + gap;
      }
    } else {
      top = targetRect.bottom + gap;
      left = targetRect.left;
      if (top + tooltipRect.height > vh - padding && targetRect.top - tooltipRect.height - gap >= padding) {
        top = targetRect.top - tooltipRect.height - gap;
      }
    }

    left = Math.max(padding, Math.min(left, vw - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, vh - tooltipRect.height - padding));

    setCoords({ left, top, ready: true });
  }, [tooltipState]);

  useCssVars(tooltipRef, {
    '--hover-tooltip-left': `${coords.left}px`,
    '--hover-tooltip-top': `${coords.top}px`,
    '--hover-tooltip-visibility': coords.ready ? 'visible' : 'hidden',
  });

  if (!tooltipState || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`hover-tooltip-portal${coords.ready ? ' is-visible' : ''}`}
      role="tooltip"
      aria-hidden={!coords.ready}
    >
      <span className="tooltip-content-wrap">{tooltipState.text}</span>
    </div>,
    document.body
  );
}
