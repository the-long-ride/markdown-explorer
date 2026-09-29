export const DOCUMENT_FILE_DRAG_MIME = 'application/x-markdown-explorer-file';
export const OPEN_IN_SPLIT_EVENT = 'markdown-explorer-open-in-split';
export const SPLIT_TAB_DRAG_MIME = 'application/x-markdown-explorer-split-tab';
export const SPLIT_HEADER_DRAG_MIME = 'application/x-markdown-explorer-split-header';

export interface SplitTabDragPayload {
  sourcePaneId: 'primary' | 'secondary';
  filePath: string;
}

type ActiveDragSession =
  | { kind: 'document'; filePath: string }
  | { kind: 'split-tab'; sourcePaneId: 'primary' | 'secondary'; filePath: string }
  | { kind: 'split-header'; paneId: 'primary' | 'secondary' };

let activeDragSession: ActiveDragSession | null = null;

export function beginDocumentFileDrag(filePath: string): void {
  activeDragSession = { kind: 'document', filePath: String(filePath ?? '').trim() };
}

export function beginSplitTabDrag(payload: SplitTabDragPayload): void {
  activeDragSession = { kind: 'split-tab', sourcePaneId: payload.sourcePaneId, filePath: payload.filePath };
}

export function beginSplitHeaderDrag(paneId: 'primary' | 'secondary'): void {
  activeDragSession = { kind: 'split-header', paneId };
}

export function endDragSession(): void {
  activeDragSession = null;
}

export function hasDragType(dataTransfer: DataTransfer | null | undefined, mimeType: string): boolean {
  if (!dataTransfer || !dataTransfer.types) return false;
  const target = mimeType.toLowerCase();
  const types = dataTransfer.types;
  for (let i = 0; i < types.length; i++) {
    if (String(types[i]).toLowerCase() === target) return true;
  }
  return false;
}

export function writeDraggedDocumentPath(dataTransfer: DataTransfer, filePath: string): void {
  const path = String(filePath ?? '').trim();
  if (!path) return;
  beginDocumentFileDrag(path);
  dataTransfer.setData(DOCUMENT_FILE_DRAG_MIME, path);
  dataTransfer.setData('text/plain', path);
  dataTransfer.effectAllowed = 'copy';
}

export function readDraggedDocumentPath(dataTransfer: DataTransfer): string | null {
  if (activeDragSession?.kind === 'document') {
    return activeDragSession.filePath;
  }
  if (activeDragSession?.kind === 'split-tab' || activeDragSession?.kind === 'split-header') {
    return null;
  }
  if (hasDragType(dataTransfer, SPLIT_HEADER_DRAG_MIME) || hasDragType(dataTransfer, SPLIT_TAB_DRAG_MIME)) return null;
  const custom = dataTransfer?.getData ? dataTransfer.getData(DOCUMENT_FILE_DRAG_MIME).trim() : '';
  if (custom) return custom;
  const plain = dataTransfer?.getData ? dataTransfer.getData('text/plain').trim() : '';
  if (plain && !plain.startsWith('split-') && !plain.startsWith('{')) return plain;
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    const file = dataTransfer.files[0];
    if ('path' in file && typeof (file as { path?: string }).path === 'string') return (file as { path: string }).path;
  }
  return null;
}

export function hasDraggedDocument(dataTransfer?: DataTransfer | null): boolean {
  if (activeDragSession?.kind === 'document') return true;
  if (activeDragSession?.kind === 'split-tab' || activeDragSession?.kind === 'split-header') return false;
  if (hasDragType(dataTransfer, DOCUMENT_FILE_DRAG_MIME)) return true;
  if (hasDragType(dataTransfer, SPLIT_HEADER_DRAG_MIME) || hasDragType(dataTransfer, SPLIT_TAB_DRAG_MIME)) return false;
  return hasDragType(dataTransfer, 'text/plain')
    || hasDragType(dataTransfer, 'Files');
}

export function writeSplitTabDrag(dataTransfer: DataTransfer, payload: SplitTabDragPayload): void {
  beginSplitTabDrag(payload);
  const json = JSON.stringify(payload);
  dataTransfer.setData(SPLIT_TAB_DRAG_MIME, json);
  dataTransfer.setData('text/plain', json);
  dataTransfer.effectAllowed = 'move';
}

export function readSplitTabDrag(dataTransfer: DataTransfer): SplitTabDragPayload | null {
  if (activeDragSession?.kind === 'split-tab') {
    return { sourcePaneId: activeDragSession.sourcePaneId, filePath: activeDragSession.filePath };
  }
  if (activeDragSession?.kind === 'document' || activeDragSession?.kind === 'split-header') {
    return null;
  }
  if (hasDragType(dataTransfer, SPLIT_HEADER_DRAG_MIME) || hasDragType(dataTransfer, DOCUMENT_FILE_DRAG_MIME)) return null;
  if (dataTransfer?.types && !hasDragType(dataTransfer, SPLIT_TAB_DRAG_MIME) && !hasDragType(dataTransfer, 'text/plain')) {
    return null;
  }
  let raw = dataTransfer?.getData ? dataTransfer.getData(SPLIT_TAB_DRAG_MIME) : '';
  if (!raw && dataTransfer?.getData) {
    const plain = dataTransfer.getData('text/plain');
    if (plain && plain.includes('"sourcePaneId"')) raw = plain;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.filePath === 'string' && (parsed.sourcePaneId === 'primary' || parsed.sourcePaneId === 'secondary')) {
      return parsed as SplitTabDragPayload;
    }
  } catch {}
  return null;
}

export function hasDraggedSplitTab(dataTransfer?: DataTransfer | null): boolean {
  if (activeDragSession?.kind === 'split-tab') return true;
  if (activeDragSession?.kind === 'document' || activeDragSession?.kind === 'split-header') return false;
  if (hasDragType(dataTransfer, SPLIT_TAB_DRAG_MIME)) return true;
  return false;
}

export function writeSplitHeaderDrag(dataTransfer: DataTransfer, paneId: 'primary' | 'secondary'): void {
  beginSplitHeaderDrag(paneId);
  dataTransfer.setData(SPLIT_HEADER_DRAG_MIME, paneId);
  dataTransfer.setData('text/plain', `split-header:${paneId}`);
  dataTransfer.effectAllowed = 'move';
}

export function readSplitHeaderDrag(dataTransfer: DataTransfer): ('primary' | 'secondary') | null {
  if (activeDragSession?.kind === 'split-header') {
    return activeDragSession.paneId;
  }
  if (activeDragSession?.kind === 'document' || activeDragSession?.kind === 'split-tab') {
    return null;
  }
  if (hasDragType(dataTransfer, SPLIT_TAB_DRAG_MIME) || hasDragType(dataTransfer, DOCUMENT_FILE_DRAG_MIME)) return null;
  if (dataTransfer?.types && !hasDragType(dataTransfer, SPLIT_HEADER_DRAG_MIME) && !hasDragType(dataTransfer, 'text/plain')) {
    return null;
  }
  let raw = dataTransfer?.getData ? dataTransfer.getData(SPLIT_HEADER_DRAG_MIME) : '';
  if (!raw && dataTransfer?.getData) {
    const plain = dataTransfer.getData('text/plain');
    if (plain && plain.startsWith('split-header:')) raw = plain.replace('split-header:', '');
  }
  return raw === 'primary' || raw === 'secondary' ? raw : null;
}

export function hasDraggedSplitHeader(dataTransfer?: DataTransfer | null): boolean {
  if (activeDragSession?.kind === 'split-header') return true;
  if (activeDragSession?.kind === 'document' || activeDragSession?.kind === 'split-tab') return false;
  if (hasDragType(dataTransfer, SPLIT_HEADER_DRAG_MIME)) return true;
  return false;
}

export function requestOpenInSplit(filePath: string): void {
  const path = String(filePath ?? '').trim();
  if (!path) return;
  window.dispatchEvent(new CustomEvent(OPEN_IN_SPLIT_EVENT, { detail: path }));
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragend', endDragSession);
  window.addEventListener('drop', () => { window.setTimeout(endDragSession, 0); });
}
