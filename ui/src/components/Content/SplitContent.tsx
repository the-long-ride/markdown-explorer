import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { normalizePathKey, type AppState } from '../../contexts/appStateModel';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useHistoryView, type HistoryViewEntry, type HistoryViewTarget } from '../../contexts/HistoryContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import { isMarkdownEditingAvailable } from '../../editor/editingFeature';
import { selectPaneDocument, type PaneDocumentProjection } from '../../split-view/paneSelectors';
import type { DocumentViewMode, PaneId } from '../../split-view/paneState';
import { DocumentDiffView } from '../History/DocumentDiffView';
import { GitRevisionView } from '../History/GitRevisionView';
import { DocumentSurface } from './DocumentSurface';
import { SplitDocumentView } from './SplitDocumentView';

interface SplitContentViewProps {
  state: AppState;
  onActivatePane: (paneId: PaneId) => void;
  onRatioChange: (ratio: number) => void;
  onCloseSplit: () => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void;
  onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
  onScrollChange: (paneId: PaneId, scrollTop: number) => void;
  onTabActivate?: (paneId: PaneId, filePath: string) => void;
  onTabClose?: (paneId: PaneId, filePath: string) => void;
}

interface PaneViewProps {
  paneId: PaneId;
  projection: PaneDocumentProjection | null;
  paneTabs: readonly string[];
  activeTabPath: string | null;
  tabLabels: ReadonlyMap<string, string>;
  showTabs: boolean;
  historyView?: HistoryViewEntry;
  language: string;
  documentRenderRevision: number;
  editingEnabled: boolean;
  clearHistoryView: (target?: HistoryViewTarget) => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void;
  onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
  onScrollChange: (paneId: PaneId, scrollTop: number) => void;
  onTabActivate?: (paneId: PaneId, filePath: string) => void;
  onTabClose?: (paneId: PaneId, filePath: string) => void;
}

const EDITABLE_MODES = ['inline-edit', 'plain'] as const satisfies readonly DocumentViewMode[];
const READ_ONLY_MODES = [] as const satisfies readonly DocumentViewMode[];
const SAME_DOCUMENT_PREVIEW_DEBOUNCE_MS = 150;
const SCROLL_PERSIST_DELAY_MS = 180;

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
    || left.session?.saveState !== right.session?.saveState
  ) return false;

  if (left.mode === 'plain' || left.mode === 'inline-edit') {
    return left.source === right.source && left.contentHtml === right.contentHtml;
  }
  return true;
}

function samePaths(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

function sameTabLabels(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>, paths: readonly string[]): boolean {
  return paths.every((path) => left.get(normalizePathKey(path)) === right.get(normalizePathKey(path)));
}

function panePropsEqual(left: PaneViewProps, right: PaneViewProps): boolean {
  return left.paneId === right.paneId
    && left.language === right.language
    && left.editingEnabled === right.editingEnabled
    && left.documentRenderRevision === right.documentRenderRevision
    && left.activeTabPath === right.activeTabPath
    && left.showTabs === right.showTabs
    && samePaths(left.paneTabs, right.paneTabs)
    && sameTabLabels(left.tabLabels, right.tabLabels, right.paneTabs)
    && samePaneProjection(left.projection, right.projection)
    && sameHistoryView(left.historyView, right.historyView);
}

function SplitPaneTabs({
  paneId,
  paths,
  activePath,
  labels,
  onActivate,
  onClose,
}: {
  paneId: PaneId;
  paths: readonly string[];
  activePath: string | null;
  labels: ReadonlyMap<string, string>;
  onActivate?: (paneId: PaneId, filePath: string) => void;
  onClose?: (paneId: PaneId, filePath: string) => void;
}) {
  return (
    <div className="split-document-pane__tabs" role="tablist" aria-label={`${paneId} document tabs`}>
      {paths.map((path) => {
        const active = normalizePathKey(path) === normalizePathKey(activePath ?? '');
        const label = labels.get(normalizePathKey(path)) ?? path.split(/[\\/]/).pop() ?? path;
        return (
          <div key={path} className={`split-document-pane__tab-wrap${active ? ' is-active' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="split-document-pane__tab"
              title={path}
              onClick={() => onActivate?.(paneId, path)}
            >
              {label}
            </button>
            <button
              type="button"
              className="split-document-pane__tab-close"
              aria-label={`Close ${label}`}
              onClick={(event) => { event.stopPropagation(); onClose?.(paneId, path); }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SplitPaneViewImpl({
  paneId,
  projection,
  paneTabs,
  activeTabPath,
  tabLabels,
  showTabs,
  historyView,
  language,
  documentRenderRevision,
  editingEnabled,
  clearHistoryView,
  onModeChange,
  onSourceChange,
  onSave,
  onScrollChange,
  onTabActivate,
  onTabClose,
}: PaneViewProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(projection?.scrollTop ?? 0);
  const scrollTimerRef = useRef<number | null>(null);
  const editorT = getEditorUiTranslations(language);
  const historyT = getHistoryTranslations(language);
  const splitT = getSplitViewTranslations(language);
  const paneLabel = paneId === 'primary' ? splitT.primaryDocument : splitT.secondaryDocument;

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !projection) return;
    scrollTopRef.current = projection.scrollTop;
    if (node.scrollTop !== projection.scrollTop) node.scrollTop = projection.scrollTop;
  }, [projection?.filePath, projection?.mode]);

  useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const handleScroll = (node: HTMLDivElement) => {
    scrollTopRef.current = node.scrollTop;
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      scrollTimerRef.current = null;
      onScrollChange(paneId, scrollTopRef.current);
    }, SCROLL_PERSIST_DELAY_MS);
  };

  if (!projection) return <div className="split-document-pane__empty">{splitT.noDocument}</div>;

  const modeLabels: Record<DocumentViewMode, string> = {
    rendered: editorT.rendered,
    'inline-edit': editorT.inlineEdit,
    plain: editorT.plain,
    'git-revision': historyT.revision,
    diff: historyT.diff,
  };
  const historyMode = historyView?.mode;
  const baseModes: readonly DocumentViewMode[] = editingEnabled ? EDITABLE_MODES : READ_ONLY_MODES;
  const modes: readonly DocumentViewMode[] = historyMode && projection.mode === historyMode
    ? ['rendered', historyMode]
    : historyMode
      ? [...baseModes, historyMode]
      : projection.mode === 'rendered'
        ? baseModes
        : ['rendered', ...baseModes];
  const surfaceMode: DocumentViewMode = !editingEnabled && (projection.mode === 'inline-edit' || projection.mode === 'plain')
    ? 'rendered'
    : projection.mode === 'git-revision' || projection.mode === 'diff' ? 'rendered' : projection.mode;

  return (
    <div className="split-document-pane__content">
      <header className="split-document-pane__header">
        {showTabs ? (
          <SplitPaneTabs
            paneId={paneId}
            paths={paneTabs}
            activePath={activeTabPath}
            labels={tabLabels}
            onActivate={onTabActivate}
            onClose={onTabClose}
          />
        ) : (
          <span className="split-document-pane__title" title={projection.filePath}>{projection.title || projection.fileName}</span>
        )}
        {modes.length > 0 && (
          <div className="split-document-pane__modes" role="group" aria-label={`${paneLabel}: ${editorT.modeGroup}`}>
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`split-document-pane__mode${projection.mode === mode ? ' is-active' : ''}`}
                aria-label={`${paneLabel} ${modeLabels[mode]}`}
                aria-pressed={projection.mode === mode}
                onClick={() => {
                  if (mode === 'rendered' && projection.mode !== 'rendered' && historyView) clearHistoryView(paneId);
                  else onModeChange(paneId, mode);
                }}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>
        )}
      </header>
      <div
        ref={scrollRef}
        className="split-document-pane__scroll"
        data-testid={`split-pane-scroll-${paneId}`}
        onScroll={(event) => handleScroll(event.currentTarget)}
      >
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
  const previousDeferredRef = useRef(deferRenderedMirror);

  useLayoutEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fileChanged = previousFileKeyRef.current !== fileKey;
    const saveTransition = saveState === 'saving' || previousSaveStateRef.current === 'saving';
    const wasDeferred = previousDeferredRef.current;
    previousFileKeyRef.current = fileKey;
    previousSaveStateRef.current = saveState;
    previousDeferredRef.current = deferRenderedMirror;

    if (!deferRenderedMirror) return;
    if (!wasDeferred || fileChanged || saveTransition) {
      setVisibleRevision(revision);
      return;
    }
    if (revision === visibleRevision) return;

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
  }, [deferRenderedMirror, fileKey, revision, saveState, visibleRevision]);

  return deferRenderedMirror ? visibleRevision : revision;
}

export function SplitContentView({
  state,
  onActivatePane,
  onRatioChange,
  onCloseSplit,
  onModeChange,
  onSourceChange,
  onSave,
  onScrollChange,
  onTabActivate,
  onTabClose,
}: SplitContentViewProps) {
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
  const tabLabels = new Map<string, string>();
  for (const tab of state.contentTabs) tabLabels.set(normalizePathKey(tab.filePath), tab.title || tab.fileName);
  for (const file of state.fileList) {
    const key = normalizePathKey(file.fsPath);
    if (!tabLabels.has(key)) tabLabels.set(key, state.settings.showTitle ? file.title || file.fileName : file.fileName);
  }

  return (
    <main className="content content--split" id="mainContent">
      <SplitDocumentView
        ratio={state.splitView.ratio}
        activePane={state.splitView.activePane}
        primaryLabel={splitT.primaryDocument}
        secondaryLabel={splitT.secondaryDocument}
        closeSecondaryLabel={splitT.closeSecondaryPane}
        resizeLabel={splitT.resizeDocumentPanes}
        primary={<SplitPaneView paneId="primary" projection={primary} paneTabs={state.splitView.primary.tabs} activeTabPath={state.splitView.primary.activeTabPath} tabLabels={tabLabels} showTabs={state.settings.fileTabs} historyView={primaryHistoryView} language={language} documentRenderRevision={primaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} onTabActivate={onTabActivate} onTabClose={onTabClose} />}
        secondary={<SplitPaneView paneId="secondary" projection={secondary} paneTabs={state.splitView.secondary.tabs} activeTabPath={state.splitView.secondary.activeTabPath} tabLabels={tabLabels} showTabs={state.settings.fileTabs} historyView={secondaryHistoryView} language={language} documentRenderRevision={secondaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} onTabActivate={onTabActivate} onTabClose={onTabClose} />}
        onActivatePane={onActivatePane}
        onRatioChange={onRatioChange}
        onCloseSecondary={onCloseSplit}
      />
    </main>
  );
}

export function SplitContent() {
  const {
    state,
    dispatch,
    activatePane,
    setSplitRatio,
    closeSplitView,
    setSplitPaneMode,
    setSplitPaneScrollTop,
    setWorkingDocumentSource,
    saveDocument,
  } = useAppState();
  const bridge = usePlatform();

  const activateTab = (paneId: PaneId, filePath: string) => {
    dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
    dispatch({ type: 'ACTIVATE_SPLIT_PANE_TAB', paneId, filePath });
    if (state.contentTabs.some((tab) => normalizePathKey(tab.filePath) === normalizePathKey(filePath))) {
      dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath });
    }
    bridge.postMessage({ command: 'navigate', path: filePath });
  };

  const closeTab = (paneId: PaneId, filePath: string) => {
    const pane = state.splitView[paneId];
    const index = pane.tabs.findIndex((path) => normalizePathKey(path) === normalizePathKey(filePath));
    if (index < 0) return;
    const remaining = pane.tabs.filter((_, tabIndex) => tabIndex !== index);
    const fallback = normalizePathKey(pane.activeTabPath ?? '') === normalizePathKey(filePath)
      ? remaining[index - 1] ?? remaining[index] ?? null
      : pane.activeTabPath;
    dispatch({ type: 'CLOSE_SPLIT_PANE_TAB', paneId, filePath });
    if (fallback && normalizePathKey(pane.activeTabPath ?? '') === normalizePathKey(filePath)) {
      if (state.contentTabs.some((tab) => normalizePathKey(tab.filePath) === normalizePathKey(fallback))) {
        dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: fallback });
      }
      bridge.postMessage({ command: 'navigate', path: fallback });
    }
  };

  return (
    <SplitContentView
      state={state}
      onActivatePane={activatePane}
      onRatioChange={setSplitRatio}
      onCloseSplit={closeSplitView}
      onModeChange={setSplitPaneMode}
      onSourceChange={setWorkingDocumentSource}
      onSave={saveDocument}
      onScrollChange={setSplitPaneScrollTop}
      onTabActivate={activateTab}
      onTabClose={closeTab}
    />
  );
}
