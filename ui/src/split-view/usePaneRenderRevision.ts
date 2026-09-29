import { useLayoutEffect, useRef, useState } from 'react';
import { normalizePathKey } from '../contexts/appStateModel';
import type { PaneDocumentProjection } from './paneSelectors';
import type { DocumentViewMode } from './paneState';

// When both panes show the document being edited, the rendered mirror refreshes
// on a short debounce so typing in the editor pane stays responsive.
const SAME_DOCUMENT_PREVIEW_DEBOUNCE_MS = 150;

export function sameDocument(left: PaneDocumentProjection | null, right: PaneDocumentProjection | null): boolean {
  return Boolean(left && right && normalizePathKey(left.filePath) === normalizePathKey(right.filePath));
}

export function isEditingMode(mode: DocumentViewMode | undefined): boolean {
  return mode === 'plain' || mode === 'inline-edit';
}

export function usePaneRenderRevision(projection: PaneDocumentProjection | null, deferRenderedMirror: boolean): number {
  const revision = projection?.renderRevision ?? 0;
  const fileKey = projection ? normalizePathKey(projection.filePath) : '';
  const saveState = projection?.session?.saveState ?? 'idle';
  const [visibleRevision, setVisibleRevision] = useState(revision);
  const timerRef = useRef<number | null>(null);
  const previousFileKeyRef = useRef(fileKey);
  const previousSaveStateRef = useRef(saveState);
  const previousDeferredRef = useRef(deferRenderedMirror);

  useLayoutEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fileChanged = previousFileKeyRef.current !== fileKey;
    const saveTransition = saveState === 'saving' || previousSaveStateRef.current === 'saving';
    const wasDeferred = previousDeferredRef.current;
    previousFileKeyRef.current = fileKey;
    previousSaveStateRef.current = saveState;
    previousDeferredRef.current = deferRenderedMirror;

    if (!deferRenderedMirror) return;
    if (!wasDeferred || fileChanged || saveTransition) {
      setVisibleRevision(revision);
      return;
    }
    if (revision === visibleRevision) return;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setVisibleRevision(revision);
    }, SAME_DOCUMENT_PREVIEW_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [deferRenderedMirror, fileKey, revision, saveState, visibleRevision]);

  return deferRenderedMirror ? visibleRevision : revision;
}
