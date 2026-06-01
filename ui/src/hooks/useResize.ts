// =============================================================================
// hooks/useResize.ts — Resizable panel handle
// =============================================================================

import { useEffect } from 'react';

interface ResizeOptions {
  min?: number;
  max?: number;
  cssVar?: string;
  storageKey?: string;
  direction?: 'ltr' | 'rtl';
}

export function useResize(
  handleId: string,
  targetId: string,
  trigger?: any,
  options: ResizeOptions = {},
) {
  useEffect(() => {
    const min = options.min ?? 180;
    const max = options.max ?? 480;
    const cssVar = options.cssVar ?? '--sidebar-width';
    const storageKey = options.storageKey ?? 'markdown-explorer-sidebar-width';
    const direction = options.direction ?? 'ltr';

    let disposed = false;
    let observer: MutationObserver | null = null;
    let frame = 0;
    let cleanupListeners: (() => void) | null = null;

    const restoreDragState = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-resizing');
    };

    const bind = () => {
      if (disposed || cleanupListeners) return !!cleanupListeners;

      const handle = document.getElementById(handleId);
      const target = document.getElementById(targetId);
      if (!handle || !target) return false;

      let dragging = false;
      let startX = 0;
      let startW = 0;
      let activePointerId: number | null = null;

      const stopDragging = (pointerId?: number) => {
        if (!dragging) return;
        dragging = false;
        if (
          activePointerId !== null &&
          (pointerId === undefined || pointerId === activePointerId) &&
          handle.hasPointerCapture?.(activePointerId)
        ) {
          handle.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        restoreDragState();
      };

      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startW = target.offsetWidth;
        handle.setPointerCapture?.(e.pointerId);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('is-resizing');
      };

      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const delta = e.clientX - startX;
        const nextWidth = startW + (direction === 'rtl' ? -delta : delta);
        const newWidth = Math.max(min, Math.min(max, nextWidth));
        document.documentElement.style.setProperty(cssVar, `${newWidth}px`);
        localStorage.setItem(storageKey, String(newWidth));
      };

      const onUp = (e: PointerEvent) => {
        stopDragging(e.pointerId);
      };

      handle.addEventListener('pointerdown', onDown);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);

      cleanupListeners = () => {
        handle.removeEventListener('pointerdown', onDown);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        stopDragging(activePointerId ?? undefined);
      };

      return true;
    };

    const scheduleBind = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (bind() && observer) {
          observer.disconnect();
          observer = null;
        }
      });
    };

    if (!bind()) {
      observer = new MutationObserver(scheduleBind);
      observer.observe(document.body, { childList: true, subtree: true });
      scheduleBind();
    }

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      cleanupListeners?.();
      restoreDragState();
    };
  }, [
    handleId,
    targetId,
    trigger,
    options.min,
    options.max,
    options.cssVar,
    options.storageKey,
    options.direction,
  ]);
}
