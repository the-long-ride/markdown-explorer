import { useCallback, useRef } from 'react';
import { useAppState } from '../contexts/AppStateContext';
import { requestWindowClose } from '../editor/nativeCloseApproval';
import { collectDirtyDocumentPaths } from '../editor/unsavedGuards';
import { usePlatform } from '../contexts/PlatformContext';

export type DirtyDocumentsGuard = (commit: () => void, cancel?: () => void) => void;

/**
 * One guard for every action that would throw away the open documents (switch
 * or close the workspace, close the window): runs `commit` immediately when
 * nothing is dirty, otherwise shows the unsaved-changes prompt first. The
 * returned function is referentially stable and always reads the latest sessions.
 */
export function useDirtyDocumentsGuard(): DirtyDocumentsGuard {
  const { state, guardUnsavedChanges } = useAppState();
  const latestRef = useRef({ state, guardUnsavedChanges });
  latestRef.current = { state, guardUnsavedChanges };
  return useCallback((commit, cancel) => {
    const { state: latestState, guardUnsavedChanges: guard } = latestRef.current;
    const dirtyPaths = collectDirtyDocumentPaths(latestState.documentSessions ?? {});
    if (!guard || dirtyPaths.length === 0) {
      commit();
      return;
    }
    guard(dirtyPaths, commit, cancel);
  }, []);
}

/** Close-button handler shared by every renderer-drawn window control. */
export function useRequestWindowClose(): () => void {
  const bridge = usePlatform();
  const guard = useDirtyDocumentsGuard();
  return useCallback(() => requestWindowClose(bridge, guard), [bridge, guard]);
}
