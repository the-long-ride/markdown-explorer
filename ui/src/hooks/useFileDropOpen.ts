import { useEffect, useRef, useState } from 'react';
import { getDroppedFilePath } from '../desktop/desktopTabs';

const TEXT_DROP_EXTENSIONS = new Set([
  '.md', '.mdx', '.markdown', '.txt', '.html', '.htm', '.csv', '.tsv',
]);

function isTextDropFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_DROP_EXTENSIONS.has(fileName.slice(dot).toLowerCase());
}

interface UseFileDropOpenParams {
  isDesktop: boolean;
  isWeb?: boolean;
  modalOpen: boolean;
  openDroppedPath: (path: string) => void;
  openDroppedFolder?: (handle: any) => void;
  openDroppedFileHandle?: (handle: any) => void;
  openDroppedWebFiles?: (files: File[]) => void;
}

export function useFileDropOpen({
  isDesktop,
  isWeb = false,
  modalOpen,
  openDroppedPath,
  openDroppedFolder,
  openDroppedFileHandle,
  openDroppedWebFiles,
}: UseFileDropOpenParams) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!isDesktop && !isWeb) return;

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

      // Snapshot synchronous DataTransfer lists before any `await`, because
      // Chromium clears DataTransfer once the drop handler yields.
      const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
      const items = Array.from(event.dataTransfer?.items ?? []);

      if (isWeb && items.length > 0 && (openDroppedFolder || openDroppedFileHandle || openDroppedWebFiles)) {
        const item = items[0];
        if (typeof (item as any).getAsFileSystemHandle === 'function') {
          try {
            const handle = await (item as any).getAsFileSystemHandle();
            if (handle && handle.kind === 'directory' && openDroppedFolder) {
              openDroppedFolder(handle);
              return;
            }
            if (handle && (handle as any).kind === 'file') {
              if (!openDroppedWebFiles && openDroppedFileHandle) {
                openDroppedFileHandle(handle);
                return;
              }
              if (openDroppedWebFiles) {
                const resolvedFiles = droppedFiles.length > 0
                  ? droppedFiles
                  : (typeof (handle as any).getFile === 'function' ? [await (handle as any).getFile()] : []);
                if (resolvedFiles.length > 0) {
                  if (
                    openDroppedFileHandle &&
                    resolvedFiles.length === 1 &&
                    !isTextDropFile(resolvedFiles[0].name)
                  ) {
                    openDroppedFileHandle(handle);
                    return;
                  }
                  openDroppedWebFiles(resolvedFiles);
                  return;
                }
                if (openDroppedFileHandle) {
                  openDroppedFileHandle(handle);
                  return;
                }
              }
            }
          } catch (err) {
            console.error('Failed to get FileSystemHandle on drop:', err);
          }
        }
      }

      if (isWeb && openDroppedWebFiles && droppedFiles.length > 0) {
        const entry = items[0] && typeof (items[0] as any).webkitGetAsEntry === 'function'
          ? (items[0] as any).webkitGetAsEntry()
          : null;
        if (!entry?.isDirectory) {
          openDroppedWebFiles(droppedFiles);
          return;
        }
      }

      if (droppedFiles.length === 0) return;
      const droppedPath = getDroppedFilePath(droppedFiles[0]);
      if (droppedPath) openDroppedPath(droppedPath);
    };

    const onTauriFileDrop = (event: Event) => {
      resetDragState();
      if (modalOpen) return;
      const paths = (event as CustomEvent<string[]>).detail;
      const droppedPath = Array.isArray(paths) ? paths[0] : undefined;
      if (droppedPath) openDroppedPath(droppedPath);
    };

    const onTauriFileDropState = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (detail?.type === 'over') {
        if (modalOpen) return;
        dragCounter.current = 1;
        setIsDragging(true);
        document.body.classList.add('is-dragging-files');
        return;
      }
      if (detail?.type === 'drop' || detail?.type === 'cancel' || detail?.type === 'leave') {
        resetDragState();
      }
    };

    const onWindowBlur = () => resetDragState();
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') resetDragState();
    };
    const onPointerExit = (event: MouseEvent) => {
      if (event.relatedTarget === null) resetDragState();
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', resetDragState);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('mouseout', onPointerExit);
    window.addEventListener('markdown-explorer-tauri-file-drop', onTauriFileDrop);
    window.addEventListener('markdown-explorer-tauri-file-drop-state', onTauriFileDropState);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', resetDragState);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('mouseout', onPointerExit);
      window.removeEventListener('markdown-explorer-tauri-file-drop', onTauriFileDrop);
      window.removeEventListener('markdown-explorer-tauri-file-drop-state', onTauriFileDropState);
      resetDragState();
    };
  }, [isDesktop, isWeb, modalOpen, openDroppedPath, openDroppedFolder, openDroppedFileHandle, openDroppedWebFiles]);

  return { isDragging };
}




