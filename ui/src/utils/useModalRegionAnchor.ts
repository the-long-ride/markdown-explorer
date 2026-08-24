import { useEffect } from 'react';

// Keeps `--measured-header-bottom` on :root in sync with the real rendered
// bottom edge of the app header bar (topbar or desktop tab bar).
//
// Dialog geometry (.mdn-app-modal-region) anchors to this measurement so the
// gap between the header and modal cards can never collapse to zero — not at
// high zoom levels, not when a theme renders the header taller than its
// --topbar-h token, and not when the tab bar replaces the topbar.
export function useModalRegionAnchor() {
  useEffect(() => {
    let frame = 0;
    let observed: Element | null = null;

    const root = document.documentElement;
    // jsdom (and some embedded webviews) lack ResizeObserver — degrade to
    // resize-event-only measurement instead of crashing.
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => schedule())
      : null;

    const measure = () => {
      frame = 0;
      const header = document.querySelector('.topbar') ?? document.querySelector('.desktop-tabbar');
      if (header !== observed) {
        if (observed && resizeObserver) resizeObserver.unobserve(observed);
        if (header && resizeObserver) resizeObserver.observe(header);
        observed = header;
      }
      if (!header) return;
      const bottom = header.getBoundingClientRect().bottom;
      if (Number.isFinite(bottom)) root.style.setProperty('--measured-header-bottom', `${Math.max(0, bottom)}px`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule);
    // Fires for pinch zoom and some webview zoom-factor changes that skip `resize`.
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (observed && resizeObserver) resizeObserver.unobserve(observed);
      resizeObserver?.disconnect();
      root.style.removeProperty('--measured-header-bottom');
    };
  }, []);
}
