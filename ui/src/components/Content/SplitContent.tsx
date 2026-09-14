import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { normalizePathKey, type AppState } from '../../contexts/appStateModel';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useHistoryView, type HistoryViewEntry, type HistoryViewTarget } from '../../contexts/HistoryContext';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import { isMarkdownEditingAvailable } from '../../editor/editingFeature';
import { selectPaneDocument, type PaneDocumentProjection } from '../../split-view/paneSelectors';
import type { DocumentViewMode, PaneId } from '../../split-view/paneState';
import { DocumentDiffView } from '../History/DocumentDiffView';
import { GitRevisionView } from '../History/GitRevisionView';
import { DocumentSurface } from './DocumentSurface';
import { SplitDocumentView } from './SplitDocumentView';

interface SplitContentViewProps {
  state: AppState; onActivatePane: (paneId: PaneId) => void; onRatioChange: (ratio: number) => void; onCloseSplit: () => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void; onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>; onScrollChange: (paneId: PaneId, scrollTop: number) => void;
}
interface PaneViewProps {
  paneId: PaneId;
  projection: PaneDocumentProjection | null;
  historyView?: HistoryViewEntry;
  language: string;
  documentRenderRevision: number;
  editingEnabled: boolean;
  clearHistoryView: (target?: HistoryViewTarget) => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void;
  onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
  onScrollChange: (paneId: PaneId, scrollTop: number) => void;
}
const EDITABLE_MODES = ['rendered', 'inline-edit', 'plain'] as const satisfies readonly DocumentViewMode[];
const READ_ONLY_MODES = ['rendered'] as const satisfies readonly DocumentViewMode[];
const SAME_DOCUMENT_PREVIEW_DEBOUNCE_MS = 150;

function sameHistoryView(left?: HistoryViewEntry, right?: HistoryViewEntry): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.filePath === right.filePath
    && left.mode === right.mode
    && left.revision === right.revision
    && left.comparison === right.comparison;
}

function samePaneProjection(left: PaneDocumentProjection | null, right: PaneDocumentProjection | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.filePath !== right.filePath
    || left.relativePath !== right.relativePath
    || left.fileName !== right.fileName
    || left.title !== right.title
    || left.mode !== right.mode
    || left.scrollTop !== right.scrollTop
    || left.session?.saveState !== right.session?.saveState
  ) return false;

  if (left.mode === 'plain' || left.mode === 'inline-edit') {
    return left.source === right.source && left.contentHtml === right.contentHtml;
  }
  return true;
}

function panePropsEqual(left: PaneViewProps, right: PaneViewProps): boolean {
  return left.paneId === right.paneId
    && left.language === right.language
    && left.editingEnabled === right.editingEnabled
    && left.documentRenderRevision === right.documentRenderRevision
    && samePaneProjection(left.projection, right.projection)
    && sameHistoryView(left.historyView, right.historyView);
}

function SplitPaneViewImpl({ paneId, projection, historyView, language, documentRenderRevision, editingEnabled, clearHistoryView, onModeChange, onSourceChange, onSave, onScrollChange }: PaneViewProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorT = getEditorUiTranslations(language);
  const historyT = getHistoryTranslations(language);
  const splitT = getSplitViewTranslations(language);
  const paneLabel = paneId === 'primary' ? splitT.primaryDocument : splitT.secondaryDocument;
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node && projection && node.scrollTop !== projection.scrollTop) node.scrollTop = projection.scrollTop;
  }, [projection?.filePath, projection?.mode, projection?.scrollTop]);
  if (!projection) return <div className="split-document-pane__empty">{splitT.noDocument}</div>;

  const modeLabels: Record<DocumentViewMode, string> = { rendered: editorT.rendered, 'inline-edit': editorT.inlineEdit, plain: editorT.plain, 'git-revision': historyT.revision, diff: historyT.diff };
  const historyMode = historyView?.mode;
  const baseModes: readonly DocumentViewMode[] = editingEnabled ? EDITABLE_MODES : READ_ONLY_MODES;
  const modes: readonly DocumentViewMode[] = historyMode && projection.mode === historyMode ? ['rendered', historyMode] : historyMode ? [...baseModes, historyMode] : baseModes;
  const surfaceMode: DocumentViewMode = !editingEnabled && (projection.mode === 'inline-edit' || projection.mode === 'plain')
    ? 'rendered'
    : projection.mode === 'git-revision' || projection.mode === 'diff' ? 'rendered' : projection.mode;
  return (
    <div className="split-document-pane__content">
      <header className="split-document-pane__header">
        <span className="split-document-pane__title" title={projection.filePath}>{projection.title || projection.fileName}</span>
        <div className="split-document-pane__modes" role="group" aria-label={`${paneLabel}: ${editorT.modeGroup}`}>
          {modes.map((mode) => <button key={mode} type="button" className={`split-document-pane__mode${projection.mode === mode ? ' is-active' : ''}`} aria-label={`${paneLabel} ${modeLabels[mode]}`} aria-pressed={projection.mode === mode} onClick={() => {
            if (mode === 'rendered' && projection.mode !== 'rendered' && historyView) clearHistoryView(paneId); else onModeChange(paneId, mode);
          }}>{modeLabels[mode]}</button>)}
        </div>
      </header>
      <div ref={scrollRef} className="split-document-pane__scroll" data-testid={`split-pane-scroll-${paneId}`} onScroll={(event) => onScrollChange(paneId, event.currentTarget.scrollTop)}>
        {projection.mode === 'git-revision' && historyView?.revision
          ? <GitRevisionView snapshot={historyView.revision} language={language} onReturnToCurrent={() => clearHistoryView(paneId)} />
          : projection.mode === 'diff' && historyView?.comparison
            ? <DocumentDiffView {...historyView.comparison} language={language} onReturnToCurrent={() => clearHistoryView(paneId)} />
            : <DocumentSurface filePath={projection.filePath} relativePath={projection.relativePath} mode={surfaceMode} contentHtml={projection.contentHtml} source={projection.source} stale={false} language={language} renderVersion={documentRenderRevision} disabled={!editingEnabled || projection.session?.saveState === 'saving'} onSourceChange={(source) => onSourceChange(projection.filePath, source)} onSave={() => onSave(projection.filePath)} onModeChange={(mode) => onModeChange(paneId, mode)} />}
      </div>
    </div>
  );
}

const SplitPaneView = memo(SplitPaneViewImpl, panePropsEqual);

function sameDocument(left: PaneDocumentProjection | null, right: PaneDocumentProjection | null): boolean {
  return Boolean(left && right && normalizePathKey(left.filePath) === normalizePathKey(right.filePath));
}

function isEditingMode(mode: DocumentViewMode | undefined): boolean {
  return mode === 'plain' || mode === 'inline-edit';
}

function usePaneRenderRevision(projection: PaneDocumentProjection | null, deferRenderedMirror: boolean): number {
  const revision = projection?.renderRevision ?? 0;
  const fileKey = projection ? normalizePathKey(projection.filePath) : '';
  const saveState = projection?.session?.saveState ?? 'idle';
  const [visibleRevision, setVisibleRevision] = useState(revision);
  const timerRef = useRef<number | null>(null);
  const previousFileKeyRef = useRef(fileKey);
  const previousSaveStateRef = useRef(saveState);

  useLayoutEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fileChanged = previousFileKeyRef.current !== fileKey;
    const saveTransition = saveState === 'saving' || previousSaveStateRef.current === 'saving';
    previousFileKeyRef.current = fileKey;
    previousSaveStateRef.current = saveState;

    if (!deferRenderedMirror || fileChanged || saveTransition) {
      setVisibleRevision(revision);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setVisibleRevision(revision);
    }, SAME_DOCUMENT_PREVIEW_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [deferRenderedMirror, fileKey, revision, saveState]);

  return deferRenderedMirror ? visibleRevision : revision;
}

export function SplitContentView({ state, onActivatePane, onRatioChange, onCloseSplit, onModeChange, onSourceChange, onSave, onScrollChange }: SplitContentViewProps) {
  const language = state.settings.language || 'en';
  const splitT = getSplitViewTranslations(language);
  const editingEnabled = isMarkdownEditingAvailable(state.settings);
  const { historyViews, clearHistoryView } = useHistoryView();
  const primary = selectPaneDocument(state, 'primary');
  const secondary = selectPaneDocument(state, 'secondary');
  const sharedDocument = sameDocument(primary, secondary);
  const primaryDeferred = editingEnabled && sharedDocument && primary?.mode === 'rendered' && isEditingMode(secondary?.mode);
  const secondaryDeferred = editingEnabled && sharedDocument && secondary?.mode === 'rendered' && isEditingMode(primary?.mode);
  const primaryRenderRevision = usePaneRenderRevision(primary, primaryDeferred);
  const secondaryRenderRevision = usePaneRenderRevision(secondary, secondaryDeferred);
  const primaryHistoryView = primary && historyViews.primary?.filePath === primary.filePath ? historyViews.primary : undefined;
  const secondaryHistoryView = secondary && historyViews.secondary?.filePath === secondary.filePath ? historyViews.secondary : undefined;

  return <main className="content content--split" id="mainContent"><SplitDocumentView ratio={state.splitView.ratio} activePane={state.splitView.activePane} primaryLabel={splitT.primaryDocument} secondaryLabel={splitT.secondaryDocument} closeSecondaryLabel={splitT.closeSecondaryPane} resizeLabel={splitT.resizeDocumentPanes} primary={<SplitPaneView paneId="primary" projection={primary} historyView={primaryHistoryView} language={language} documentRenderRevision={primaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} />} secondary={<SplitPaneView paneId="secondary" projection={secondary} historyView={secondaryHistoryView} language={language} documentRenderRevision={secondaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} />} onActivatePane={onActivatePane} onRatioChange={onRatioChange} onCloseSecondary={onCloseSplit} /></main>;
}

export function SplitContent() {
  const { state, activatePane, setSplitRatio, closeSplitView, setSplitPaneMode, setSplitPaneScrollTop, setWorkingDocumentSource, saveDocument } = useAppState();
  return <SplitContentView state={state} onActivatePane={activatePane} onRatioChange={setSplitRatio} onCloseSplit={closeSplitView} onModeChange={setSplitPaneMode} onSourceChange={setWorkingDocumentSource} onSave={saveDocument} onScrollChange={setSplitPaneScrollTop} />;
}
