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
import { AppStateProvider } from './contexts/AppStateContext';
import { HistoryProvider } from './contexts/HistoryContext';
import { WorkspaceNavigationProvider } from './contexts/NavigationContext';
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
      <NativeCloseGuardBridge />
      <HistoryProvider>
        <WorkspaceNavigationProvider>
          <App />
        </WorkspaceNavigationProvider>
      </HistoryProvider>
    </AppStateProvider>
  );
}
