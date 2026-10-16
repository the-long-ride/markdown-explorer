import { useCallback, useEffect, useRef, useState } from 'react';
import type { Translations } from '../../contexts/translations';
import { useAppState } from '../../contexts/AppStateContext';
import { documentSessionKey } from '../../editor/documentSession';
import type { PlatformBridge } from '../../platform/bridge';
import type { MdFile, SidebarItemKind, WorkspaceEntryKind } from '../../types';
import { requestCreateWorkspaceEntry } from '../../workspace/workspaceEntriesClient';
import { formatEntryError } from '../../workspace/workspaceEntryMessages';
import { validateWorkspaceEntryName, withDefaultExtension } from '../../workspace/workspaceEntryName';
import { findFolderNode, hasSiblingNamed, isListedFileName, parentEntryPath, toEntryPath } from '../../workspace/workspaceEntryPaths';

const MARKDOWN_NAME = /\.(md|mdx|markdown)$/i;
const FILE_PREFILL = '.md';

export interface EntryDraft {
  readonly kind: WorkspaceEntryKind;
  readonly parentPath: string;
  readonly value: string;
  readonly error: string | null;
  readonly busy: boolean;
}

interface Options {
  bridge: Pick<PlatformBridge, 'postMessage' | 'onMessage'>;
  t: Translations;
  workspaceKey: string;
}

function isSameDraft(current: EntryDraft | null, original: EntryDraft): current is EntryDraft {
  return current !== null && current.kind === original.kind && current.parentPath === original.parentPath;
}

export function useSidebarEntryCreation({ bridge, t, workspaceKey }: Options) {
  const { state, navigate, setDocumentEditMode } = useAppState();
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const focusRef = useRef<{ kind: SidebarItemKind; path: string } | null>(null);
  const pendingOpenRef = useRef<string | null>(null);
  const pendingEditRef = useRef<string | null>(null);
  const committingRef = useRef(false);
  const generationRef = useRef(0);
  const fileListRef = useRef<readonly MdFile[]>(state.fileList);
  fileListRef.current = state.fileList;

  useEffect(() => {
    generationRef.current += 1;
    committingRef.current = false;
    setDraft(null);
    setRevealPath(null);
    focusRef.current = null;
    pendingOpenRef.current = null;
    pendingEditRef.current = null;
  }, [workspaceKey]);

  // The host refreshes before replying, but the refreshed list may still be in flight (watcher race); retry on every list change.
  const tryOpenPending = useCallback(() => {
    const pending = pendingOpenRef.current;
    const file = pending ? fileListRef.current.find((candidate) => toEntryPath(candidate.relativePath) === pending) : undefined;
    if (!file) return;
    pendingOpenRef.current = null;
    navigate(file.fsPath);
    if (MARKDOWN_NAME.test(file.fileName)) {
      pendingEditRef.current = file.fsPath;
      setDocumentEditMode(file.fsPath, 'inline-edit');
    }
  }, [navigate, setDocumentEditMode]);

  useEffect(() => { tryOpenPending(); }, [state.fileList, tryOpenPending]);

  // The document session only exists once the host rendered the new file, so edit mode is re-applied when it shows up.
  useEffect(() => {
    const path = pendingEditRef.current;
    const session = path ? state.documentSessions?.[documentSessionKey(path)] : undefined;
    if (!path || !session) return;
    pendingEditRef.current = null;
    if (session.mode !== 'inline-edit') setDocumentEditMode(path, 'inline-edit');
  }, [setDocumentEditMode, state.documentSessions]);

  const rememberFocus = useCallback((kind: SidebarItemKind, path: string) => { focusRef.current = { kind, path }; }, []);
  const clearFocus = useCallback(() => { focusRef.current = null; }, []);

  const resolveParent = useCallback((): string => {
    const focus = focusRef.current;
    if (!focus) return '';
    if (focus.kind === 'folder') return findFolderNode(state.tree, focus.path) ? focus.path : '';
    const file = state.fileList.find((candidate) => candidate.fsPath === focus.path);
    return file ? parentEntryPath(toEntryPath(file.relativePath)) : '';
  }, [state.fileList, state.tree]);

  const start = useCallback((kind: WorkspaceEntryKind, parentPath?: string) => {
    if (committingRef.current) return;
    // A repeated reveal of the same path must be able to re-expand the folder later.
    setRevealPath(null);
    pendingOpenRef.current = null;
    pendingEditRef.current = null;
    setDraft({ kind, parentPath: parentPath ?? resolveParent(), value: kind === 'file' ? FILE_PREFILL : '', error: null, busy: false });
  }, [resolveParent]);

  // An in-flight draft must survive Escape/blur until the host answers.
  const cancel = useCallback(() => {
    if (committingRef.current) return;
    pendingOpenRef.current = null;
    setDraft((current) => (current?.busy ? current : null));
  }, []);
  const setValue = useCallback((value: string) => setDraft((current) => current && { ...current, value, error: null }), []);

  const localProblem = useCallback((current: EntryDraft, name: string) => validateWorkspaceEntryName(name)
    ?? (hasSiblingNamed(state.tree, current.parentPath, name, state.hostPlatform === 'linux') ? 'exists' as const : null),
  [state.hostPlatform, state.tree]);

  const commit = useCallback(async () => {
    if (!draft || draft.busy || committingRef.current) return;
    const trimmed = draft.value.trim();
    const name = withDefaultExtension(trimmed, draft.kind);
    // The untouched ".md" prefill (or an empty value) must never become a file literally named ".md".
    const untouched = !trimmed || (draft.kind === 'file' && trimmed === FILE_PREFILL);
    const problem = untouched ? 'empty' as const : localProblem(draft, name);
    if (problem) {
      const error = formatEntryError(t.sidebar, problem, name);
      setDraft((current) => (isSameDraft(current, draft) ? { ...current, error } : current));
      return;
    }
    const generation = generationRef.current;
    committingRef.current = true;
    setDraft({ ...draft, busy: true, error: null });
    try {
      const result = await requestCreateWorkspaceEntry(bridge, { parentPath: draft.parentPath, name, kind: draft.kind });
      // The workspace changed while the host was working: nothing here applies to the new workspace.
      if (generation !== generationRef.current) return;
      if (!result.ok || !result.path) {
        const error = formatEntryError(t.sidebar, result.reason ?? 'failed', name);
        setDraft((current) => (isSameDraft(current, draft) ? { ...current, busy: false, error } : current));
        return;
      }
      setDraft((current) => (isSameDraft(current, draft) ? null : current));
      if (draft.kind === 'folder') {
        setRevealPath(result.path);
        focusRef.current = { kind: 'folder', path: result.path };
      } else {
        setRevealPath(draft.parentPath || null);
        // An unlisted type never reaches fileList; a lingering pending open would hijack navigation later.
        if (isListedFileName(name, fileListRef.current)) pendingOpenRef.current = result.path;
        tryOpenPending();
      }
    } finally {
      if (generation === generationRef.current) committingRef.current = false;
    }
  }, [bridge, draft, localProblem, t.sidebar, tryOpenPending]);

  /** VS Code behaviour: blur commits a valid, non-empty name, otherwise cancels. The untouched ".md" prefill counts as empty. */
  const blur = useCallback(() => {
    if (!draft || draft.busy || committingRef.current) return;
    const value = draft.value.trim();
    if (!value || (draft.kind === 'file' && value === FILE_PREFILL)) return cancel();
    if (localProblem(draft, withDefaultExtension(value, draft.kind))) return cancel();
    void commit();
  }, [cancel, commit, draft, localProblem]);

  const hint = draft?.kind === 'file' && draft.value.trim() && !isListedFileName(withDefaultExtension(draft.value.trim(), 'file'), state.fileList)
    ? t.sidebar.entryUnlistedType
    : null;

  return { draft, hint, revealPath, start, cancel, setValue, commit, blur, rememberFocus, clearFocus };
}
