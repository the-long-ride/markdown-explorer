import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type ResizeSection = 'workspaces' | 'preview';

type SearchOverlayStyle = Record<string, string | number | undefined>;

const WORKSPACE_MIN = 170;
const WORKSPACE_MAX = 360;
const PREVIEW_MIN = 260;
const RESULT_MIN = 300;
const HANDLE_TOTAL = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useSearchOverlayResize(previewEnabled: boolean) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(220);
  const [previewWidth, setPreviewWidth] = useState(360);

  const beginResize = useCallback((section: ResizeSection, event: ReactPointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    document.body.classList.add('is-resizing');

    const onMove = (moveEvent: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      if (section === 'workspaces') {
        const reservedPreview = previewEnabled ? previewWidth : 0;
        const max = Math.min(WORKSPACE_MAX, rect.width - reservedPreview - RESULT_MIN - HANDLE_TOTAL);
        setWorkspaceWidth(clamp(moveEvent.clientX - rect.left, WORKSPACE_MIN, Math.max(WORKSPACE_MIN, max)));
        return;
      }
      const max = Math.max(PREVIEW_MIN, rect.width - workspaceWidth - RESULT_MIN - HANDLE_TOTAL);
      setPreviewWidth(clamp(rect.right - moveEvent.clientX, PREVIEW_MIN, max));
    };

    const onEnd = () => {
      document.body.classList.remove('is-resizing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }, [previewEnabled, previewWidth, workspaceWidth]);

  const style: SearchOverlayStyle = {
    '--search-workspaces-width': `${workspaceWidth}px`,
    '--search-preview-width': `${previewWidth}px`,
  };

  return { cardRef, beginResize, style };
}
