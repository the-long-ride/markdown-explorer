import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SaveDocumentResultMessage } from '../types';
import { DocumentConflictBanner, DocumentConflictModal } from '../components/Modal/DocumentConflictModal';
import type { AppAction } from '../contexts/appStateReducer';
import type { SaveDocumentRequestOptions } from './saveDocument';
import type { EditableDocumentSession } from './documentSession';

export const DOCUMENT_COMPARE_REQUEST_EVENT = 'markdown-explorer-document-compare-request';

export interface DocumentCompareRequest {
  readonly filePath: string;
  readonly leftSource: string;
  readonly rightSource: string;
}

interface UseDocumentConflictResolutionOptions {
  readonly sessions: Readonly<Record<string, EditableDocumentSession>>;
  readonly dispatch: React.Dispatch<AppAction>;
  readonly saveDocument: (
    filePath: string,
    options?: SaveDocumentRequestOptions,
  ) => Promise<SaveDocumentResultMessage | null>;
  /** UI language for the conflict dialog and banner; defaults to English. */
  readonly language?: string;
}

/** Identifies one specific conflict so a fresh disk revision re-opens the dialog. */
function conflictKey(session: EditableDocumentSession | null): string | null {
  return session?.conflict ? `${session.filePath}\u0000${session.conflict.diskRevision}` : null;
}

export function useDocumentConflictResolution({
  sessions,
  dispatch,
  saveDocument,
  language,
}: UseDocumentConflictResolutionOptions) {
  const session = useMemo(
    () => Object.values(sessions).find((item) => item.saveState === 'conflict' && item.conflict) ?? null,
    [sessions],
  );
  // While comparing, the aria-modal dialog would hide and inert the diff view, so it
  // is swapped for a non-modal banner. Keyed per conflict: a new conflict shows the dialog.
  const [comparingKey, setComparingKey] = useState<string | null>(null);
  const currentKey = conflictKey(session);
  const comparing = currentKey !== null && comparingKey === currentKey;
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
  }, []);

  const reloadDisk = useCallback(() => {
    if (!session?.conflict) return;
    dispatch({ type: 'RESOLVE_DOCUMENT_CONFLICT_RELOAD', filePath: session.filePath });
  }, [dispatch, session]);

  const keepMine = useCallback(() => {
    if (!session?.conflict) return;
    void saveDocument(session.filePath, {
      force: true,
      expectedRevision: session.conflict.diskRevision,
    });
  }, [saveDocument, session]);

  const compare = useCallback(() => {
    if (!session?.conflict) return;
    const detail: DocumentCompareRequest = {
      filePath: session.filePath,
      leftSource: session.conflict.diskSource,
      rightSource: session.source,
    };
    setComparingKey(conflictKey(session));
    // The diff is shown for the active document only, so bring the conflicting
    // file forward first and request the diff once that activation has rendered.
    dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: session.filePath });
    if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    compareTimerRef.current = setTimeout(() => {
      compareTimerRef.current = null;
      window.dispatchEvent(new CustomEvent<DocumentCompareRequest>(DOCUMENT_COMPARE_REQUEST_EVENT, { detail }));
    }, 0);
  }, [dispatch, session]);

  const returnToResolution = useCallback(() => setComparingKey(null), []);

  const fileName = session ? session.filePath.split(/[\\/]/).pop() || session.filePath : '';
  let conflictModal: React.ReactNode = null;
  if (session?.conflict) {
    conflictModal = comparing ? (
      <DocumentConflictBanner
        fileName={fileName}
        language={language}
        onReload={reloadDisk}
        onKeepMine={keepMine}
        onReturn={returnToResolution}
      />
    ) : (
      <DocumentConflictModal
        key={currentKey}
        fileName={fileName}
        conflict={session.conflict}
        language={language}
        onReload={reloadDisk}
        onKeepMine={keepMine}
        onCompare={compare}
      />
    );
  }

  return { conflictModal };
}
