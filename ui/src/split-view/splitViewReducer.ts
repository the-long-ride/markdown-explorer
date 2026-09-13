import type { AppState } from '../contexts/appStateModel';
import {
  closeSplit,
  openSplit,
  setActivePane,
  setPaneFile,
  setPaneMode,
  setPaneScrollTop,
  setSplitRatio,
  swapPanes,
  type DocumentViewMode,
  type PaneId,
} from './paneState';

export type SplitViewAction =
  | { type: 'OPEN_SPLIT_VIEW'; filePath: string }
  | { type: 'CLOSE_SPLIT_VIEW' }
  | { type: 'ACTIVATE_SPLIT_PANE'; paneId: PaneId }
  | { type: 'SET_SPLIT_RATIO'; ratio: number }
  | { type: 'SET_SPLIT_PANE_MODE'; paneId: PaneId; mode: DocumentViewMode }
  | { type: 'SWAP_SPLIT_PANES' }
  | { type: 'SET_SPLIT_PANE_FILE'; paneId: PaneId; filePath: string | null }
  | { type: 'SET_SPLIT_PANE_SCROLL'; paneId: PaneId; scrollTop: number };

export function reduceSplitViewAction(state: AppState, action: { type: string } & Record<string, unknown>): AppState | null {
  switch (action.type) {
    case 'OPEN_SPLIT_VIEW': {
      let splitView = state.splitView;
      if (!splitView.enabled && splitView.primary.filePath !== state.currentFile) {
        splitView = setPaneFile(splitView, 'primary', state.currentFile);
      }
      return { ...state, splitView: openSplit(splitView, action.filePath as string) };
    }
    case 'CLOSE_SPLIT_VIEW':
      return { ...state, splitView: closeSplit(state.splitView) };
    case 'ACTIVATE_SPLIT_PANE':
      return { ...state, splitView: setActivePane(state.splitView, action.paneId as PaneId) };
    case 'SET_SPLIT_RATIO':
      return { ...state, splitView: setSplitRatio(state.splitView, action.ratio as number) };
    case 'SET_SPLIT_PANE_MODE':
      return {
        ...state,
        splitView: setPaneMode(state.splitView, action.paneId as PaneId, action.mode as DocumentViewMode),
      };
    case 'SWAP_SPLIT_PANES':
      return { ...state, splitView: swapPanes(state.splitView) };
    case 'SET_SPLIT_PANE_FILE':
      return {
        ...state,
        splitView: setPaneFile(state.splitView, action.paneId as PaneId, action.filePath as string | null),
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
