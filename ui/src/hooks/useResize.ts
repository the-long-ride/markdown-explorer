// =============================================================================
// hooks/useResize.ts — Resizable panel handle
// =============================================================================

import { useEffect } from 'react';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../constants/storage';

interface ResizeOptions {
  min?: number;
  max?: number;
  cssVar?: string;
  storageKey?: string;
  direction?: 'ltr' | 'rtl';
  mode?: 'live' | 'deferred' | 'synchronized';
  freezeContentId?: string;
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
    const storageKey = options.storageKey ?? SIDEBAR_WIDTH_STORAGE_KEY;
    const direction = options.direction ?? 'ltr';
    const mode = options.mode ?? 'live';
    const freezeContentId = options.freezeContentId;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let bindFrame = 0;
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
      const freezeContent = freezeContentId
        ? document.getElementById(freezeContentId)
        : null;
      if (!handle || !target) return false;

      let dragging = false;
      let startX = 0;
      let startW = 0;
      let activePointerId: number | null = null;
      let resizeFrame = 0;
      let commitFrame = 0;
      let pendingWidth: number | null = null;
      let lastAppliedWidth: number | null = null;

      const clearGuide = () => {
        handle.style.transform = '';
        handle.classList.remove('is-resize-guide');
      };

      const clearSynchronizedState = () => {
        target.style.removeProperty('width');
        target.classList.remove('is-resizing-shell');
        if (freezeContent) {
          freezeContent.style.removeProperty('width');
          freezeContent.classList.remove('is-resize-width-locked');
        }
      };

      const clearCommitState = () => {
        if (commitFrame) {
          window.cancelAnimationFrame(commitFrame);
          commitFrame = 0;
        }
        target.classList.remove('is-resize-committing');
      };

      const scheduleCommitStateClear = () => {
        if (commitFrame) window.cancelAnimationFrame(commitFrame);
        commitFrame = window.requestAnimationFrame(() => {
          commitFrame = 0;
          target.classList.remove('is-resize-committing');
        });
      };

      const flushPendingWidth = () => {
        resizeFrame = 0;
        if (pendingWidth === null) return;

        lastAppliedWidth = pendingWidth;
        pendingWidth = null;
        if (mode === 'deferred') {
          const guideOffset = direction === 'rtl'
            ? startW - lastAppliedWidth
            : lastAppliedWidth - startW;
          handle.style.transform = `translate3d(${guideOffset}px, 0, 0)`;
          handle.classList.add('is-resize-guide');
          return;
        }
        if (mode === 'synchronized') {
          target.style.width = `${lastAppliedWidth}px`;
          return;
        }

        document.documentElement.style.setProperty(cssVar, `${lastAppliedWidth}px`);
      };

      const flushPendingWidthNow = () => {
        if (resizeFrame) {
          window.cancelAnimationFrame(resizeFrame);
          resizeFrame = 0;
        }
        flushPendingWidth();
      };

      const commitFinalWidth = () => {
        if (lastAppliedWidth === null || mode === 'live') return;
        target.classList.add('is-resize-committing');
        document.documentElement.style.setProperty(cssVar, `${lastAppliedWidth}px`);
        clearGuide();
        clearSynchronizedState();
        scheduleCommitStateClear();
      };

      const stopDragging = (pointerId?: number) => {
        if (!dragging) return;

        const moved = pendingWidth !== null || lastAppliedWidth !== null;
        flushPendingWidthNow();
        dragging = false;

        if (
          activePointerId !== null &&
          (pointerId === undefined || pointerId === activePointerId) &&
          handle.hasPointerCapture?.(activePointerId)
        ) {
          handle.releasePointerCapture(activePointerId);
        }
        activePointerId = null;

        if (moved && lastAppliedWidth !== null) {
          commitFinalWidth();
          localStorage.setItem(storageKey, String(lastAppliedWidth));
        } else {
          clearGuide();
          clearSynchronizedState();
        }
        restoreDragState();
      };

      const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();

        if (resizeFrame) {
          window.cancelAnimationFrame(resizeFrame);
          resizeFrame = 0;
        }
        clearCommitState();
        clearGuide();
        clearSynchronizedState();
        pendingWidth = null;
        lastAppliedWidth = null;

        dragging = true;
        activePointerId = event.pointerId;
        startX = event.clientX;
        startW = target.offsetWidth;
        if (mode === 'synchronized') {
          target.classList.add('is-resizing-shell');
          if (freezeContent) {
            freezeContent.style.width = `${startW}px`;
            freezeContent.classList.add('is-resize-width-locked');
          }
        }
        handle.setPointerCapture?.(event.pointerId);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('is-resizing');
      };

      const onMove = (event: PointerEvent) => {
        if (!dragging) return;
        const delta = event.clientX - startX;
        const nextWidth = startW + (direction === 'rtl' ? -delta : delta);
        pendingWidth = Math.max(min, Math.min(max, nextWidth));

        if (!resizeFrame) {
          resizeFrame = window.requestAnimationFrame(flushPendingWidth);
        }
      };

      const onUp = (event: PointerEvent) => {
        stopDragging(event.pointerId);
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
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
        clearCommitState();
        clearGuide();
        clearSynchronizedState();
        pendingWidth = null;
      };

      return true;
    };

    const scheduleBind = () => {
      if (bindFrame) return;
      bindFrame = window.requestAnimationFrame(() => {
        bindFrame = 0;
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
      if (bindFrame) window.cancelAnimationFrame(bindFrame);
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
    options.mode,
    options.freezeContentId,
  ]);
}
