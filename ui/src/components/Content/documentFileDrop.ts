export const DOCUMENT_FILE_DRAG_MIME = 'application/x-markdown-explorer-file';
export const OPEN_IN_SPLIT_EVENT = 'markdown-explorer-open-in-split';

export function writeDraggedDocumentPath(dataTransfer: DataTransfer, filePath: string): void {
  const path = String(filePath ?? '').trim();
  if (!path) return;
  dataTransfer.setData(DOCUMENT_FILE_DRAG_MIME, path);
  dataTransfer.setData('text/plain', path);
  dataTransfer.effectAllowed = 'copy';
}

export function readDraggedDocumentPath(dataTransfer: DataTransfer): string | null {
  const path = dataTransfer.getData(DOCUMENT_FILE_DRAG_MIME).trim();
  return path || null;
}

export function hasDraggedDocument(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types ?? []).includes(DOCUMENT_FILE_DRAG_MIME);
}

export function requestOpenInSplit(filePath: string): void {
  const path = String(filePath ?? '').trim();
  if (!path) return;
  window.dispatchEvent(new CustomEvent(OPEN_IN_SPLIT_EVENT, { detail: path }));
}
