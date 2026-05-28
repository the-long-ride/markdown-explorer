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
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;

    const min = options.min ?? 180;
    const max = options.max ?? 480;
    const cssVar = options.cssVar ?? '--sidebar-width';
    const storageKey = options.storageKey ?? 'markdown-explorer-sidebar-width';
    const direction = options.direction ?? 'ltr';

    let dragging = false;
    let startX = 0;
    let startW = 0;

    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = target.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.classList.add('is-resizing');
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      const nextWidth = startW + (direction === 'rtl' ? -delta : delta);
      const newWidth = Math.max(min, Math.min(max, nextWidth));
      document.documentElement.style.setProperty(cssVar, `${newWidth}px`);
      localStorage.setItem(storageKey, String(newWidth));
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-resizing');
    };

    handle.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    return () => {
      handle.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-resizing');
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
