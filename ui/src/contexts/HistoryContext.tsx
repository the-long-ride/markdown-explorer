import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FileHistoryModal } from '../components/History/FileHistoryModal';
import { DOCUMENT_HISTORY_OPEN_EVENT } from '../components/shared/ToolbarActionMenu';
import { DOCUMENT_COMPARE_REQUEST_EVENT, type DocumentCompareRequest } from '../editor/useDocumentConflictResolution';
import { documentSessionKey } from '../editor/documentSession';
import type { GitComparisonSources, GitRevisionSnapshot } from '../history/contracts';
import { createHistoryClient, type HistoryClient } from '../history/historyClient';
import type { PaneId } from '../split-view/paneState';
import { useAppState } from './AppStateContext';
import { getEditorUiTranslations } from './editorUiTranslations';
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
  const { state, setSplitPaneMode, openRepositoryHistorySidebar } = useAppState();
  const editorT = getEditorUiTranslations(state.settings.language);
  const [client, setClient] = useState(() => createHistoryClient(bridge));
  const clientBridge = useRef(bridge);
  const [modalFilePath, setModalFilePath] = useState<string | null>(null);
  const [historyViews, setHistoryViews] = useState<Partial<Record<HistoryViewTarget, HistoryViewEntry>>>({});
  useEffect(() => {
    // StrictMode replays effects (cleanup disposes the client), and a new bridge needs its own client:
    // never keep serving a disposed one, or every History request fails with "disposed".
    if (client.isDisposed() || clientBridge.current !== bridge) {
      clientBridge.current = bridge;
      setClient(createHistoryClient(bridge));
      return;
    }
    return () => client.dispose();
  }, [bridge, client]);

  const activeTarget = useCallback((): HistoryViewTarget => state.splitView.enabled ? state.splitView.activePane : 'single', [state.splitView.activePane, state.splitView.enabled]);
  const activeFilePath = useCallback(() => state.splitView.enabled ? state.splitView[state.splitView.activePane].filePath ?? state.currentFile : state.currentFile, [state.currentFile, state.splitView]);
  const setView = useCallback((entry: HistoryViewEntry) => {
    const target = activeTarget();
    setHistoryViews((current) => ({ ...current, [target]: entry }));
    if (target !== 'single') setSplitPaneMode(target, entry.mode);
  }, [activeTarget, setSplitPaneMode]);
  const openHistory = useCallback((filePath?: string | null) => {
    const target = filePath ?? activeFilePath();
    if (target) setModalFilePath(target);
  }, [activeFilePath]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string }>).detail;
      if (detail?.filePath) {
        openHistory(detail.filePath);
      } else {
        openRepositoryHistorySidebar();
      }
    };
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
  }, [editorT.diskVersion, editorT.myEdit, openHistory, openRepositoryHistorySidebar, setView]);

  const closeHistory = useCallback(() => setModalFilePath(null), []);
  const currentSource = useCallback(() => {
    if (!modalFilePath) return null;
    return state.documentSessions[documentSessionKey(modalFilePath)]?.source ?? null;
  }, [modalFilePath, state.documentSessions]);
  const clearHistoryView = useCallback((target?: HistoryViewTarget) => {
    const resolved = target ?? activeTarget();
    setHistoryViews((current) => { const next = { ...current }; delete next[resolved]; return next; });
    if (resolved !== 'single') setSplitPaneMode(resolved, 'rendered');
  }, [activeTarget, setSplitPaneMode]);

  const value = useMemo<HistoryContextValue>(() => ({ client, historyViews, openHistory, closeHistory, clearHistoryView }), [client, historyViews, openHistory, closeHistory, clearHistoryView]);
  return (
    <HistoryContext.Provider value={value}>
      {children}
      {modalFilePath && <FileHistoryModal key={modalFilePath} filePath={modalFilePath} client={client} language={state.settings.language} workspacePath={state.workspacePath} bridge={bridge} currentSource={currentSource} onClose={closeHistory} />}
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
