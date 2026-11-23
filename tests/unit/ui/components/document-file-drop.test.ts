import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_FILE_DRAG_MIME,
  OPEN_IN_SPLIT_EVENT,
  SPLIT_HEADER_DRAG_MIME,
  SPLIT_TAB_DRAG_MIME,
  endDragSession,
  hasDraggedDocument,
  hasDraggedSplitHeader,
  hasDraggedSplitTab,
  readDraggedDocumentPath,
  readSplitHeaderDrag,
  readSplitTabDrag,
  requestOpenInSplit,
  writeDraggedDocumentPath,
  writeSplitHeaderDrag,
  writeSplitTabDrag,
} from '../../../../ui/src/components/Content/documentFileDrop';

function transfer(data: Record<string, string> = {}, files: File[] = [], exposeTypes = true): DataTransfer {
  const entries = new Map(Object.entries(data));
  return {
    get types() { return exposeTypes ? [...entries.keys(), ...(files.length ? ['Files'] : [])] : undefined; },
    getData: (type: string) => entries.get(type) ?? '',
    setData: (type: string, value: string) => entries.set(type, value),
    files,
    effectAllowed: 'none',
  } as unknown as DataTransfer;
}

const tab = { sourcePaneId: 'secondary', filePath: '/notes/a.md' } as const;

afterEach(() => {
  endDragSession();
  vi.useRealTimers();
});

describe('file drag and split gestures', () => {
  it('writes trimmed file paths and retains them during protected dragover', () => {
    const data = transfer();
    writeDraggedDocumentPath(data, '   ');
    expect(data.types).toEqual([]);
    writeDraggedDocumentPath(data, ' /notes/a.md ');
    expect(data.getData(DOCUMENT_FILE_DRAG_MIME)).toBe('/notes/a.md');
    expect(data.getData('text/plain')).toBe('/notes/a.md');
    expect(data.effectAllowed).toBe('copy');
    expect(readDraggedDocumentPath(transfer())).toBe('/notes/a.md');
    expect(hasDraggedDocument()).toBe(true);
    expect(hasDraggedSplitTab(data)).toBe(false);
    expect(hasDraggedSplitHeader(data)).toBe(false);
    expect(readSplitTabDrag(data)).toBeNull();
    expect(readSplitHeaderDrag(data)).toBeNull();
    window.dispatchEvent(new Event('dragend'));
    expect(hasDraggedDocument()).toBe(false);
  });

  it('writes tab moves and keeps the drag session until drop handlers finish', () => {
    vi.useFakeTimers();
    const data = transfer();
    writeSplitTabDrag(data, tab);
    expect(data.getData(SPLIT_TAB_DRAG_MIME)).toBe(JSON.stringify(tab));
    expect(data.getData('text/plain')).toBe(JSON.stringify(tab));
    expect(data.effectAllowed).toBe('move');
    expect(hasDraggedSplitTab()).toBe(true);
    expect(hasDraggedDocument(data)).toBe(false);
    expect(hasDraggedSplitHeader(data)).toBe(false);
    expect(readDraggedDocumentPath(data)).toBeNull();
    expect(readSplitHeaderDrag(data)).toBeNull();
    window.dispatchEvent(new Event('drop'));
    expect(readSplitTabDrag(transfer())).toEqual(tab);
    vi.runOnlyPendingTimers();
    expect(hasDraggedSplitTab()).toBe(false);
    expect(readSplitTabDrag(data)).toEqual(tab);
  });

  it('writes pane moves and keeps them distinct from tab and file moves', () => {
    const data = transfer();
    writeSplitHeaderDrag(data, 'primary');
    expect(data.getData(SPLIT_HEADER_DRAG_MIME)).toBe('primary');
    expect(data.getData('text/plain')).toBe('split-header:primary');
    expect(data.effectAllowed).toBe('move');
    expect(readSplitHeaderDrag(transfer())).toBe('primary');
    expect(hasDraggedSplitHeader()).toBe(true);
    expect(hasDraggedDocument(data)).toBe(false);
    expect(hasDraggedSplitTab(data)).toBe(false);
    expect(readDraggedDocumentPath(data)).toBeNull();
    expect(readSplitTabDrag(data)).toBeNull();
    endDragSession();
    expect(hasDraggedSplitHeader()).toBe(false);
    expect(hasDraggedSplitHeader(data)).toBe(true);
    expect(readSplitHeaderDrag(data)).toBe('primary');
  });

  it('recognizes case-insensitive drag types and falls back to an external file path', () => {
    expect(hasDraggedDocument(transfer({ [DOCUMENT_FILE_DRAG_MIME.toUpperCase()]: '/readme.md' }))).toBe(true);
    expect(readDraggedDocumentPath(transfer({ [DOCUMENT_FILE_DRAG_MIME]: ' /readme.md ', 'text/plain': '/other.md' }))).toBe('/readme.md');
    expect(hasDraggedDocument(transfer({ 'text/plain': '/readme.md' }))).toBe(true);
    expect(readDraggedDocumentPath(transfer({ 'text/plain': ' /readme.md ' }))).toBe('/readme.md');
    const file = new File(['contents'], 'readme.md');
    expect(hasDraggedDocument(transfer({}, [file]))).toBe(true);
    expect(readDraggedDocumentPath(transfer({}, [file]))).toBeNull();
    expect(readDraggedDocumentPath(transfer({}, [Object.assign(file, { path: 42 })]))).toBeNull();
    expect(readDraggedDocumentPath(transfer({}, [Object.assign(file, { path: '/readme.md' })]))).toBe('/readme.md');
  });

  it.each([SPLIT_TAB_DRAG_MIME, SPLIT_HEADER_DRAG_MIME])('does not interpret %s as a document path', (type) => {
    const data = transfer({ [type]: '', 'text/plain': '/readme.md' });
    expect(hasDraggedDocument(data)).toBe(false);
    expect(readDraggedDocumentPath(data)).toBeNull();
  });

  it.each(['', 'split-header:secondary', JSON.stringify(tab)])('does not interpret reserved plain text %j as a file', (plain) => {
    expect(readDraggedDocumentPath(transfer({ 'text/plain': plain }))).toBeNull();
  });

  it('supports a plain-text tab fallback but rejects incomplete, malformed, or conflicting payloads', () => {
    expect(readSplitTabDrag(transfer({ 'text/plain': JSON.stringify(tab) }))).toEqual(tab);
    const primary = { ...tab, sourcePaneId: 'primary' };
    expect(readSplitTabDrag(transfer({ [SPLIT_TAB_DRAG_MIME]: JSON.stringify(primary) }, [], false))).toEqual(primary);
    for (const type of [SPLIT_HEADER_DRAG_MIME, DOCUMENT_FILE_DRAG_MIME, 'text/html']) {
      expect(readSplitTabDrag(transfer({ [type]: JSON.stringify(tab) }))).toBeNull();
    }
    expect(readSplitTabDrag(transfer({ 'text/plain': '/readme.md' }))).toBeNull();
    for (const payload of ['null', '{bad json', JSON.stringify({ ...tab, filePath: 4 }), JSON.stringify({ ...tab, sourcePaneId: 'middle' })]) {
      expect(readSplitTabDrag(transfer({ [SPLIT_TAB_DRAG_MIME]: payload }))).toBeNull();
    }
    expect(hasDraggedSplitTab(transfer({ [SPLIT_TAB_DRAG_MIME]: '' }))).toBe(true);
    expect(hasDraggedSplitTab(transfer({ 'text/plain': JSON.stringify(tab) }))).toBe(false);
  });

  it('supports a plain-text pane fallback but rejects unrecognized or conflicting payloads', () => {
    expect(readSplitHeaderDrag(transfer({ 'text/plain': 'split-header:secondary' }))).toBe('secondary');
    expect(readSplitHeaderDrag(transfer({ [SPLIT_HEADER_DRAG_MIME]: 'secondary' }, [], false))).toBe('secondary');
    for (const type of [DOCUMENT_FILE_DRAG_MIME, SPLIT_TAB_DRAG_MIME, 'text/html']) {
      expect(readSplitHeaderDrag(transfer({ [type]: 'primary' }))).toBeNull();
    }
    expect(readSplitHeaderDrag(transfer({ [SPLIT_HEADER_DRAG_MIME]: '' }))).toBeNull();
    expect(readSplitHeaderDrag(transfer({ 'text/plain': '/readme.md' }))).toBeNull();
    expect(readSplitHeaderDrag(transfer({ 'text/plain': 'split-header:middle' }))).toBeNull();
    expect(hasDraggedSplitHeader(transfer({ 'text/plain': 'split-header:secondary' }))).toBe(false);
  });

  it('emits an open-in-split request only for a nonempty path', () => {
    const handleOpen = vi.fn();
    window.addEventListener(OPEN_IN_SPLIT_EVENT, handleOpen, { once: true });
    try {
      requestOpenInSplit('  ');
      expect(handleOpen).not.toHaveBeenCalled();
      requestOpenInSplit(' /notes/a.md ');
      expect(handleOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ detail: '/notes/a.md' }));
    } finally {
      window.removeEventListener(OPEN_IN_SPLIT_EVENT, handleOpen);
    }
  });
});
