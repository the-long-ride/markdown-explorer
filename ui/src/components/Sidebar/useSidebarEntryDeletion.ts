import { useCallback, useRef } from 'react';
import type { Translations } from '../../contexts/translations';
import { useAppState } from '../../contexts/AppStateContext';
import { getWorkspaceScopeKey } from '../../contexts/contentTabState';
import { documentSessionKey } from '../../editor/documentSession';
import { collectDirtyDocumentPaths } from '../../editor/unsavedGuards';
import type { PlatformBridge } from '../../platform/bridge';
import type { WorkspaceEntryDeleteMode } from '../../types';
import { dispatchActionNotice } from '../../utils/actionNotice';
import { requestDeleteWorkspaceEntries } from '../../workspace/workspaceEntriesClient';
import { fillTemplate } from '../../workspace/workspaceEntryMessages';
import { entryBaseName, isSameOrDescendant, toEntryPath } from '../../workspace/workspaceEntryPaths';

interface Options {
  bridge: Pick<PlatformBridge, 'postMessage' | 'onMessage'>;
  t: Translations;
  deleteMode: WorkspaceEntryDeleteMode | null;
}

export function useSidebarEntryDeletion({ bridge, t, deleteMode }: Options) {
  const { state, closeContentTab, discardDocumentChanges } = useAppState();

  const currentWorkspace = useRef(getWorkspaceScopeKey(state.workspacePath, state.workspaceName));
  currentWorkspace.current = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);

  const countUnsaved = useCallback((paths: readonly string[]) => {
    // Sessions are keyed by normalized path; compare normalized keys, not raw fsPaths.
    const dirty = new Set(collectDirtyDocumentPaths(state.documentSessions ?? {}).map(documentSessionKey));
    return state.fileList.filter((file) => dirty.has(documentSessionKey(file.fsPath))
      && paths.some((path) => isSameOrDescendant(toEntryPath(file.relativePath), path))).length;
  }, [state.documentSessions, state.fileList]);

  const deleteEntries = useCallback(async (paths: readonly string[], mode: WorkspaceEntryDeleteMode = deleteMode ?? 'trash') => {
    // Snapshot first: the host refreshes the tree before it replies.
    const startedIn = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
    const filesBefore = state.fileList;
    const result = await requestDeleteWorkspaceEntries(bridge, paths, mode);
    const isGone = (entryPath: string) => result.deleted.some((deleted) => isSameOrDescendant(entryPath, deleted));
    const removed = filesBefore.filter((file) => isGone(toEntryPath(file.relativePath)));
    for (const file of currentWorkspace.current === startedIn || state.appRuntime !== 'chrome' ? removed : []) {
      discardDocumentChanges(file.fsPath);
      closeContentTab(file.fsPath);
    }
    if (currentWorkspace.current === startedIn && result.failed.length > 0) {
      dispatchActionNotice(fillTemplate(t.sidebar.deleteFailed, { names: result.failed.map((failure) => entryBaseName(failure.path)).join(', ') }), 'error');
    }
    return { result, removedFsPaths: new Set(removed.map((file) => file.fsPath)), isGone };
  }, [bridge, closeContentTab, deleteMode, discardDocumentChanges, state.fileList, state.workspaceName, state.workspacePath, state.appRuntime, t.sidebar.deleteFailed]);

  return { countUnsaved, deleteEntries };
}
