import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { Translations } from '../../contexts/translations';
import type { PlatformBridge } from '../../platform/bridge';
import type { SidebarItemKind, SidebarPinnedItem, WorkspaceEntryDeleteMode, RenameWorkspaceEntryResultMessage } from '../../types';
import { bookmarkStore } from '../../bookmarks/bookmarkStore';
import { requestRenameWorkspaceEntry } from '../../workspace/workspaceEntriesClient';
import { entryBaseName, findFolderNode, toEntryPath } from '../../workspace/workspaceEntryPaths';
import { isProtectedSegment, validateWorkspaceEntryName } from '../../workspace/workspaceEntryName';
import { formatEntryError } from '../../workspace/workspaceEntryMessages';
import { dispatchActionNotice } from '../../utils/actionNotice';
import { SidebarEntryRenameInput } from './SidebarEntryRenameInput';
import { SidebarDeleteDialog } from './SidebarDeleteDialog';
import type { useSidebarEntryDeletion } from './useSidebarEntryDeletion';

type Entry = { kind: SidebarItemKind; path: string };
type Draft = { entry: Entry; path: string; original: string; value: string; error: string | null; busy: boolean };
interface Options {
  enabled: boolean; active: boolean; workspaceKey: string; bridge: PlatformBridge; t: Translations;
  deleteMode: WorkspaceEntryDeleteMode | null; deletion: ReturnType<typeof useSidebarEntryDeletion>;
  removePins: (predicate: (pin: SidebarPinnedItem) => boolean) => void;
  selectionActive: boolean; selectedPaths: readonly string[]; busy: boolean; onBusyChange: (busy: boolean) => void; onBeforeRename: () => void; getSelectionEpoch: () => number; exitSelection: () => void;
}

export function useSidebarEntryActions({ enabled, active, workspaceKey, bridge, t, deleteMode, deletion, removePins, selectionActive, selectedPaths, busy, onBusyChange, onBeforeRename, getSelectionEpoch, exitSelection }: Options) {
  const { state, dispatch } = useAppState();
  const [focused, setFocused] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<{ paths: string[]; names: string[]; workspaceKey: string; unsavedCount: number; selectionEpoch: number | null } | null>(null);
  const running = useRef(false);
  const generation = useRef(0);
  const latestWorkspace = useRef(workspaceKey);
  latestWorkspace.current = workspaceKey;
  useLayoutEffect(() => { generation.current += 1; running.current = false; onBusyChange(false); setFocused(null); setDraft(null); setTarget(null); }, [workspaceKey, onBusyChange]);
  useEffect(() => { if (!active) { setFocused(null); if (!running.current) setDraft(null); setTarget(null); } }, [active]);
  useEffect(() => {
    if (focused && !(focused.kind === 'file' ? state.fileList.some(file => file.fsPath === focused.path) : findFolderNode(state.tree, focused.path))) setFocused(null);
  }, [focused, state.fileList, state.tree]);
  const relativePath = useCallback((entry: Entry) => entry.kind === 'folder' ? entry.path
    : toEntryPath(state.fileList.find(file => file.fsPath === entry.path)?.relativePath ?? ''), [state.fileList]);
  const canChange = useCallback((entry: Entry) => {
    const path = relativePath(entry);
    return enabled && Boolean(path) && !path.split('/').some(isProtectedSegment);
  }, [enabled, relativePath]);
  const focusEntry = useCallback((kind: SidebarItemKind, path: string) => setFocused(current => current?.kind === kind && current.path === path ? current : { kind, path }), []);
  const startRename = useCallback((kind: SidebarItemKind, path: string) => {
    const entry = { kind, path };
    if (!canChange(entry) || running.current || busy || selectionActive) return;
    onBeforeRename();
    const relative = relativePath(entry);
    setFocused(entry);
    setDraft({ entry, path: relative, original: entryBaseName(relative), value: entryBaseName(relative), error: null, busy: false });
  }, [busy, canChange, onBeforeRename, relativePath, selectionActive]);
  const restoreFocus = useCallback((entry: Entry | null) => {
    if (!entry) return;
    const origin = latestWorkspace.current;
    requestAnimationFrame(() => {
      if (latestWorkspace.current !== origin) return;
      const row = Array.from(document.querySelectorAll<HTMLElement>('#sidebarTree [data-sidebar-kind][data-sidebar-id]')).find(row => row.dataset.sidebarKind === entry.kind && row.dataset.sidebarId === (entry.kind === 'folder' ? 'folder:' + entry.path : entry.path));
      row?.focus({ preventScroll: true });
    });
  }, []);
  const cancelRename = useCallback((restore = true) => {
    if (!running.current) { setDraft(null); if (restore) restoreFocus(draft?.entry ?? null); }
  }, [draft?.entry, restoreFocus]);
  const commit = useCallback(async () => {
    if (!draft || running.current || busy) return;
    if (draft.value === draft.original) { setDraft(null); restoreFocus(draft.entry); return; }
    const problem = validateWorkspaceEntryName(draft.value);
    if (problem) { setDraft({ ...draft, error: formatEntryError(t.sidebar, problem, draft.value) }); return; }
    const started = workspaceKey;
    const startedGeneration = generation.current;
    const sample = state.fileList.find(file => toEntryPath(file.relativePath) === draft.path || toEntryPath(file.relativePath).startsWith(`${draft.path}/`));
    const root = sample ? sample.fsPath.replace(/\\/g, '/').slice(0, -toEntryPath(sample.relativePath).length).replace(/\/$/, '') : (state.workspacePath ?? '').replace(/\\/g, '/').replace(/\/$/, '');
    running.current = true; onBusyChange(true);
    setDraft({ ...draft, busy: true, error: null });
    const reconcile = (result: RenameWorkspaceEntryResultMessage) => {
      if (result.ok && result.path) {
        // Persisted bookmark identity belongs to the original workspace even if it is now inactive.
        dispatch({ type: 'RENAME_WORKSPACE_ENTRY', workspaceKey: started, oldPath: draft.path, newPath: result.path, oldAbsolutePath: root ? root + '/' + draft.path : draft.path, newAbsolutePath: root ? root + '/' + result.path : result.path });
        try { bookmarkStore.relocatePaths(started, root ? root + '/' + draft.path : draft.path, root ? root + '/' + result.path : result.path); }
        catch { dispatchActionNotice(t.bookmarks.storageUnavailable, 'error'); }
      }
      if (latestWorkspace.current !== started || generation.current !== startedGeneration) return;
      if (result.ok && result.path) {
        const renamed = root ? root + '/' + result.path : result.path;
        setFocused({ kind: draft.entry.kind, path: draft.entry.kind === 'folder' ? result.path : draft.entry.path.includes('\\') ? renamed.replace(/\//g, '\\') : renamed });
        setDraft(null);
      } else {
        if (result.error) dispatchActionNotice(result.error, 'error');
        setDraft({ ...draft, busy: Boolean(result.pending), error: result.pending ? null : formatEntryError(t.sidebar, result.reason ?? 'failed', draft.value) });
      }
      if (!result.pending) { running.current = false; onBusyChange(false); if (result.ok && result.path) restoreFocus({ kind: draft.entry.kind, path: draft.entry.kind === 'folder' ? result.path : draft.entry.path.includes('\\') ? (root + '/' + result.path).replace(/\//g, '\\') : root ? root + '/' + result.path : result.path }); }
    };
    reconcile(await requestRenameWorkspaceEntry(bridge, { path: draft.path, name: draft.value, kind: draft.entry.kind }, { onLateResult: reconcile }));
  }, [bridge, busy, dispatch, draft, onBusyChange, restoreFocus, state.fileList, state.workspacePath, t, workspaceKey]);
  const openDeletePaths = useCallback((paths: readonly string[]) => {
    if (!enabled || !deleteMode || !paths.length || paths.some(path => !path || path.split('/').some(isProtectedSegment)) || running.current || busy) return;
    cancelRename(false);
    setTarget({ paths: [...paths], names: paths.map(entryBaseName), workspaceKey, unsavedCount: deletion.countUnsaved(paths), selectionEpoch: selectionActive ? getSelectionEpoch() : null });
  }, [enabled, deleteMode, busy, cancelRename, workspaceKey, deletion, selectionActive, getSelectionEpoch]);
  const requestDelete = useCallback((kind: SidebarItemKind, path: string) => {
    const entry = { kind, path };
    if (!canChange(entry)) return;
    openDeletePaths(selectionActive && selectedPaths.length ? selectedPaths : [relativePath(entry)]);
  }, [canChange, openDeletePaths, selectedPaths, selectionActive, relativePath]);
  const confirmDelete = async (mode: WorkspaceEntryDeleteMode) => {
    const snapshot = target;
    if (!snapshot || snapshot.workspaceKey !== latestWorkspace.current || running.current) return;
    setTarget(null); running.current = true; onBusyChange(true);
    try {
      const { result, isGone, removedFsPaths } = await deletion.deleteEntries(snapshot.paths, mode);
      if (latestWorkspace.current !== snapshot.workspaceKey) return;
      removePins(pin => pin.kind === 'folder' ? isGone(pin.path) : removedFsPaths.has(pin.path));
      if (result.deleted.length && snapshot.selectionEpoch !== null && getSelectionEpoch() === snapshot.selectionEpoch) exitSelection();
      setFocused(null);
    } finally { running.current = false; onBusyChange(false); }
  };
  const onTreeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !focused || draft || target || running.current || busy) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="menu"], button')) return;
    if (event.key === 'F2' && !selectionActive && canChange(focused)) {
      event.preventDefault(); event.stopPropagation(); startRename(focused.kind, focused.path);
    } else if (event.key === 'Delete' && deleteMode && canChange(focused)) {
      event.preventDefault(); event.stopPropagation(); requestDelete(focused.kind, focused.path);
    }
  };
  return {
    focusedKey: focused ? `${focused.kind}:${focused.path}` : null,
    renameKey: draft ? `${draft.entry.kind}:${draft.entry.path}` : null,
    requestDeleteSelection: () => openDeletePaths(selectedPaths),
    focusEntry, clearFocus: () => setFocused(null), startRename, requestDelete, canChange, onTreeKeyDown, cancelRename,
    renameInput: draft ? <SidebarEntryRenameInput value={draft.value} file={draft.entry.kind === 'file'} label={draft.entry.kind === 'file' ? t.sidebar.renameFile : t.sidebar.renameFolder} error={draft.error} busy={draft.busy}
      onChange={value => setDraft(current => current ? { ...current, value, error: null } : current)} onCommit={() => { void commit(); }} onCancel={cancelRename} /> : null,
    deleteDialog: target && deleteMode ? <SidebarDeleteDialog t={t} cancelLabel={t.bookmarks.cancel} entryNames={target.names} deleteMode={deleteMode} unsavedCount={target.unsavedCount}
      onCancel={() => { setTarget(null); restoreFocus(focused); }} onConfirm={mode => { void confirmDelete(mode); }} /> : null,
  };
}
