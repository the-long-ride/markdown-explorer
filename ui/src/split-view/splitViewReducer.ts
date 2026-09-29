import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';
import { applyContentTab, createContentTabFromState } from '../contexts/contentTabState';
import { isDocumentViewModeAllowed } from '../editor/editingFeature';
import type { ContentTab } from '../types';
import {
  activatePaneTab,
  closePaneTab,
  closeSplit,
  movePaneTab,
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
  type SplitViewState,
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
  | { type: 'MOVE_SPLIT_TAB'; sourcePaneId: PaneId; targetPaneId: PaneId; filePath: string; targetIndex?: number }
  | { type: 'SET_SPLIT_PANE_FILE'; paneId: PaneId; filePath: string | null; targetIndex?: number }
  | { type: 'SET_SPLIT_PANE_SCROLL'; paneId: PaneId; scrollTop: number };

// With file tabs disabled the app keeps no content cache, so split panes would
// lose the document they are not currently showing. Retain only the rendered
// tabs that a visible split pane still references.
export function retainSplitPaneContentTabs(state: AppState, tab: ContentTab | null): ContentTab[] {
  if (!state.splitView.enabled) return [];
  const referenced = new Set([
    ...state.splitView.primary.tabs,
    ...state.splitView.secondary.tabs,
  ].map(normalizePathKey));
  const kept = state.contentTabs.filter((existing) => referenced.has(normalizePathKey(existing.filePath))
    && (!tab || normalizePathKey(existing.filePath) !== normalizePathKey(tab.filePath)));
  return tab ? [...kept, tab] : kept;
}

// Closing the last tab of one pane leaves the other pane as the normal document
// view, keeping its tabs, active document, and cached rendered content.
function collapseToPane(state: AppState, splitView: SplitViewState, keepPaneId: PaneId): AppState {
  const kept = splitView[keepPaneId];
  const collapsed = closeSplit({ ...splitView, activePane: keepPaneId });
  const keptKeys = new Set(kept.tabs.map(normalizePathKey));
  const cachedTabs = state.contentTabs.filter((tab) => keptKeys.has(normalizePathKey(tab.filePath)));
  const contentTabs = state.settings.fileTabs ? cachedTabs : [];
  const activeKey = normalizePathKey(kept.activeTabPath ?? '');
  const activeTab = cachedTabs.find((tab) => normalizePathKey(tab.filePath) === activeKey);
  const next = { ...state, splitView: collapsed };
  if (activeTab) {
    const applied = applyContentTab(next, activeTab, contentTabs);
    return state.settings.fileTabs ? applied : { ...applied, activeContentTabPath: null };
  }
  return { ...next, contentTabs, activeContentTabPath: state.settings.fileTabs ? kept.activeTabPath : null };
}

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
      const opened = { ...state, splitView: openSplit(splitView, action.filePath as string) };
      if (state.settings.fileTabs || state.splitView.enabled) return opened;
      return { ...opened, contentTabs: retainSplitPaneContentTabs(opened, createContentTabFromState(state)) };
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
    case 'CLOSE_SPLIT_PANE_TAB': {
      const paneId = action.paneId as PaneId;
      const splitView = closePaneTab(state.splitView, paneId, action.filePath as string);
      if (splitView.enabled && splitView[paneId].tabs.length === 0) {
        return collapseToPane(state, splitView, paneId === 'primary' ? 'secondary' : 'primary');
      }
      return { ...state, splitView };
    }
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
    case 'MOVE_SPLIT_TAB': {
      const nextSplit = movePaneTab(
        state.splitView,
        action.sourcePaneId as PaneId,
        action.targetPaneId as PaneId,
        action.filePath as string,
        action.targetIndex as number | undefined,
      );
      if (!nextSplit.enabled) {
        const activeKeys = new Set(nextSplit.primary.tabs.map(normalizePathKey));
        const contentTabs = state.contentTabs.filter((tab) => activeKeys.has(normalizePathKey(tab.filePath)));
        return {
          ...state,
          splitView: nextSplit,
          contentTabs,
          activeContentTabPath: nextSplit.primary.activeTabPath,
        };
      }
      return { ...state, splitView: nextSplit };
    }
    case 'SET_SPLIT_PANE_FILE':
      return {
        ...state,
        splitView: openPaneDocument(
          state.splitView,
          action.paneId as PaneId,
          action.filePath as string | null,
          state.settings.fileTabs,
          action.targetIndex as number | undefined,
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
