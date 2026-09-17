import { useCallback, useMemo } from 'react';
import type { SaveDocumentResultMessage } from '../types';
import { DocumentConflictModal } from '../components/Modal/DocumentConflictModal';
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
}

export function useDocumentConflictResolution({
  sessions,
  dispatch,
  saveDocument,
}: UseDocumentConflictResolutionOptions) {
  const session = useMemo(
    () => Object.values(sessions).find((item) => item.saveState === 'conflict' && item.conflict) ?? null,
    [sessions],
  );

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
    window.dispatchEvent(new CustomEvent<DocumentCompareRequest>(DOCUMENT_COMPARE_REQUEST_EVENT, { detail }));
  }, [session]);

  const conflictModal = session?.conflict ? (
    <DocumentConflictModal
      fileName={session.filePath.split(/[\\/]/).pop() || session.filePath}
      conflict={session.conflict}
      onReload={reloadDisk}
      onKeepMine={keepMine}
      onCompare={compare}
    />
  ) : null;

  return { conflictModal };
}
