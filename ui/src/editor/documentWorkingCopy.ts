import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import { renderMarkdownClientSide } from '../contexts/contentTabState';
import type { RenderContentMessage, SaveDocumentResultMessage } from '../types';
import {
  createEditableDocumentSession,
  discardWorkingChanges,
  documentSessionKey,
  isDocumentDirty,
  markSaveConflict,
  markSaveFailed,
  markSaveStarted,
  markSaveSucceeded,
  replaceWorkingSource,
  resolveConflictWithDisk,
  setDocumentEditMode,
  type MarkdownEditMode,
} from './documentSession';

export type DocumentEditingAction =
  | { readonly type: 'SET_WORKING_DOCUMENT_SOURCE'; readonly filePath: string; readonly source: string }
  | { readonly type: 'SET_DOCUMENT_EDIT_MODE'; readonly filePath: string; readonly mode: MarkdownEditMode }
  | { readonly type: 'DISCARD_DOCUMENT_CHANGES'; readonly filePath: string }
  | { readonly type: 'RESOLVE_DOCUMENT_CONFLICT_RELOAD'; readonly filePath: string }
  | { readonly type: 'MARK_DOCUMENT_SAVE_STARTED'; readonly filePath: string }
  | { readonly type: 'APPLY_SAVE_DOCUMENT_RESULT'; readonly result: SaveDocumentResultMessage };

function isEditableMarkdownPath(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

function updateTabProjection(state: AppState, filePath: string, source: string): AppState {
  const rendered = renderMarkdownClientSide(source, filePath, /\.mdx$/i.test(filePath), state.settings);
  const target = normalizePathKey(filePath);
  const contentTabs = state.contentTabs.map((tab) => normalizePathKey(tab.filePath) === target
    ? {
        ...tab,
        contentHtml: rendered.html,
        markdownSource: source,
        frontmatter: rendered.frontmatter,
        toc: rendered.toc,
      }
    : tab);
  const isCurrent = normalizePathKey(state.currentFile ?? '') === target;
  if (!isCurrent) return { ...state, contentTabs };
  return {
    ...state,
    contentTabs,
    contentHtml: rendered.html,
    markdownSource: source,
    frontmatter: rendered.frontmatter,
    toc: rendered.toc,
    renderVersion: state.renderVersion + 1,
  };
}

export function prepareRenderContentSession(
  state: AppState,
  msg: RenderContentMessage,
): { state: AppState; msg: RenderContentMessage } {
  const filePath = msg.filePath;
  const rawSource = msg.markdownSource;
  const writeCapability = msg.documentWrite;
  const canRequestBrowserPermission = writeCapability?.reason === 'permission-required';
  if (
    !filePath
    || rawSource === null
    || rawSource === undefined
    || !isEditableMarkdownPath(filePath)
    || (!writeCapability?.supported && !canRequestBrowserPermission)
  ) {
    return { state, msg };
  }

  const key = documentSessionKey(filePath);
  const existing = state.documentSessions[key];
  if (existing && isDocumentDirty(existing)) {
    return {
      state,
      msg: { ...msg, markdownSource: existing.source },
    };
  }

  const session = createEditableDocumentSession(filePath, rawSource, writeCapability?.revision ?? null);
  return {
    state: {
      ...state,
      documentSessions: { ...state.documentSessions, [key]: session },
    },
    msg: { ...msg, markdownSource: session.source },
  };
}

export function updateWorkingDocumentSource(state: AppState, filePath: string, source: string): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  const nextSession = replaceWorkingSource(session, source);
  return updateTabProjection({
    ...state,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  }, filePath, nextSession.source);
}

export function updateDocumentEditMode(state: AppState, filePath: string, mode: MarkdownEditMode): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  return {
    ...state,
    documentSessions: {
      ...state.documentSessions,
      [key]: setDocumentEditMode(session, mode),
    },
  };
}

export function discardWorkingDocumentChanges(state: AppState, filePath: string): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  const nextSession = discardWorkingChanges(session);
  return updateTabProjection({
    ...state,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  }, filePath, nextSession.source);
}

export function reloadDocumentConflictFromDisk(state: AppState, filePath: string): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session?.conflict) return state;
  const nextSession = resolveConflictWithDisk(session);
  const withSession = updateTabProjection({
    ...state,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  }, filePath, nextSession.source);
  return {
    ...withSession,
    contentTabs: withSession.contentTabs.map((tab) => normalizePathKey(tab.filePath) === normalizePathKey(filePath)
      ? { ...tab, documentWrite: tab.documentWrite ? { ...tab.documentWrite, revision: nextSession.revision } : tab.documentWrite }
      : tab),
  };
}

export function markDocumentSaveStarted(state: AppState, filePath: string): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  return {
    ...state,
    documentSessions: { ...state.documentSessions, [key]: markSaveStarted(session) },
  };
}

export function applySavedDocumentResult(state: AppState, result: SaveDocumentResultMessage): AppState {
  const key = documentSessionKey(result.filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  const nextSession = result.ok && result.revision
    ? markSaveSucceeded(session, result.revision)
    : result.reason === 'conflict' && result.diskSource !== undefined && result.diskRevision
      ? markSaveConflict(session, result.diskSource, result.diskRevision)
      : markSaveFailed(session);
  const contentTabs = result.ok && result.revision
    ? state.contentTabs.map((tab) => normalizePathKey(tab.filePath) === normalizePathKey(result.filePath)
      ? {
          ...tab,
          documentWrite: tab.documentWrite ? { ...tab.documentWrite, revision: result.revision! } : tab.documentWrite,
        }
      : tab)
    : state.contentTabs;
  return {
    ...state,
    contentTabs,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  };
}

export function reduceDocumentEditingAction(state: AppState, action: DocumentEditingAction): AppState | null {
  switch (action.type) {
    case 'SET_WORKING_DOCUMENT_SOURCE': return updateWorkingDocumentSource(state, action.filePath, action.source);
    case 'SET_DOCUMENT_EDIT_MODE': return updateDocumentEditMode(state, action.filePath, action.mode);
    case 'DISCARD_DOCUMENT_CHANGES': return discardWorkingDocumentChanges(state, action.filePath);
    case 'RESOLVE_DOCUMENT_CONFLICT_RELOAD': return reloadDocumentConflictFromDisk(state, action.filePath);
    case 'MARK_DOCUMENT_SAVE_STARTED': return markDocumentSaveStarted(state, action.filePath);
    case 'APPLY_SAVE_DOCUMENT_RESULT': return applySavedDocumentResult(state, action.result);
    default: return null;
  }
}
