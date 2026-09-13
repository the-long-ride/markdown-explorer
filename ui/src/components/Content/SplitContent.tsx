import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { AppState } from '../../contexts/appStateModel';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useHistoryView } from '../../contexts/HistoryContext';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
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
  paneId: PaneId; projection: PaneDocumentProjection | null; language: string; renderVersion: number;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void; onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>; onScrollChange: (paneId: PaneId, scrollTop: number) => void;
}
const EDITABLE_MODES = ['rendered', 'inline-edit', 'plain'] as const satisfies readonly DocumentViewMode[];

function SplitPaneView({ paneId, projection, language, renderVersion, onModeChange, onSourceChange, onSave, onScrollChange }: PaneViewProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { historyViews, clearHistoryView } = useHistoryView();
  const editorT = getEditorUiTranslations(language);
  const historyT = getHistoryTranslations(language);
  const splitT = getSplitViewTranslations(language);
  const paneLabel = paneId === 'primary' ? splitT.primaryDocument : splitT.secondaryDocument;
  const historyView = projection && historyViews[paneId]?.filePath === projection.filePath ? historyViews[paneId] : undefined;
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node && projection && node.scrollTop !== projection.scrollTop) node.scrollTop = projection.scrollTop;
  }, [projection?.filePath, projection?.mode, projection?.scrollTop]);
  if (!projection) return <div className="split-document-pane__empty">{splitT.noDocument}</div>;

  const modeLabels: Record<DocumentViewMode, string> = { rendered: editorT.rendered, 'inline-edit': editorT.inlineEdit, plain: editorT.plain, 'git-revision': historyT.revision, diff: historyT.diff };
  const historyMode = historyView?.mode;
  const modes: readonly DocumentViewMode[] = historyMode && projection.mode === historyMode ? ['rendered', historyMode] : historyMode ? [...EDITABLE_MODES, historyMode] : EDITABLE_MODES;
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
            : <DocumentSurface filePath={projection.filePath} relativePath={projection.relativePath} mode={projection.mode === 'git-revision' || projection.mode === 'diff' ? 'rendered' : projection.mode} contentHtml={projection.contentHtml} source={projection.source} stale={false} language={language} renderVersion={renderVersion} disabled={projection.session?.saveState === 'saving'} onSourceChange={(source) => onSourceChange(projection.filePath, source)} onSave={() => onSave(projection.filePath)} />}
      </div>
    </div>
  );
}

export function SplitContentView({ state, onActivatePane, onRatioChange, onCloseSplit, onModeChange, onSourceChange, onSave, onScrollChange }: SplitContentViewProps) {
  const language = state.settings.language || 'en';
  const splitT = getSplitViewTranslations(language);
  const primary = selectPaneDocument(state, 'primary');
  const secondary = selectPaneDocument(state, 'secondary');
  return <main className="content content--split" id="mainContent"><SplitDocumentView ratio={state.splitView.ratio} activePane={state.splitView.activePane} primaryLabel={splitT.primaryDocument} secondaryLabel={splitT.secondaryDocument} closeSecondaryLabel={splitT.closeSecondaryPane} resizeLabel={splitT.resizeDocumentPanes} primary={<SplitPaneView paneId="primary" projection={primary} language={language} renderVersion={state.renderVersion} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} />} secondary={<SplitPaneView paneId="secondary" projection={secondary} language={language} renderVersion={state.renderVersion} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} />} onActivatePane={onActivatePane} onRatioChange={onRatioChange} onCloseSecondary={onCloseSplit} /></main>;
}

export function SplitContent() {
  const { state, activatePane, setSplitRatio, closeSplitView, setSplitPaneMode, setSplitPaneScrollTop, setWorkingDocumentSource, saveDocument } = useAppState();
  return <SplitContentView state={state} onActivatePane={activatePane} onRatioChange={setSplitRatio} onCloseSplit={closeSplitView} onModeChange={setSplitPaneMode} onSourceChange={setWorkingDocumentSource} onSave={saveDocument} onScrollChange={setSplitPaneScrollTop} />;
}
