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

async function loadHighlightJs() {
  const [
    { default: hljs },
    { default: javascript },
    { default: typescript },
    { default: json },
    { default: css },
    { default: xml },
    { default: markdown },
    { default: bash },
    { default: powershell },
    { default: yaml },
    { default: python },
  ] = await Promise.all([
    import('highlight.js/lib/core'),
    import('highlight.js/lib/languages/javascript'),
    import('highlight.js/lib/languages/typescript'),
    import('highlight.js/lib/languages/json'),
    import('highlight.js/lib/languages/css'),
    import('highlight.js/lib/languages/xml'),
    import('highlight.js/lib/languages/markdown'),
    import('highlight.js/lib/languages/bash'),
    import('highlight.js/lib/languages/powershell'),
    import('highlight.js/lib/languages/yaml'),
    import('highlight.js/lib/languages/python'),
  ]);

  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('powershell', powershell);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('python', python);

  hljs.registerAliases(['js', 'jsx', 'mjs', 'cjs'], { languageName: 'javascript' });
  hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
  hljs.registerAliases(['html', 'xhtml', 'svg'], { languageName: 'xml' });
  hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });
  hljs.registerAliases(['ps1', 'pwsh'], { languageName: 'powershell' });
  hljs.registerAliases(['yml'], { languageName: 'yaml' });

  return hljs;
}

async function loadChartJs() {
  const {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    DoughnutController,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
  } = await import('chart.js');

  Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
  );

  return Chart;
}

async function initLibs() {
  const [hljs, { default: mermaid }, Chart, { default: zenuml }] = await Promise.all([
    loadHighlightJs(),
    import('mermaid'),
    loadChartJs(),
    import('@mermaid-js/mermaid-zenuml'),
  ]);

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
