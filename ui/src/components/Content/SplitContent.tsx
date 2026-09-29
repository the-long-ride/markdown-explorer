import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { normalizePathKey, type AppState } from '../../contexts/appStateModel';
import { useHistoryView } from '../../contexts/HistoryContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import { getTranslations } from '../../contexts/translations';
import { requestShellLocation, supportsShellLocation } from '../../desktop/shellLocation';
import { supportsLocalFileBrowserOpen } from '../../dom/localFileBrowserSupport';
import { openLocalFileInBrowser } from '../../dom/htmlPreviewActions';
import { documentSessionKey, isDocumentDirty } from '../../editor/documentSession';
import { isMarkdownEditingAvailable } from '../../editor/editingFeature';
import { selectPaneDocument } from '../../split-view/paneSelectors';
import type { DocumentViewMode, PaneId } from '../../split-view/paneState';
import { TabContextMenu, type TabContextMenuAction } from '../shared/TabContextMenu';
import { requestOpenDocumentHistory } from '../shared/ToolbarActionMenu';
import { buildContentTabContextMenuItems, buildSplitHeaderContextMenuItems } from './contentTabContextMenuItems';
import { SplitDocumentView } from './SplitDocumentView';
import { SplitPaneView } from './SplitPaneView';
import { DocumentEnvironmentContext, type DocumentEnvironment } from './DocumentEnvironmentContext';
import { useStableDocumentState } from './useStableDocumentState';
import { setActiveDocumentRootId } from '../../document/activeDocumentRoot';
import { useSplitDropHandler } from '../../split-view/useSplitDropHandler';
import { isEditingMode, sameDocument, usePaneRenderRevision } from '../../split-view/usePaneRenderRevision';

export interface SplitContentViewProps {
  state: AppState;
  onActivatePane: (paneId: PaneId) => void;
  onRatioChange: (ratio: number) => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void;
  onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
  onScrollChange: (paneId: PaneId, scrollTop: number) => void;
  onTabActivate?: (paneId: PaneId, filePath: string) => void;
  onTabClose?: (paneId: PaneId, filePath: string) => void;
  onMoveTab?: (sourcePaneId: PaneId, targetPaneId: PaneId, filePath: string, targetIndex?: number) => void;
  onOpenDocument?: (paneId: PaneId, filePath: string, targetIndex?: number) => void;
  onSwapPanes?: () => void;
  onTabContextMenuAction?: (action: TabContextMenuAction, paneId: PaneId, filePath: string) => void;
}

export function SplitContentView({
  state,
  onActivatePane,
  onRatioChange,
  onModeChange,
  onSourceChange,
  onSave,
  onScrollChange,
  onTabActivate,
  onTabClose,
  onMoveTab,
  onOpenDocument,
  onSwapPanes,
  onTabContextMenuAction,
}: SplitContentViewProps) {
  const language = state.settings.language || 'en';
  const t = getTranslations(language);
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

  useSplitDropHandler(state.splitView, { onMoveTab, onOpenDocument, onSwapPanes });

  useEffect(() => {
    setActiveDocumentRootId(state.splitView.activePane);
    return () => setActiveDocumentRootId('main');
  }, [state.splitView.activePane]);

  const [contextMenu, setContextMenu] = useState<{
    paneId: PaneId;
    filePath: string;
    x: number;
    y: number;
    header?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu || contextMenu.header) return;
    const pane = state.splitView[contextMenu.paneId];
    if (pane?.tabs.some((path) => normalizePathKey(path) === normalizePathKey(contextMenu.filePath))) return;
    setContextMenu(null);
  }, [contextMenu, state.splitView]);

  const tabLabels = new Map<string, string>();
  for (const tab of state.contentTabs) tabLabels.set(normalizePathKey(tab.filePath), tab.title || tab.fileName);
  for (const file of state.fileList) {
    const key = normalizePathKey(file.fsPath);
    if (!tabLabels.has(key)) tabLabels.set(key, state.settings.showTitle ? file.title || file.fileName : file.fileName);
  }

  const dirtyMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (state.documentSessions) {
      for (const [key, session] of Object.entries(state.documentSessions)) {
        if (session && isDocumentDirty(session)) {
          map.set(key, true);
          map.set(normalizePathKey(session.filePath), true);
        }
      }
    }
    return map;
  }, [state.documentSessions]);

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    if (contextMenu.header) return buildSplitHeaderContextMenuItems(splitT);
    const pane = state.splitView[contextMenu.paneId];
    const tabIndex = pane.tabs.findIndex((path) => normalizePathKey(path) === normalizePathKey(contextMenu.filePath));
    return buildContentTabContextMenuItems(state, t, tabIndex, {
      paneId: contextMenu.paneId,
      paneTabs: pane.tabs,
      targetFilePath: contextMenu.filePath,
    });
  }, [contextMenu, splitT, state, t]);

  const openHeaderContextMenu = ({ paneId, x, y }: { paneId: PaneId; x: number; y: number }) => {
    setContextMenu({ paneId, x, y, header: true, filePath: state.splitView[paneId].activeTabPath ?? state.splitView[paneId].filePath ?? '' });
  };

  const handleContextMenuAction = (action: TabContextMenuAction) => {
    if (!contextMenu) return;
    const { paneId, filePath } = contextMenu;
    setContextMenu(null);
    onTabContextMenuAction?.(action, paneId, filePath);
  };

  return (
    <main className="content content--split" id="mainContent">
      <SplitDocumentView
        ratio={state.splitView.ratio}
        activePane={state.splitView.activePane}
        primaryLabel={splitT.primaryDocument}
        secondaryLabel={splitT.secondaryDocument}
        resizeLabel={splitT.resizeDocumentPanes}
        primary={<SplitPaneView paneId="primary" projection={primary} paneTabs={state.splitView.primary.tabs} activeTabPath={state.splitView.primary.activeTabPath} tabLabels={tabLabels} dirtyMap={dirtyMap} showTabs={state.settings.fileTabs} historyView={primaryHistoryView} language={language} documentRenderRevision={primaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} onTabActivate={onTabActivate} onTabClose={onTabClose} onTabContextMenu={setContextMenu} onHeaderContextMenu={openHeaderContextMenu} />}
        secondary={<SplitPaneView paneId="secondary" projection={secondary} paneTabs={state.splitView.secondary.tabs} activeTabPath={state.splitView.secondary.activeTabPath} tabLabels={tabLabels} dirtyMap={dirtyMap} showTabs={state.settings.fileTabs} historyView={secondaryHistoryView} language={language} documentRenderRevision={secondaryRenderRevision} editingEnabled={editingEnabled} clearHistoryView={clearHistoryView} onModeChange={onModeChange} onSourceChange={onSourceChange} onSave={onSave} onScrollChange={onScrollChange} onTabActivate={onTabActivate} onTabClose={onTabClose} onTabContextMenu={setContextMenu} onHeaderContextMenu={openHeaderContextMenu} />}
        onActivatePane={onActivatePane}
        onRatioChange={onRatioChange}
      />
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          ariaLabel={t.tabContextMenu.menuLabel}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </main>
  );
}

const NOOP_IMAGE_CLICK = () => {};

export function SplitContent({ onImageClick = NOOP_IMAGE_CLICK }: { onImageClick?: (el: HTMLElement) => void } = {}) {
  const {
    state,
    dispatch,
    navigate,
    refresh,
    activatePane,
    setSplitRatio,
    closeSplitView,
    setSplitPaneMode,
    setSplitPaneScrollTop,
    setWorkingDocumentSource,
    saveDocument,
    openInSplit,
    moveSplitTab,
    swapSplitPanes,
    moveToOtherPane,
    guardUnsavedChanges = (_filePaths: string[], commit: () => void) => commit(),
    setContentTabHtmlPreview,
  } = useAppState();
  const bridge = usePlatform();
  const t = getTranslations(state.settings.language);

  const activateTab = useCallback((paneId: PaneId, filePath: string) => {
    dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
    dispatch({ type: 'ACTIVATE_SPLIT_PANE_TAB', paneId, filePath });
    if (state.contentTabs.some((tab) => normalizePathKey(tab.filePath) === normalizePathKey(filePath))) {
      dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath });
    }
    bridge.postMessage({ command: 'navigate', path: filePath });
  }, [bridge, dispatch, state.contentTabs]);

  const closeTab = useCallback((paneId: PaneId, filePath: string) => {
    const pane = state.splitView[paneId];
    const index = pane.tabs.findIndex((path) => normalizePathKey(path) === normalizePathKey(filePath));
    if (index < 0) return;
    const remaining = pane.tabs.filter((_, tabIndex) => tabIndex !== index);
    if (remaining.length === 0) {
      // The reducer collapses to the other pane; sync the host to its document.
      const kept = state.splitView[paneId === 'primary' ? 'secondary' : 'primary'].activeTabPath;
      dispatch({ type: 'CLOSE_SPLIT_PANE_TAB', paneId, filePath });
      if (kept) bridge.postMessage({ command: 'navigate', path: kept });
      return;
    }
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
  }, [bridge, dispatch, state.contentTabs, state.splitView]);

  const requestCloseSplitTabs = useCallback((pathsToClose: string[], onConfirm: () => void) => {
    const dirtyPaths = pathsToClose.filter((filePath) => {
      const session = state.documentSessions?.[documentSessionKey(filePath)];
      return session ? isDocumentDirty(session) : false;
    });
    if (dirtyPaths.length > 0) {
      guardUnsavedChanges(dirtyPaths, onConfirm);
      return;
    }
    onConfirm();
  }, [guardUnsavedChanges, state.documentSessions]);

  const handleTabContextMenuAction = useCallback((action: TabContextMenuAction, paneId: PaneId, filePath: string) => {
    switch (action) {
      case 'openInBrowser':
        if (supportsLocalFileBrowserOpen(state.appRuntime)) {
          if (!openLocalFileInBrowser(bridge, filePath)) {
            window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', {
              detail: t.previewActions.openError,
            }));
          }
        }
        break;

      case 'toggleHtmlDocumentView': {
        const tab = state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(filePath));
        const current = tab?.htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
        setContentTabHtmlPreview(filePath, !current);
        break;
      }

      case 'openLocation':
        if (supportsShellLocation(state.appRuntime)) {
          requestShellLocation(bridge, filePath, 'open-parent-directory');
        }
        break;

      case 'openInSplit': {
        const targetPane: PaneId = paneId === 'secondary' ? 'primary' : 'secondary';
        const replacedPath = state.splitView[targetPane].filePath;
        const doOpen = () => {
          if (targetPane === 'secondary') {
            openInSplit(filePath);
          } else {
            dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId: 'primary', filePath });
            dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' });
          }
        };
        if (replacedPath && normalizePathKey(replacedPath) !== normalizePathKey(filePath)) {
          const session = state.documentSessions?.[documentSessionKey(replacedPath)];
          if (session && isDocumentDirty(session)) {
            guardUnsavedChanges([replacedPath], doOpen);
            break;
          }
        }
        doOpen();
        break;
      }

      case 'history':
        requestOpenDocumentHistory(filePath);
        break;

      case 'swapPanes':
        swapSplitPanes();
        break;

      case 'closeSplit':
        closeSplitView();
        break;

      case 'moveToOtherPane':
        moveToOtherPane(filePath);
        break;

      case 'closeThisTab':
        requestCloseSplitTabs([filePath], () => closeTab(paneId, filePath));
        break;

      case 'closeTabsToRight': {
        const pane = state.splitView[paneId];
        const targetIndex = pane.tabs.findIndex((p) => normalizePathKey(p) === normalizePathKey(filePath));
        if (targetIndex < 0) return;
        const pathsToClose = pane.tabs.slice(targetIndex + 1);
        requestCloseSplitTabs(pathsToClose, () => {
          for (const path of pathsToClose) {
            dispatch({ type: 'CLOSE_SPLIT_PANE_TAB', paneId, filePath: path });
          }
          if (pathsToClose.some((p) => normalizePathKey(p) === normalizePathKey(pane.activeTabPath ?? ''))) {
            activateTab(paneId, filePath);
          }
        });
        break;
      }

      case 'closeOtherTabs': {
        const pane = state.splitView[paneId];
        const pathsToClose = pane.tabs.filter((p) => normalizePathKey(p) !== normalizePathKey(filePath));
        requestCloseSplitTabs(pathsToClose, () => {
          for (const path of pathsToClose) {
            dispatch({ type: 'CLOSE_SPLIT_PANE_TAB', paneId, filePath: path });
          }
          activateTab(paneId, filePath);
        });
        break;
      }

      case 'closeAllTabs': {
        const pane = state.splitView[paneId];
        const kept = state.splitView[paneId === 'primary' ? 'secondary' : 'primary'].activeTabPath;
        requestCloseSplitTabs([...pane.tabs], () => {
          for (const path of pane.tabs) {
            dispatch({ type: 'CLOSE_SPLIT_PANE_TAB', paneId, filePath: path });
          }
          if (kept) bridge.postMessage({ command: 'navigate', path: kept });
        });
        break;
      }
    }
  }, [
    activateTab,
    bridge,
    closeTab,
    dispatch,
    guardUnsavedChanges,
    moveToOtherPane,
    openInSplit,
    requestCloseSplitTabs,
    swapSplitPanes,
    setContentTabHtmlPreview,
    state.appRuntime,
    state.contentTabs,
    state.documentSessions,
    state.settings.defaultHtmlPreview,
    state.splitView,
    t.previewActions?.openError,
  ]);

  const openDocumentInPane = useCallback((paneId: PaneId, filePath: string, targetIndex?: number) => {
    const cleanPath = filePath.split('#')[0];
    const cached = state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === normalizePathKey(cleanPath))?.filePath;
    const target = cached ?? cleanPath;
    dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
    dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId, filePath: target, targetIndex });
    if (cached) dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: cached });
    else dispatch({ type: 'SET_LOADING' });
    bridge.postMessage({ command: 'navigate', path: target });
  }, [bridge, dispatch, state.contentTabs]);

  const documentState = useStableDocumentState(state);
  const documentEnvironment = useMemo<DocumentEnvironment>(
    () => ({ state: documentState, bridge, navigate, onImageClick, refresh }),
    [bridge, documentState, navigate, onImageClick, refresh],
  );

  return (
    <DocumentEnvironmentContext.Provider value={documentEnvironment}>
    <SplitContentView
      state={state}
      onActivatePane={activatePane}
      onRatioChange={setSplitRatio}
      onModeChange={setSplitPaneMode}
      onSourceChange={setWorkingDocumentSource}
      onSave={saveDocument}
      onScrollChange={setSplitPaneScrollTop}
      onTabActivate={activateTab}
      onTabClose={(paneId, filePath) => requestCloseSplitTabs([filePath], () => closeTab(paneId, filePath))}
      onMoveTab={moveSplitTab}
      onOpenDocument={openDocumentInPane}
      onSwapPanes={swapSplitPanes}
      onTabContextMenuAction={handleTabContextMenuAction}
    />
    </DocumentEnvironmentContext.Provider>
  );
}
