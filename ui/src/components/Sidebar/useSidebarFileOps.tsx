import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Translations } from '../../contexts/translations';
import { useAppState } from '../../contexts/AppStateContext';
import type { PlatformBridge } from '../../platform/bridge';
import type { SidebarPinnedItem, WorkspaceEntryKind, WorkspaceEntryDeleteMode } from '../../types';
import { getWorkspaceEntryCapability, NO_WORKSPACE_ENTRY_CAPABILITY } from '../../workspace/workspaceEntryCapability';
import { entryBaseName, isSameOrDescendant, resolveSelectionEntries } from '../../workspace/workspaceEntryPaths';
import { TooltipButton } from '../shared/TooltipButton';
import { SidebarInlineEntryInput } from './SidebarInlineEntryInput';
import { SidebarSelectionActions } from './SidebarSelectionActions';
import { FilePlusIcon, FolderPlusIcon } from './sidebarEntryIcons';
import { SelectionModeIcon } from '../Bookmarks/BookmarkIcons';
import type { SidebarTreeEntryContextValue } from './sidebarTreeContext';
import { useSidebarEntryCreation } from './useSidebarEntryCreation';
import { useSidebarEntryDeletion } from './useSidebarEntryDeletion';
import { useSidebarEntryActions } from './useSidebarEntryActions';
import { useSidebarSelectionMode } from './useSidebarSelectionMode';

interface SidebarFileOpsOptions {
  enabled: boolean;
  bridge: PlatformBridge;
  t: Translations;
  workspaceKey: string;
  pinnedKeys: ReadonlySet<string>;
  removePins: (shouldRemove: (pin: SidebarPinnedItem) => boolean) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;
  onEnterSelection: () => void;
}

export function useSidebarFileOps({
  enabled, bridge, t, workspaceKey, pinnedKeys, removePins, expandAllFolders, collapseAllFolders, onEnterSelection,
}: SidebarFileOpsOptions) {
  const { state } = useAppState();
  const capability = enabled
    ? getWorkspaceEntryCapability(state.appRuntime, Boolean(state.workspacePath))
    : NO_WORKSPACE_ENTRY_CAPABILITY;
  const creation = useSidebarEntryCreation({ bridge, t, workspaceKey });
  const selection = useSidebarSelectionMode({ workspaceKey, onEnter: onEnterSelection });
  const deletion = useSidebarEntryDeletion({ bridge, t, deleteMode: capability.deleteMode });
  const entries = useMemo(() => resolveSelectionEntries(selection.selected, state.fileList), [selection.selected, state.fileList]);
  const pinnedSelected = useMemo(() => [...selection.selected].filter((key) => pinnedKeys.has(key)), [pinnedKeys, selection.selected]);
  const { start: startDraft, cancel: cancelDraft, clearFocus: clearCreationFocus, rememberFocus: rememberCreationFocus, revealPath } = creation;
  const { exit: exitSelection, enter: enterSelectionMode, getEpoch: getSelectionEpoch } = selection;
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const workspaceKeyRef = useRef(workspaceKey);
  useLayoutEffect(() => { workspaceKeyRef.current = workspaceKey; });

  const entryActions = useSidebarEntryActions({
    enabled: capability.create, active: enabled, workspaceKey, bridge, t, deleteMode: capability.deleteMode,
    deletion, removePins, selectionActive: selection.active, selectedPaths: entries.map(entry => entry.path), busy: deleting,
    onBusyChange: setDeleting, onBeforeRename: cancelDraft, getSelectionEpoch, exitSelection,
  });
  const rememberFocus = useCallback((kind: 'file' | 'folder', path: string) => {
    rememberCreationFocus(kind, path); entryActions.focusEntry(kind, path);
  }, [rememberCreationFocus, entryActions.focusEntry]);
  const startCreate = useCallback((kind: WorkspaceEntryKind, parentPath?: string) => {
    if (deleting) return;
    entryActions.cancelRename(false);
    exitSelection();
    startDraft(kind, parentPath);
  }, [deleting, entryActions.cancelRename, exitSelection, startDraft]);

  const enterSelection = useCallback(() => {
    cancelDraft();
    enterSelectionMode();
  }, [cancelDraft, enterSelectionMode]);

  // A collapsed folder unmounts the inline input (React fires no blur), so the draft must go with it.
  const collapseAll = useCallback(() => {
    cancelDraft();
    collapseAllFolders();
  }, [cancelDraft, collapseAllFolders]);

  const onTreeClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) { clearCreationFocus(); entryActions.clearFocus(); }
  }, [clearCreationFocus, entryActions]);

  const onDelete = useCallback(async (mode: WorkspaceEntryDeleteMode) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    const startedIn = workspaceKey;
    const startedEpoch = getSelectionEpoch();
    try {
      const { result, removedFsPaths, isGone } = await deletion.deleteEntries(entries.map((entry) => entry.path), mode);
      // Pins and selection belong to the workspace the delete started in; a switch meanwhile must not touch the new one.
      if (workspaceKeyRef.current !== startedIn) return;
      removePins((pin) => (pin.kind === 'folder' ? isGone(pin.path) : removedFsPaths.has(pin.path)));
      // Keep the selection when nothing was deleted so the user can retry, and never clear one the user
      // started after leaving and re-entering selection mode while the request was in flight.
      if (result.deleted.length > 0 && getSelectionEpoch() === startedEpoch) exitSelection();
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deletion, entries, exitSelection, getSelectionEpoch, removePins, workspaceKey]);

  const draft = creation.draft;
  const inlineInput = draft ? (
    <SidebarInlineEntryInput
      kind={draft.kind}
      value={draft.value}
      label={draft.kind === 'file' ? t.sidebar.newFileInputLabel : t.sidebar.newFolderInputLabel}
      error={draft.error}
      hint={creation.hint}
      busy={draft.busy}
      onChange={creation.setValue}
      onCommit={() => { void creation.commit(); }}
      onCancel={cancelDraft}
      onBlur={creation.blur}
    />
  ) : null;

  const draftParentPath = draft ? draft.parentPath : null;
  const onFolderCollapsed = useCallback((folderPath: string) => {
    if (draftParentPath !== null && isSameOrDescendant(draftParentPath, folderPath)) cancelDraft();
  }, [cancelDraft, draftParentPath]);

  const treeContext = useMemo<SidebarTreeEntryContextValue | null>(() => (enabled ? {
    inlineParentPath: draftParentPath,
    inlineInput,
    revealPath,
    selectionActive: selection.active,
    isSelected: selection.isSelected,
    toggleSelected: selection.toggle,
    selectItemLabel: t.sidebar.selectItem,
    rememberFocus,
    focusedKey: entryActions.focusedKey, renameKey: entryActions.renameKey, renameInput: entryActions.renameInput,
    onFolderCollapsed,
  } : null), [entryActions.focusedKey, entryActions.renameKey, entryActions.renameInput, draftParentPath, enabled, inlineInput, onFolderCollapsed, revealPath, rememberFocus, selection.active, selection.isSelected, selection.toggle, t.sidebar.selectItem]);

  const createActions = enabled && (capability.create || capability.deleteMode !== null) ? (
    <>
      {capability.create && (
        <>
          <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--new-file" disabled={deleting} onClick={() => startCreate('file')} tooltip={t.sidebar.newFile} label={t.sidebar.newFile} tooltipPos="below" tooltipAlign="left" icon={<FilePlusIcon size={14} />} />
          <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--new-folder" disabled={deleting} onClick={() => startCreate('folder')} tooltip={t.sidebar.newFolder} label={t.sidebar.newFolder} tooltipPos="below" icon={<FolderPlusIcon size={14} />} />
        </>
      )}
      <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--select" onClick={enterSelection} tooltip={t.sidebar.selectMode} label={t.sidebar.selectMode} tooltipPos="below" icon={<SelectionModeIcon size={14} />} />
    </>
  ) : null;

  const selectionToolbar = enabled && selection.active ? (
    <SidebarSelectionActions
      t={t}
      cancelLabel={t.bookmarks.cancel}
      entryNames={entries.map((entry) => entryBaseName(entry.path))}
      pinnedSelectedCount={pinnedSelected.length}
      deleteMode={capability.deleteMode}
      unsavedCount={deletion.countUnsaved(entries.map((entry) => entry.path))}
      onExpandAll={expandAllFolders}
      onCollapseAll={collapseAll}
      onUnpin={() => removePins((pin) => pinnedSelected.includes(`${pin.kind}:${pin.path}`))}
      busy={deleting}
      onDelete={onDelete}
      onRequestDelete={entryActions.requestDeleteSelection}
      onExit={exitSelection}
    />
  ) : null;

  return {
    capability,
    entryActions,
    treeContext,
    createActions,
    selectionToolbar,
    collapseAll,
    rootInput: enabled && draft?.parentPath === '' ? inlineInput : null,
    onTreeClick,
    startCreate,
    exitSelection,
  };
}
