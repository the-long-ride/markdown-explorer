import { useEffect, type RefObject } from 'react';

function scrollRatio(element: HTMLElement): number {
  const range = element.scrollHeight - element.clientHeight;
  return range > 0 ? element.scrollTop / range : 0;
}

/** Keeps two scroll panes at the same relative position. */
export function useSyncedScroll(first: RefObject<HTMLElement | null>, second: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const a = first.current;
    const b = second.current;
    if (!a || !b) return undefined;
    // A programmatic scroll fires a scroll event on the follower; skip it once.
    const echoes = new WeakSet<HTMLElement>();
    const follow = (source: HTMLElement, target: HTMLElement) => () => {
      if (echoes.has(source)) {
        echoes.delete(source);
        return;
      }
      const next = scrollRatio(source) * Math.max(0, target.scrollHeight - target.clientHeight);
      if (Math.abs(target.scrollTop - next) < 1) return;
      echoes.add(target);
      target.scrollTop = next;
    };
    const fromA = follow(a, b);
    const fromB = follow(b, a);
    a.addEventListener('scroll', fromA, { passive: true });
    b.addEventListener('scroll', fromB, { passive: true });
    return () => {
      a.removeEventListener('scroll', fromA);
      b.removeEventListener('scroll', fromB);
    };
  }, [first, second]);
}
