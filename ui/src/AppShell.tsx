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
import { HistoryProvider } from './contexts/HistoryContext';
import { RepositorySnapshotFromHistoryProvider } from './contexts/RepositorySnapshotContext';
import { WorkspaceNavigationProvider } from './contexts/NavigationContext';
import { RepositorySnapshotPortal } from './components/History/RepositorySnapshotPortal';
import { NativeCloseGuardBridge } from './editor/NativeCloseGuardBridge';
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
    <div
      className="focus-mode-drag-region"
      aria-hidden="true"
      data-tauri-drag-region={state.appRuntime === 'tauri' ? '' : undefined}
    />
  );
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
