// =============================================================================
// AppShell.tsx — Heavy application shell (lazy-loaded by main.tsx)
// =============================================================================
//
// This module contains AppStateProvider, NavigationProvider, App, and all
// UI components. It is dynamically imported by the thin main.tsx bootstrap
// so the window paints before this chunk is parsed.
//
// =============================================================================

import { useEffect } from 'react';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { normalizePathKey } from './contexts/appStateModel';
import { HistoryProvider } from './contexts/HistoryContext';
import { RepositorySnapshotFromHistoryProvider } from './contexts/RepositorySnapshotContext';
import { WorkspaceNavigationProvider } from './contexts/NavigationContext';
import { usePlatform } from './contexts/PlatformContext';
import {
  hasDraggedDocument,
  OPEN_IN_SPLIT_EVENT,
  readDraggedDocumentPath,
  writeDraggedDocumentPath,
} from './components/Content/documentFileDrop';
import { RepositorySnapshotPortal } from './components/History/RepositorySnapshotPortal';
import { NativeCloseGuardBridge } from './editor/NativeCloseGuardBridge';
import type { PaneId } from './split-view/paneState';
import { App } from './App';

// Defer interactive component registration until after initial mount
// Use requestIdleCallback to avoid competing with React's initial render.
const scheduleInteractive = () => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => import('./components/Content/InteractiveComponents'));
  } else {
    setTimeout(() => import('./components/Content/InteractiveComponents'), 200);
  }
};
scheduleInteractive();

const shouldLogPerf =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf');

function FocusModeDragRegion() {
  const { state } = useAppState();
  if (!state.focusMode || (state.appRuntime !== 'desktop' && state.appRuntime !== 'tauri')) {
    return null;
  }

  return (
    <div className="focus-mode-drag-region" aria-hidden="true">
      <div
        className="focus-mode-drag-region__surface"
        data-tauri-drag-region={state.appRuntime === 'tauri' ? '' : undefined}
      />
      <div className="focus-mode-drag-region__controls" />
    </div>
  );
}

function fileRow(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('.tree-file[data-path]') : null;
}

function dropPane(target: EventTarget | null): PaneId | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('.split-document-pane--primary')) return 'primary';
  if (target.closest('.split-document-pane--secondary')) return 'secondary';
  return null;
}

function DocumentFileDragBridge() {
  const { state, dispatch, navigate } = useAppState();
  const bridge = usePlatform();

  useEffect(() => {
    let highlighted: HTMLElement | null = null;
    const clearHighlight = () => {
      highlighted?.classList.remove('is-file-drag-target');
      highlighted = null;
    };
    const cachedPath = (path: string) => {
      const key = normalizePathKey(path);
      return state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === key)?.filePath ?? null;
    };
    const openInPane = (paneId: PaneId, path: string) => {
      const cleanPath = path.split('#')[0];
      const cached = cachedPath(cleanPath);
      const targetPath = cached ?? cleanPath;
      dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
      dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId, filePath: targetPath });
      if (cached) dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: cached });
      else dispatch({ type: 'SET_LOADING' });
      bridge.postMessage({ command: 'navigate', path: targetPath });
    };
    const markDraggable = (target: EventTarget | null) => {
      const row = fileRow(target);
      const path = row?.dataset.path ?? '';
      if (row && path && !path.startsWith('revision://')) row.draggable = true;
    };
    const onPointerOver = (event: PointerEvent) => markDraggable(event.target);
    const onDragStart = (event: DragEvent) => {
      const row = fileRow(event.target);
      const path = row?.dataset.path ?? '';
      if (!event.dataTransfer || !path || path.startsWith('revision://')) return;
      writeDraggedDocumentPath(event.dataTransfer, path);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer || !hasDraggedDocument(event.dataTransfer)) return;
      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('.split-document-pane') : null;
      const main = event.target instanceof Element ? event.target.closest<HTMLElement>('#mainContent') : null;
      const target = pane ?? main;
      if (!target) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (highlighted !== target) {
        clearHighlight();
        highlighted = target;
        target.classList.add('is-file-drag-target');
      }
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const path = readDraggedDocumentPath(event.dataTransfer);
      if (!path) return;
      const paneId = dropPane(event.target);
      const main = event.target instanceof Element ? event.target.closest('#mainContent') : null;
      if (!paneId && !main) return;
      event.preventDefault();
      clearHighlight();
      if (state.splitView.enabled && paneId) openInPane(paneId, path);
      else navigate(path);
    };
    const onOpenInSplit = (event: Event) => {
      const path = String((event as CustomEvent<string>).detail ?? '').trim();
      if (!path) return;
      dispatch({ type: 'OPEN_SPLIT_VIEW', filePath: path });
      openInPane('secondary', path);
    };

    document.addEventListener('pointerover', onPointerOver, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragend', clearHighlight, true);
    window.addEventListener(OPEN_IN_SPLIT_EVENT, onOpenInSplit);
    return () => {
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('dragend', clearHighlight, true);
      window.removeEventListener(OPEN_IN_SPLIT_EVENT, onOpenInSplit);
      clearHighlight();
    };
  }, [bridge, dispatch, navigate, state.contentTabs, state.splitView.enabled]);

  return null;
}

export default function AppShell() {
  // ── Perf timing: collect renderer-side marks for main process ──────────
  useEffect(() => {
    if (shouldLogPerf) {
      performance.mark('renderer:react-mounted');
      console.info('[perf] mark renderer:react-mounted');

      // Expose a collector so the main process can query timing
      (window as any).__mdnPerfEntries = () => {
        const entries = performance.getEntriesByType('mark');
        const result: Record<string, number> = {};
        for (const e of entries) {
          if (e.name.startsWith('renderer:') || e.name.startsWith('main:')) {
            result[e.name] = Math.round(e.startTime);
          }
        }
        return result;
      };
    }
  }, []);

  return (
    <AppStateProvider>
      <FocusModeDragRegion />
      <DocumentFileDragBridge />
      <NativeCloseGuardBridge />
      <HistoryProvider>
        <RepositorySnapshotFromHistoryProvider>
          <WorkspaceNavigationProvider>
            <App />
          </WorkspaceNavigationProvider>
          <RepositorySnapshotPortal />
        </RepositorySnapshotFromHistoryProvider>
      </HistoryProvider>
    </AppStateProvider>
  );
}
