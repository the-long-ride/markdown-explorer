import { useCallback, useRef, useState, type ReactNode } from 'react';
import { getEditorUiTranslations, type EditorUiTranslations } from '../contexts/editorUiTranslations';
import type { SaveDocumentResultMessage } from '../types';
import { UnsavedChangesModal } from '../components/Modal/UnsavedChangesModal';
import { documentSessionKey, type EditableDocumentSession } from './documentSession';
import { collectDirtyDocumentPaths, type UnsavedChangesChoice } from './unsavedGuards';

interface PendingGuard {
  /** Stable across `advance()` so an in-flight save can tell whether its guard is still current. */
  readonly id: number;
  readonly filePaths: string[];
  readonly commit: () => void;
  readonly cancel?: () => void;
}

interface UseUnsavedChangesGuardOptions {
  readonly sessions: Readonly<Record<string, EditableDocumentSession>>;
  readonly saveDocument: (filePath: string) => Promise<SaveDocumentResultMessage | null>;
  readonly discardDocumentChanges: (filePath: string) => void;
  readonly labels?: EditorUiTranslations;
}

export interface UnsavedChangesGuardController {
  readonly guardUnsavedChanges: (filePaths: string[], commit: () => void, cancel?: () => void) => void;
  readonly unsavedChangesModal: ReactNode;
}

function fileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function saveFailureMessage(result: SaveDocumentResultMessage, labels: EditorUiTranslations): string {
  switch (result.reason) {
    case 'read-only': return `${labels.saveFailed} ${labels.saveFailedReadOnly}`;
    case 'permission-denied': return `${labels.saveFailed} ${labels.saveFailedPermissionDenied}`;
    case 'missing': return `${labels.saveFailed} ${labels.saveFailedMissing}`;
    case 'outside-workspace': return `${labels.saveFailed} ${labels.saveFailedOutsideWorkspace}`;
    case 'write-failed': return `${labels.saveFailed} ${labels.saveFailedWriteFailed}`;
    default: return labels.saveFailed;
  }
}

export function useUnsavedChangesGuard({
  sessions,
  saveDocument,
  discardDocumentChanges,
  labels,
}: UseUnsavedChangesGuardOptions): UnsavedChangesGuardController {
  const [pending, setPendingState] = useState<PendingGuard | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef<PendingGuard | null>(null);
  const nextIdRef = useRef(0);
  // Latest inputs live in refs so `guardUnsavedChanges` keeps a stable identity
  // instead of changing on every keystroke.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const saveDocumentRef = useRef(saveDocument);
  saveDocumentRef.current = saveDocument;
  const discardRef = useRef(discardDocumentChanges);
  discardRef.current = discardDocumentChanges;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const setPending = useCallback((next: PendingGuard | null) => {
    pendingRef.current = next;
    setPendingState(next);
    setSaveError(null);
    setSaving(false);
  }, []);

  const guardUnsavedChanges = useCallback((filePaths: string[], commit: () => void, cancel?: () => void) => {
    const dirty = new Set(collectDirtyDocumentPaths(sessionsRef.current).map(documentSessionKey));
    const guardedPaths = filePaths.filter((path) => dirty.has(documentSessionKey(path)));
    if (guardedPaths.length === 0) {
      commit();
      return;
    }
    // A newer guard supersedes the one still on screen; tell the earlier caller
    // it was not approved so it can answer e.g. a native close request.
    const superseded = pendingRef.current;
    nextIdRef.current += 1;
    setPending({ id: nextIdRef.current, filePaths: guardedPaths, commit, cancel });
    superseded?.cancel?.();
  }, [setPending]);

  const advance = useCallback((snapshot: PendingGuard) => {
    if (snapshot.filePaths.length <= 1) {
      setPending(null);
      snapshot.commit();
      return;
    }
    setPending({ ...snapshot, filePaths: snapshot.filePaths.slice(1) });
  }, [setPending]);

  const onChoose = useCallback(async (choice: UnsavedChangesChoice) => {
    const snapshot = pendingRef.current;
    if (!snapshot) return;
    if (choice === 'cancel') {
      setPending(null);
      snapshot.cancel?.();
      return;
    }
    const path = snapshot.filePaths[0];
    if (choice === 'discard') {
      discardRef.current(path);
      advance(snapshot);
      return;
    }
    setSaveError(null);
    setSaving(true);
    let result: SaveDocumentResultMessage | null;
    try {
      result = await saveDocumentRef.current(path);
    } catch {
      result = { command: 'saveDocumentResult', requestId: '', filePath: path, ok: false, reason: 'write-failed' };
    }
    // The guard was cancelled or replaced while saving: its caller already
    // heard "not approved", so it must not be committed now.
    if (pendingRef.current?.id !== snapshot.id) return;
    setSaving(false);
    if (!result || result.ok) {
      advance(snapshot);
      return;
    }
    if (result.reason === 'conflict') {
      // The conflict modal takes over; the guarded action is not approved.
      setPending(null);
      snapshot.cancel?.();
      return;
    }
    setSaveError(saveFailureMessage(result, labelsRef.current ?? getEditorUiTranslations()));
  }, [advance, setPending]);

  const currentPath = pending?.filePaths[0] ?? null;
  return {
    guardUnsavedChanges,
    unsavedChangesModal: currentPath
      ? (
        <UnsavedChangesModal
          fileName={fileName(currentPath)}
          labels={labels}
          saving={saving}
          errorMessage={saveError}
          onChoose={(choice) => { void onChoose(choice); }}
        />
      )
      : null,
  };
}
