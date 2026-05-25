// =============================================================================
// hooks/useResize.ts — Sidebar resize handle
// =============================================================================

import { useEffect } from 'react';

export function useResize(handleId: string, targetId: string, trigger?: any) {
  useEffect(() => {
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;

    let dragging = false;
    let startX = 0;
    let startW = 0;

    const onDown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      startW = target.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.classList.add('is-resizing');
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const newWidth = Math.max(180, Math.min(480, startW + e.clientX - startX));
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      localStorage.setItem('markdown-explorer-sidebar-width', String(newWidth));
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
  }, [handleId, targetId, trigger]);
}
