import { useEffect, useRef } from 'react';
import type { PaneId, SplitViewState } from './paneState';
import { resolveTabDropIndex, setSplitDropHandler, type SplitDragPayload, type SplitDropTarget } from './splitPointerDrag';

export interface SplitDropActions {
  onMoveTab?: (sourcePaneId: PaneId, targetPaneId: PaneId, filePath: string, targetIndex?: number) => void;
  onOpenDocument?: (paneId: PaneId, filePath: string, targetIndex?: number) => void;
  onSwapPanes?: () => void;
}

export function applySplitDrop(
  splitView: SplitViewState,
  payload: SplitDragPayload,
  target: SplitDropTarget,
  actions: SplitDropActions,
): void {
  if (payload.kind === 'split-header') {
    if (target.paneId !== payload.paneId) actions.onSwapPanes?.();
    return;
  }
  const paths = splitView[target.paneId].tabs;
  const filePath = payload.filePath;
  if (payload.kind === 'split-tab') {
    // Dropping a tab back onto its own pane body is not a move.
    if (target.zone === 'pane' && target.paneId === payload.sourcePaneId) return;
    const index = target.zone === 'tab'
      ? resolveTabDropIndex(paths, target.index, target.side, filePath)
      : paths.filter((path) => path !== filePath).length;
    actions.onMoveTab?.(payload.sourcePaneId, target.paneId, filePath, index);
    return;
  }
  const index = target.zone === 'tab' ? resolveTabDropIndex(paths, target.index, target.side, filePath) : undefined;
  actions.onOpenDocument?.(target.paneId, filePath, index);
}

// Routes pointer-driven split drops to the reducer actions of the mounted split view.
export function useSplitDropHandler(splitView: SplitViewState, actions: SplitDropActions): void {
  const latest = useRef({ splitView, actions });
  latest.current = { splitView, actions };
  useEffect(() => setSplitDropHandler((payload, target) => {
    applySplitDrop(latest.current.splitView, payload, target, latest.current.actions);
  }), []);
}
