import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import {
  createContentTabFromMessage,
  refreshContentTabMetadata,
  renderMarkdownClientSide,
  upsertContentTab,
} from '../contexts/contentTabState';
import { resolveRenderedDocument } from '../contexts/renderedDocument';
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
} from './documentSession';

export type DocumentEditingAction =
  | { readonly type: 'SET_WORKING_DOCUMENT_SOURCE'; readonly filePath: string; readonly source: string }
  | { readonly type: 'DISCARD_DOCUMENT_CHANGES'; readonly filePath: string }
  | { readonly type: 'MARK_DOCUMENT_SAVE_STARTED'; readonly filePath: string }
  | { readonly type: 'APPLY_SAVE_DOCUMENT_RESULT'; readonly result: SaveDocumentResultMessage };

function isEditableMarkdownPath(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

function sessionForPath(state: AppState, filePath: string) {
  return state.documentSessions[documentSessionKey(filePath)];
}

function updateTabProjection(state: AppState, filePath: string, source: string): AppState {
  const rendered = renderMarkdownClientSide(
    source,
    filePath,
    /\.mdx$/i.test(filePath),
    state.settings,
  );
  const target = normalizePathKey(filePath);
  const contentTabs = state.contentTabs.map((tab) => (
    normalizePathKey(tab.filePath) === target
      ? {
          ...tab,
          contentHtml: rendered.html,
          markdownSource: source,
          frontmatter: rendered.frontmatter,
          toc: rendered.toc,
        }
      : tab
  ));
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

export function updateWorkingDocumentSource(
  state: AppState,
  filePath: string,
  source: string,
): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  const nextSession = replaceWorkingSource(session, source);
  return updateTabProjection({
    ...state,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  }, filePath, nextSession.source);
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

export function markDocumentSaveStarted(state: AppState, filePath: string): AppState {
  const key = documentSessionKey(filePath);
  const session = state.documentSessions[key];
  if (!session) return state;
  return {
    ...state,
    documentSessions: {
      ...state.documentSessions,
      [key]: markSaveStarted(session),
    },
  };
}

export function applySavedDocumentResult(
  state: AppState,
  result: SaveDocumentResultMessage,
): AppState {
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
          documentWrite: tab.documentWrite
            ? { ...tab.documentWrite, revision: result.revision! }
            : tab.documentWrite,
        }
      : tab)
    : state.contentTabs;

  return {
    ...state,
    contentTabs,
    documentSessions: { ...state.documentSessions, [key]: nextSession },
  };
}

export function reduceDocumentEditingAction(
  state: AppState,
  action: DocumentEditingAction,
): AppState | null {
  switch (action.type) {
    case 'SET_WORKING_DOCUMENT_SOURCE':
      return updateWorkingDocumentSource(state, action.filePath, action.source);
    case 'DISCARD_DOCUMENT_CHANGES':
      return discardWorkingDocumentChanges(state, action.filePath);
    case 'MARK_DOCUMENT_SAVE_STARTED':
      return markDocumentSaveStarted(state, action.filePath);
    case 'APPLY_SAVE_DOCUMENT_RESULT':
      return applySavedDocumentResult(state, action.result);
    default:
      return null;
  }
}

export function applyRenderContentWithSession(
  state: AppState,
  msg: RenderContentMessage,
  htmlPreviewOverride?: boolean,
): AppState {
  const filePath = msg.filePath || null;
  const nextFileList = msg.fileList ?? state.fileList;
  const hostRendered = resolveRenderedDocument(msg, state.settings);
  let documentSessions = state.documentSessions;
  let effectiveSource = msg.markdownSource ?? null;
  let effectiveRendered = hostRendered;

  if (
    filePath
    && effectiveSource !== null
    && isEditableMarkdownPath(filePath)
    && msg.documentWrite?.supported
  ) {
    const key = documentSessionKey(filePath);
    const existing = state.documentSessions[key];
    let session = existing;
    if (!existing || !isDocumentDirty(existing)) {
      session = createEditableDocumentSession(filePath, effectiveSource, msg.documentWrite.revision);
      documentSessions = { ...state.documentSessions, [key]: session };
    }
    if (session) {
      effectiveSource = session.source;
      if (isDocumentDirty(session)) {
        effectiveRendered = renderMarkdownClientSide(
          session.source,
          filePath,
          /\.mdx$/i.test(filePath),
          state.settings,
        );
      }
    }
  }

  const existingTab = filePath
    ? state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(filePath))
    : undefined;
  const retainedCurrentOverride =
    filePath && normalizePathKey(state.currentFile ?? '') === normalizePathKey(filePath)
      ? state.currentHtmlPreviewOverride
      : undefined;
  const resolvedHtmlPreviewOverride =
    htmlPreviewOverride ?? existingTab?.htmlPreviewOverride ?? retainedCurrentOverride;

  const baseState: AppState = {
    ...state,
    documentSessions,
    fileList: nextFileList,
    currentFile: filePath,
    contentHtml: effectiveRendered.html,
    markdownSource: effectiveSource,
    sourceDocumentText: msg.sourceDocumentText ?? null,
    currentHtmlPreviewOverride: resolvedHtmlPreviewOverride,
    frontmatter: effectiveRendered.frontmatter,
    toc: effectiveRendered.toc,
    previewInfo: msg.previewInfo ?? null,
    relativePath: msg.relativePath,
    isLoading: false,
    loadingLabel: '',
    loadingDetail: '',
    staleContentFilePath: null,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    renderVersion: state.renderVersion + 1,
  };

  if (!state.settings.fileTabs) {
    return { ...baseState, contentTabs: [], activeContentTabPath: null };
  }
  if (!filePath) {
    return {
      ...baseState,
      contentTabs: refreshContentTabMetadata(state.contentTabs, nextFileList),
      activeContentTabPath: null,
    };
  }

  const tab = {
    ...createContentTabFromMessage(msg, nextFileList, effectiveRendered),
    contentHtml: effectiveRendered.html,
    markdownSource: effectiveSource,
    frontmatter: effectiveRendered.frontmatter,
    toc: effectiveRendered.toc,
    documentWrite: msg.documentWrite,
    htmlPreviewOverride: resolvedHtmlPreviewOverride,
  };
  return {
    ...baseState,
    contentTabs: upsertContentTab(
      refreshContentTabMetadata(state.contentTabs, nextFileList),
      tab,
    ),
    activeContentTabPath: filePath,
  };
}

export function getDocumentSession(state: AppState, filePath: string) {
  return sessionForPath(state, filePath);
}
