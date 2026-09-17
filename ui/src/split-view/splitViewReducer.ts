import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import { isDocumentViewModeAllowed } from '../editor/editingFeature';
import {
  activatePaneTab,
  closePaneTab,
  closeSplit,
  openPaneDocument,
  openSplit,
  setActivePane,
  setPaneMode,
  setPaneScrollTop,
  setPaneTabs,
  setSplitRatio,
  swapPanes,
  type DocumentViewMode,
  type PaneId,
} from './paneState';

export type SplitViewAction =
  | { type: 'OPEN_SPLIT_VIEW'; filePath: string }
  | { type: 'CLOSE_SPLIT_VIEW' }
  | { type: 'ACTIVATE_SPLIT_PANE'; paneId: PaneId }
  | { type: 'ACTIVATE_SPLIT_PANE_TAB'; paneId: PaneId; filePath: string }
  | { type: 'CLOSE_SPLIT_PANE_TAB'; paneId: PaneId; filePath: string }
  | { type: 'SET_SPLIT_RATIO'; ratio: number }
  | { type: 'SET_SPLIT_PANE_MODE'; paneId: PaneId; mode: DocumentViewMode }
  | { type: 'SWAP_SPLIT_PANES' }
  | { type: 'SET_SPLIT_PANE_FILE'; paneId: PaneId; filePath: string | null }
  | { type: 'SET_SPLIT_PANE_SCROLL'; paneId: PaneId; scrollTop: number };

function splitTabPaths(state: AppState): readonly string[] {
  if (!state.settings.fileTabs) return state.currentFile ? [state.currentFile] : [];
  const paths = state.contentTabs.map((tab) => tab.filePath);
  const currentFile = state.currentFile;
  if (currentFile && !paths.some((path) => normalizePathKey(path) === normalizePathKey(currentFile))) {
    return [...paths, currentFile];
  }
  return paths;
}

export function reduceSplitViewAction(state: AppState, action: { type: string } & Record<string, unknown>): AppState | null {
  switch (action.type) {
    case 'OPEN_SPLIT_VIEW': {
      let splitView = state.splitView;
      if (!splitView.enabled) {
        splitView = setPaneTabs(splitView, 'primary', splitTabPaths(state), state.currentFile);
      }
      return { ...state, splitView: openSplit(splitView, action.filePath as string) };
    }
    case 'CLOSE_SPLIT_VIEW': {
      const focused = state.splitView[state.splitView.activePane];
      const splitView = closeSplit(state.splitView);
      if (!state.settings.fileTabs) {
        return { ...state, splitView, contentTabs: [], activeContentTabPath: null };
      }
      const focusedKeys = new Set(focused.tabs.map(normalizePathKey));
      const contentTabs = state.contentTabs.filter((tab) => focusedKeys.has(normalizePathKey(tab.filePath)));
      return {
        ...state,
        splitView,
        contentTabs,
        activeContentTabPath: focused.activeTabPath,
      };
    }
    case 'ACTIVATE_SPLIT_PANE':
      return { ...state, splitView: setActivePane(state.splitView, action.paneId as PaneId) };
    case 'ACTIVATE_SPLIT_PANE_TAB':
      return {
        ...state,
        splitView: activatePaneTab(state.splitView, action.paneId as PaneId, action.filePath as string),
      };
    case 'CLOSE_SPLIT_PANE_TAB':
      return {
        ...state,
        splitView: closePaneTab(state.splitView, action.paneId as PaneId, action.filePath as string),
      };
    case 'SET_SPLIT_RATIO':
      return { ...state, splitView: setSplitRatio(state.splitView, action.ratio as number) };
    case 'SET_SPLIT_PANE_MODE': {
      const mode = action.mode as DocumentViewMode;
      if (!isDocumentViewModeAllowed(state.settings, mode)) return state;
      return {
        ...state,
        splitView: setPaneMode(state.splitView, action.paneId as PaneId, mode),
      };
    }
    case 'SWAP_SPLIT_PANES':
      return { ...state, splitView: swapPanes(state.splitView) };
    case 'SET_SPLIT_PANE_FILE':
      return {
        ...state,
        splitView: openPaneDocument(
          state.splitView,
          action.paneId as PaneId,
          action.filePath as string | null,
          state.settings.fileTabs,
        ),
      };
    case 'SET_SPLIT_PANE_SCROLL':
      return {
        ...state,
        splitView: setPaneScrollTop(state.splitView, action.paneId as PaneId, action.scrollTop as number),
      };
    default:
      return null;
  }
}
