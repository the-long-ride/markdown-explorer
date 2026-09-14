import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DocumentHistoryPanel } from '../components/History/DocumentHistoryPanel';
import { DOCUMENT_HISTORY_OPEN_EVENT } from '../components/shared/ToolbarActionMenu';
import { DOCUMENT_COMPARE_REQUEST_EVENT, type DocumentCompareRequest } from '../editor/useDocumentConflictResolution';
import { documentSessionKey } from '../editor/documentSession';
import type { GitComparisonSources, GitRevisionSnapshot, GitRevisionSummary } from '../history/contracts';
import { createHistoryClient, type HistoryClient } from '../history/historyClient';
import type { PaneId } from '../split-view/paneState';
import { useAppState } from './AppStateContext';
import { getEditorUiTranslations } from './editorUiTranslations';
import { getHistoryTranslations } from './historyTranslations';
import { usePlatform } from './PlatformContext';

export type HistoryViewTarget = 'single' | PaneId;
export interface HistoryViewEntry {
  readonly filePath: string;
  readonly mode: 'git-revision' | 'diff';
  readonly revision?: GitRevisionSnapshot;
  readonly comparison?: GitComparisonSources;
}
interface HistoryContextValue {
  client: HistoryClient;
  historyViews: Partial<Record<HistoryViewTarget, HistoryViewEntry>>;
  openHistory: (filePath?: string | null) => void;
  closeHistory: () => void;
  viewRevision: (revision: GitRevisionSummary) => Promise<void>;
  compareWithCurrent: (revision: GitRevisionSummary) => Promise<void>;
  compareWithWorkingCopy: (revision: GitRevisionSummary) => Promise<void>;
  compareSelected: (left: GitRevisionSummary, right: GitRevisionSummary) => Promise<void>;
  clearHistoryView: (target?: HistoryViewTarget) => void;
}
export type HistoryViewContextValue = Pick<HistoryContextValue, 'historyViews' | 'clearHistoryView'>;
const HistoryContext = createContext<HistoryContextValue | null>(null);
const EMPTY_HISTORY_VIEWS: HistoryViewContextValue['historyViews'] = {};
const EMPTY_HISTORY_VIEW_CONTEXT: HistoryViewContextValue = {
  historyViews: EMPTY_HISTORY_VIEWS,
  clearHistoryView: () => undefined,
};

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const bridge = usePlatform();
  const { state, setSplitPaneMode } = useAppState();
  const t = getHistoryTranslations(state.settings.language);
  const editorT = getEditorUiTranslations(state.settings.language);
  const client = useMemo(() => createHistoryClient(bridge), [bridge]);
  const [panelFilePath, setPanelFilePath] = useState<string | null>(null);
  const [historyViews, setHistoryViews] = useState<Partial<Record<HistoryViewTarget, HistoryViewEntry>>>({});
  useEffect(() => () => client.dispose(), [client]);

  const activeTarget = useCallback((): HistoryViewTarget => state.splitView.enabled ? state.splitView.activePane : 'single', [state.splitView.activePane, state.splitView.enabled]);
  const activeFilePath = useCallback(() => state.splitView.enabled ? state.splitView[state.splitView.activePane].filePath ?? state.currentFile : state.currentFile, [state.currentFile, state.splitView]);
  const setView = useCallback((entry: HistoryViewEntry) => {
    const target = activeTarget();
    setHistoryViews((current) => ({ ...current, [target]: entry }));
    if (target !== 'single') setSplitPaneMode(target, entry.mode);
  }, [activeTarget, setSplitPaneMode]);
  const openHistory = useCallback((filePath?: string | null) => {
    const target = filePath ?? activeFilePath();
    if (target) setPanelFilePath(target);
  }, [activeFilePath]);

  useEffect(() => {
    const handleOpen = () => openHistory();
    const handleCompare = (event: Event) => {
      const detail = (event as CustomEvent<DocumentCompareRequest>).detail;
      if (!detail?.filePath) return;
      setView({
        filePath: detail.filePath,
        mode: 'diff',
        comparison: {
          leftSource: detail.leftSource,
          rightSource: detail.rightSource,
          leftLabel: editorT.diskVersion,
          rightLabel: editorT.myEdit,
        },
      });
    };
    window.addEventListener(DOCUMENT_HISTORY_OPEN_EVENT, handleOpen);
    window.addEventListener(DOCUMENT_COMPARE_REQUEST_EVENT, handleCompare);
    return () => {
      window.removeEventListener(DOCUMENT_HISTORY_OPEN_EVENT, handleOpen);
      window.removeEventListener(DOCUMENT_COMPARE_REQUEST_EVENT, handleCompare);
    };
  }, [editorT.diskVersion, editorT.myEdit, openHistory, setView]);

  const closeHistory = useCallback(() => setPanelFilePath(null), []);
  const viewRevision = useCallback(async (revision: GitRevisionSummary) => {
    const filePath = panelFilePath ?? activeFilePath();
    if (!filePath) return;
    setView({ filePath, mode: 'git-revision', revision: await client.readGitRevision(revision.oid, revision.path) });
    setPanelFilePath(null);
  }, [activeFilePath, client, panelFilePath, setView]);
  const compareRevisionToSource = useCallback(async (revision: GitRevisionSummary, source: string, rightLabel: string) => {
    const filePath = panelFilePath ?? activeFilePath();
    if (!filePath) return;
    const snapshot = await client.readGitRevision(revision.oid, revision.path);
    setView({ filePath, mode: 'diff', comparison: { leftSource: snapshot.source, rightSource: source, leftLabel: `${revision.shortOid}:${revision.path}`, rightLabel } });
    setPanelFilePath(null);
  }, [activeFilePath, client, panelFilePath, setView]);
  const compareWithCurrent = useCallback(async (revision: GitRevisionSummary) => {
    const filePath = panelFilePath ?? activeFilePath();
    if (!filePath) return;
    const session = state.documentSessions[documentSessionKey(filePath)];
    await compareRevisionToSource(revision, session?.persistedSource ?? state.markdownSource ?? '', t.current);
  }, [activeFilePath, compareRevisionToSource, panelFilePath, state.documentSessions, state.markdownSource, t.current]);
  const compareWithWorkingCopy = useCallback(async (revision: GitRevisionSummary) => {
    const filePath = panelFilePath ?? activeFilePath();
    if (!filePath) return;
    const session = state.documentSessions[documentSessionKey(filePath)];
    await compareRevisionToSource(revision, session?.source ?? state.markdownSource ?? '', t.workingCopy);
  }, [activeFilePath, compareRevisionToSource, panelFilePath, state.documentSessions, state.markdownSource, t.workingCopy]);
  const compareSelected = useCallback(async (left: GitRevisionSummary, right: GitRevisionSummary) => {
    const filePath = panelFilePath ?? activeFilePath();
    if (!filePath) return;
    setView({ filePath, mode: 'diff', comparison: await client.compareGitRevisions({ kind: 'revision', oid: left.oid, path: left.path }, { kind: 'revision', oid: right.oid, path: right.path }) });
    setPanelFilePath(null);
  }, [activeFilePath, client, panelFilePath, setView]);
  const clearHistoryView = useCallback((target?: HistoryViewTarget) => {
    const resolved = target ?? activeTarget();
    setHistoryViews((current) => { const next = { ...current }; delete next[resolved]; return next; });
    if (resolved !== 'single') setSplitPaneMode(resolved, 'rendered');
  }, [activeTarget, setSplitPaneMode]);

  const value = useMemo<HistoryContextValue>(() => ({ client, historyViews, openHistory, closeHistory, viewRevision, compareWithCurrent, compareWithWorkingCopy, compareSelected, clearHistoryView }), [client, historyViews, openHistory, closeHistory, viewRevision, compareWithCurrent, compareWithWorkingCopy, compareSelected, clearHistoryView]);
  return (
    <HistoryContext.Provider value={value}>
      {children}
      {panelFilePath && <DocumentHistoryPanel filePath={panelFilePath} client={client} language={state.settings.language} onClose={closeHistory} onViewRevision={viewRevision} onCompareCurrent={compareWithCurrent} onCompareWorkingCopy={compareWithWorkingCopy} onCompareSelected={compareSelected} />}
    </HistoryContext.Provider>
  );
}

export function useHistory(): HistoryContextValue {
  const context = useContext(HistoryContext);
  if (!context) throw new Error('useHistory must be used within HistoryProvider');
  return context;
}

export function useHistoryView(): HistoryViewContextValue {
  const context = useContext(HistoryContext);
  return context ?? EMPTY_HISTORY_VIEW_CONTEXT;
}
