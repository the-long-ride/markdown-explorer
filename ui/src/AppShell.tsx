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
import { OPEN_IN_SPLIT_EVENT } from './components/Content/documentFileDrop';
import { RepositorySnapshotPortal } from './components/History/RepositorySnapshotPortal';
import { DOCUMENT_HISTORY_OPEN_EVENT } from './components/shared/ToolbarActionMenu';
import { NativeCloseGuardBridge } from './editor/NativeCloseGuardBridge';
import type { PaneId } from './split-view/paneState';
import { beginSplitPointerDrag } from './split-view/splitPointerDrag';
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

function RepositoryHistorySidebarBridge() {
  const { openRepositoryHistorySidebar } = useAppState();

  useEffect(() => {
    const onOpenHistory = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string }>).detail;
      if (!detail?.filePath) {
        openRepositoryHistorySidebar();
      }
    };
    window.addEventListener(DOCUMENT_HISTORY_OPEN_EVENT, onOpenHistory);
    return () => window.removeEventListener(DOCUMENT_HISTORY_OPEN_EVENT, onOpenHistory);
  }, [openRepositoryHistorySidebar]);

  return null;
}

function fileRow(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('.tree-file[data-path]') : null;
}

// Sidebar file rows start a pointer-driven split drag; the drop itself is
// routed by the mounted split view (see useSplitDropHandler).
export function DocumentFileDragBridge() {
  const { state, dispatch } = useAppState();
  const bridge = usePlatform();
  const splitEnabled = Boolean(state.splitView?.enabled);

  useEffect(() => {
    const openInPane = (paneId: PaneId, path: string) => {
      const cleanPath = path.split('#')[0];
      const key = normalizePathKey(cleanPath);
      const cached = state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === key)?.filePath ?? null;
      const targetPath = cached ?? cleanPath;
      dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
      dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId, filePath: targetPath });
      if (cached) dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: cached });
      else dispatch({ type: 'SET_LOADING' });
      bridge.postMessage({ command: 'navigate', path: targetPath });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!splitEnabled || event.button !== 0) return;
      const row = fileRow(event.target);
      const path = row?.dataset.path ?? '';
      if (!row || !path || path.startsWith('revision://')) return;
      if ((event.target as Element).closest('button, input')) return;
      const label = row.dataset.filename || row.dataset.title || path;
      beginSplitPointerDrag(event, { kind: 'document', filePath: path }, { label, source: row });
    };
    const onOpenInSplit = (event: Event) => {
      const path = String((event as CustomEvent<string>).detail ?? '').trim();
      if (!path) return;
      dispatch({ type: 'OPEN_SPLIT_VIEW', filePath: path });
      openInPane('secondary', path);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener(OPEN_IN_SPLIT_EVENT, onOpenInSplit);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener(OPEN_IN_SPLIT_EVENT, onOpenInSplit);
    };
  }, [bridge, dispatch, splitEnabled, state.contentTabs]);

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
      <RepositoryHistorySidebarBridge />
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
