import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import { documentSessionKey, type EditableDocumentSession } from '../editor/documentSession';
import type { ContentTab, DocumentPreviewInfo, Frontmatter, TocEntry } from '../types';
import { selectDocumentRenderRevision } from './documentRenderRevision';
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
  readonly renderRevision: number;
  readonly tab: ContentTab;
  readonly session?: EditableDocumentSession;
  readonly frontmatter: Frontmatter;
  readonly toc: readonly TocEntry[];
  readonly previewInfo: DocumentPreviewInfo | null;
  readonly htmlPreviewOverride?: boolean;
  readonly stale: boolean;
}

function findPaneTab(state: AppState, filePath: string): ContentTab | undefined {
  const target = normalizePathKey(filePath);
  const existing = state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === target);
  if (existing) return existing;
  const file = state.fileList.find((f) => normalizePathKey(f.fsPath) === target);
  if (file) {
    return {
      filePath: file.fsPath,
      relativePath: file.relativePath,
      fileName: file.fileName,
      title: file.title || file.fileName,
      contentHtml: '',
      markdownSource: null,
      sourceDocumentText: null,
      frontmatter: {},
      toc: [],
      previewInfo: null,
      documentWrite: undefined,
    };
  }
  return undefined;
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
    renderRevision: selectDocumentRenderRevision(state, tab.filePath),
    tab,
    session,
    frontmatter: tab.frontmatter ?? {},
    toc: tab.toc ?? [],
    previewInfo: tab.previewInfo ?? null,
    htmlPreviewOverride: tab.htmlPreviewOverride,
    stale: Boolean(state.staleContentFilePath) && normalizePathKey(state.staleContentFilePath!) === normalizePathKey(tab.filePath),
  };
}
