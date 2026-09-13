import { useCallback, useState, type ReactNode } from 'react';
import type { SaveDocumentResultMessage } from '../types';
import { UnsavedChangesModal } from '../components/Modal/UnsavedChangesModal';
import { documentSessionKey, type EditableDocumentSession } from './documentSession';
import { collectDirtyDocumentPaths, type UnsavedChangesChoice } from './unsavedGuards';

interface PendingGuard {
  readonly filePaths: string[];
  readonly commit: () => void;
  readonly cancel?: () => void;
}

interface UseUnsavedChangesGuardOptions {
  readonly sessions: Readonly<Record<string, EditableDocumentSession>>;
  readonly saveDocument: (filePath: string) => Promise<SaveDocumentResultMessage | null>;
  readonly discardDocumentChanges: (filePath: string) => void;
}

export interface UnsavedChangesGuardController {
  readonly guardUnsavedChanges: (filePaths: string[], commit: () => void, cancel?: () => void) => void;
  readonly unsavedChangesModal: ReactNode;
}

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).at(-1) ?? filePath;
}

export function useUnsavedChangesGuard({
  sessions,
  saveDocument,
  discardDocumentChanges,
}: UseUnsavedChangesGuardOptions): UnsavedChangesGuardController {
  const [pending, setPending] = useState<PendingGuard | null>(null);

  const guardUnsavedChanges = useCallback((filePaths: string[], commit: () => void, cancel?: () => void) => {
    const dirty = new Set(collectDirtyDocumentPaths(sessions).map(documentSessionKey));
    const guardedPaths = filePaths.filter((path) => dirty.has(documentSessionKey(path)));
    if (guardedPaths.length === 0) {
      commit();
      return;
    }
    setPending({ filePaths: guardedPaths, commit, cancel });
  }, [sessions]);

  const advance = useCallback((snapshot: PendingGuard) => {
    if (snapshot.filePaths.length <= 1) {
      setPending(null);
      snapshot.commit();
      return;
    }
    setPending({ ...snapshot, filePaths: snapshot.filePaths.slice(1) });
  }, []);

  const onChoose = useCallback(async (choice: UnsavedChangesChoice) => {
    if (!pending) return;
    if (choice === 'cancel') {
      setPending(null);
      pending.cancel?.();
      return;
    }
    const path = pending.filePaths[0];
    if (choice === 'discard') {
      discardDocumentChanges(path);
      advance(pending);
      return;
    }
    const result = await saveDocument(path);
    if (result?.ok) advance(pending);
  }, [advance, discardDocumentChanges, pending, saveDocument]);

  const currentPath = pending?.filePaths[0] ?? null;
  return {
    guardUnsavedChanges,
    unsavedChangesModal: currentPath
      ? <UnsavedChangesModal fileName={fileName(currentPath)} onChoose={(choice) => { void onChoose(choice); }} />
      : null,
  };
}
