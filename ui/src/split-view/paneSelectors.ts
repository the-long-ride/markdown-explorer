import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import { documentSessionKey, type EditableDocumentSession } from '../editor/documentSession';
import type { ContentTab } from '../types';
import type { DocumentViewMode, PaneId } from './paneState';

export interface PaneDocumentProjection {
  readonly filePath: string;
  readonly relativePath: string;
  readonly fileName: string;
  readonly title: string;
  readonly contentHtml: string;
  readonly source: string;
  readonly markdownSource: string | null;
  readonly sourceDocumentText: string | null;
  readonly mode: DocumentViewMode;
  readonly scrollTop: number;
  readonly tab: ContentTab;
  readonly session?: EditableDocumentSession;
}

function findPaneTab(state: AppState, filePath: string): ContentTab | undefined {
  const target = normalizePathKey(filePath);
  return state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === target);
}

export function selectPaneDocument(state: AppState, paneId: PaneId): PaneDocumentProjection | null {
  const pane = state.splitView[paneId];
  if (!pane.filePath) return null;

  const tab = findPaneTab(state, pane.filePath);
  if (!tab) return null;

  const session = state.documentSessions[documentSessionKey(tab.filePath)];
  const markdownSource = tab.markdownSource ?? tab.sourceDocumentText ?? null;
  const source = session?.source ?? markdownSource ?? '';

  return {
    filePath: tab.filePath,
    relativePath: tab.relativePath,
    fileName: tab.fileName,
    title: tab.title,
    contentHtml: tab.contentHtml,
    source,
    markdownSource,
    sourceDocumentText: tab.sourceDocumentText ?? null,
    mode: pane.mode,
    scrollTop: pane.scrollTop,
    tab,
    session,
  };
}
