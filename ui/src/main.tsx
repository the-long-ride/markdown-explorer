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
import { App } from './App';

// Local library imports for CSP compliance & offline support
import 'highlight.js/styles/github-dark.css';
import './components/Content/InteractiveComponents';

async function initLibs() {
  const [{ default: hljs }, { default: mermaid }, chartModule, { default: zenuml }] = await Promise.all([
    import('highlight.js'),
    import('mermaid'),
    import('chart.js/auto'),
    import('@mermaid-js/mermaid-zenuml'),
  ]);

  const { default: Chart } = chartModule;
  // Chart.js auto-registers all components, but let's keep the .register call to be compatible
  Chart.register();

  try {
    await mermaid.registerExternalDiagrams([zenuml]);
  } catch (err) {
    console.error('Failed to register ZenUML:', err);
  }

  (window as any).hljs = hljs;
  (window as any).mermaid = mermaid;
  (window as any).Chart = Chart;
}

export const libsReady = initLibs();

// Global styles
import './styles/tokens.css';
import './styles/global.css';

if (typeof (window as any).electronAPI !== 'undefined') {
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
  throw new Error('Unknown platform. Expected VS Code webview or Electron.');
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
