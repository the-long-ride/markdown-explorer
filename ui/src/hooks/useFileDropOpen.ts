import { useEffect, useRef, useState } from 'react';
import { getDroppedFilePath } from '../desktop/desktopTabs';

interface UseFileDropOpenParams {
  isDesktop: boolean;
  isChrome: boolean;
  modalOpen: boolean;
  openDroppedPath: (path: string) => void;
  openDroppedFolder?: (handle: any) => void;
}

export function useFileDropOpen({
  isDesktop,
  isChrome,
  modalOpen,
  openDroppedPath,
  openDroppedFolder,
}: UseFileDropOpenParams) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!isDesktop && !isChrome) return;

    const tauri = (window as any).__TAURI__;
    if (tauri?.event?.listen) {
      let active = true;
      let unlistens: (() => void)[] = [];

      const setupTauriDragDrop = async () => {
        try {
          const uEnter = await tauri.event.listen('tauri://drag-enter', () => {
            if (modalOpen) return;
            setIsDragging(true);
            document.body.classList.add('is-dragging-files');
          });
          if (active) unlistens.push(uEnter);
          else uEnter();

          const uLeave = await tauri.event.listen('tauri://drag-leave', () => {
            setIsDragging(false);
            document.body.classList.remove('is-dragging-files');
          });
          if (active) unlistens.push(uLeave);
          else uLeave();

          const uDrop = await tauri.event.listen('tauri://drag-drop', (event: any) => {
            setIsDragging(false);
            document.body.classList.remove('is-dragging-files');
            if (modalOpen) return;
            const paths = event.payload?.paths;
            if (paths && paths.length > 0) {
              const droppedPath = paths[0];
              if (droppedPath) openDroppedPath(droppedPath);
            }
          });
          if (active) unlistens.push(uDrop);
          else uDrop();

          const uCancel = await tauri.event.listen('tauri://drag-cancelled', () => {
            setIsDragging(false);
            document.body.classList.remove('is-dragging-files');
          });
          if (active) unlistens.push(uCancel);
          else uCancel();
        } catch (err) {
          console.error('Failed to setup Tauri drag-drop listeners:', err);
        }
      };

      setupTauriDragDrop();

      return () => {
        active = false;
        unlistens.forEach((fn) => fn());
        document.body.classList.remove('is-dragging-files');
        setIsDragging(false);
      };
    }

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

    const onDrop = async (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      resetDragState();
      if (modalOpen) return;

      if (isChrome && event.dataTransfer?.items && openDroppedFolder) {
        const items = Array.from(event.dataTransfer.items);
        if (items.length > 0) {
          const item = items[0];
          if (typeof (item as any).getAsFileSystemHandle === 'function') {
            try {
              const handle = await (item as any).getAsFileSystemHandle();
              if (handle && handle.kind === 'directory') {
                openDroppedFolder(handle);
                return;
              }
            } catch (err) {
              console.error('Failed to get FileSystemHandle on drop:', err);
            }
          }
        }
      }

      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
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
  }, [isDesktop, isChrome, modalOpen, openDroppedPath, openDroppedFolder]);

  return { isDragging };
}

