// =============================================================================
// hooks/useScrollVisibility.ts — Scroll-to-top button visibility
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useScrollVisibility(
  scrollRef: React.RefObject<HTMLElement | null>,
  threshold = 200,
) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handler = () => setIsVisible(el.scrollTop > threshold);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [scrollRef, threshold]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollRef]);

  return { isVisible, scrollToTop };
}
