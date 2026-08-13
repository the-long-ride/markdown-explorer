// =============================================================================
// main.tsx — React entry point
// Thin bootstrap: window appears instantly, heavy app loads after.
// =============================================================================

import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { PlatformProvider } from './contexts/PlatformContext';
import { createVsCodeBridge } from './platform/vscode';
import { createElectronBridge } from './platform/electron';
import { createChromeBridge } from './platform/chrome';
import { createWebBridge } from './platform/web';

// Lazy-load the full application shell (providers + App + all components).
// This keeps index.js tiny so the window paints instantly.
// Start the dynamic import immediately — don't wait for React's lazy factory.
const appShellPromise = import('./AppShell').then(m => ({ default: m.default }));
const AppShell = lazy(() => appShellPromise);

// Global styles
import './styles/tokens.css';
import './styles/global.css';

const shouldLogPerf =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf');

if (shouldLogPerf) {
  performance.mark('renderer:entry');
  console.info('[perf] mark renderer:entry');
}

// ── Detect platform and create bridge ──────────────────────────────────────

export function detectBridge(win: any = window) {
  // VS Code webview provides acquireVsCodeApi
  if (typeof win.acquireVsCodeApi === 'function') {
    return createVsCodeBridge();
  }
  // Tauri desktop exposes __TAURI__ and also a compatibility electronAPI shim.
  if (typeof win.__TAURI__ !== 'undefined' || typeof win.__TAURI_INTERNALS__ !== 'undefined') {
    document.body.classList.add('is-desktop', 'is-tauri');
    return createElectronBridge();
  }
  // Electron provides window.electronAPI via preload.js
  if (typeof win.electronAPI !== 'undefined') {
    document.body.classList.add('is-desktop', 'is-electron');
    return createElectronBridge();
  }
// Chromium Extension provides window.__chromeExtBus
  if (typeof win.__chromeExtBus !== 'undefined') {
    document.body.classList.add('is-chrome-ext');
    return createChromeBridge();
  }
  // Web demo provides window.__webDemoBus
  if (typeof win.__webDemoBus !== 'undefined') {
    document.body.classList.add('is-web-demo');
    return createWebBridge();
  }
  throw new Error('Unknown platform. Expected VS Code webview, Electron, Chromium Extension, or Web Demo.');
}

const bridge = detectBridge();
(window as any).PlatformBridge = bridge;

// ── Mount React app ────────────────────────────────────────────────────────

// Dismiss the HTML splash screen once React mounts
function dismissSplash() {
  const splash = document.querySelector('.splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 350);
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <PlatformProvider bridge={bridge}>
      <Suspense fallback={null}>
        <AppShell />
      </Suspense>
    </PlatformProvider>
  </StrictMode>,
);

dismissSplash();

