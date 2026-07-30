// =============================================================================
// hooks/useScrollVisibility.ts — Scroll-to-top button visibility
// =============================================================================

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';

export function useScrollVisibility(
  scrollRef: RefObject<HTMLElement | null>,
  threshold = 200,
  observeKey?: unknown,
) {
  const [isVisible, setIsVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      if (visibleRef.current) {
        visibleRef.current = false;
        setIsVisible(false);
      }
      return;
    }

    let animationFrame: number | null = null;
    const updateVisibility = () => {
      animationFrame = null;
      const hideThreshold = Math.max(0, threshold - 24);
      const nextVisible = visibleRef.current
        ? el.scrollTop > hideThreshold
        : el.scrollTop > threshold;
      if (visibleRef.current === nextVisible) return;
      visibleRef.current = nextVisible;
      setIsVisible(nextVisible);
    };
    const handler = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    el.addEventListener('scroll', handler, { passive: true });
    return () => {
      el.removeEventListener('scroll', handler);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [scrollRef, threshold, observeKey]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollRef]);

  return { isVisible, scrollToTop };
}
