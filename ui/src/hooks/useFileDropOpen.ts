import { useEffect, useRef, useState } from 'react';
import { getDroppedFilePath } from '../desktop/desktopTabs';

interface UseFileDropOpenParams {
  isElectron: boolean;
  modalOpen: boolean;
  openDroppedPath: (path: string) => void;
}

export function useFileDropOpen({
  isElectron,
  modalOpen,
  openDroppedPath,
}: UseFileDropOpenParams) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!isElectron) return;

    const isFileDrag = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      return !!types && Array.from(types).includes('Files');
    };

    const resetDragState = () => {
      dragCounter.current = 0;
      setIsDragging(false);
      document.body.classList.remove('is-dragging-files');
    };

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event) || modalOpen) return;
      event.preventDefault();
      dragCounter.current += 1;
      setIsDragging(true);
      document.body.classList.add('is-dragging-files');
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0 || event.relatedTarget === null) resetDragState();
    };

    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event) || modalOpen) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []);
      resetDragState();
      if (modalOpen || files.length === 0) return;
      const droppedPath = getDroppedFilePath(files[0]);
      if (droppedPath) openDroppedPath(droppedPath);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', resetDragState);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', resetDragState);
      resetDragState();
    };
  }, [isElectron, modalOpen, openDroppedPath]);

  return { isDragging };
}
