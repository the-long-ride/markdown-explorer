// =============================================================================
// website-app/src/features-main.tsx — Entry point for /app/features/
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initGlobalHandlers } from '@ui/dom/globalHandlers';
import '@ui/styles/tokens.css';
import '@ui/styles/global.css';
import './features/features-demo.css';
import './features/features-stages.css';
import { FeaturesStudioApp } from './features/FeaturesStudioApp';

initGlobalHandlers();

const scheduleInteractive = () => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => import('@ui/components/Content/InteractiveComponents'));
  } else {
    setTimeout(() => import('@ui/components/Content/InteractiveComponents'), 200);
  }
};
scheduleInteractive();

function dismissSplash() {
  const splash = document.querySelector('.splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 350);
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <FeaturesStudioApp />
    </StrictMode>,
  );
  dismissSplash();
}
