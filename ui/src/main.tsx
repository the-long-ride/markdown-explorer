// =============================================================================
// main.tsx — React entry point
// =============================================================================

// =============================================================================
// main.tsx — React entry point
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PlatformProvider } from './contexts/PlatformContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { createVsCodeBridge } from './platform/vscode';
import { createElectronBridge } from './platform/electron';
import { createChromeBridge } from './platform/chrome';
import { App } from './App';

import 'highlight.js/styles/github-dark.css';
import './components/Content/InteractiveComponents';

// Global styles
import './styles/tokens.css';
import './styles/global.css';

const shouldLogPerf =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf');

if (shouldLogPerf) {
  performance.mark('renderer:entry');
  console.info('[perf] mark renderer:entry');
}

if (typeof (window as any).electronAPI !== 'undefined' || typeof (window as any).__chromeExtBus !== 'undefined') {
  import('./styles/fonts.css');
}

// ── Detect platform and create bridge ──────────────────────────────────────

function detectBridge() {
  // VS Code webview provides acquireVsCodeApi
  if (typeof (window as any).acquireVsCodeApi === 'function') {
    return createVsCodeBridge();
  }
  // Electron provides window.electronAPI via preload.js
  if (typeof (window as any).electronAPI !== 'undefined') {
    document.body.classList.add('is-electron');
    return createElectronBridge();
  }
  // Chromium Extension provides window.__chromeExtBus
  if (typeof (window as any).__chromeExtBus !== 'undefined') {
    document.body.classList.add('is-chrome-ext');
    return createChromeBridge();
  }
  throw new Error('Unknown platform. Expected VS Code webview, Electron, or Chromium Extension.');
}

const bridge = detectBridge();
(window as any).PlatformBridge = bridge;

// ── Mount React app ────────────────────────────────────────────────────────

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <PlatformProvider bridge={bridge}>
      <AppStateProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </AppStateProvider>
    </PlatformProvider>
  </StrictMode>,
);
