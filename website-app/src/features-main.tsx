// =============================================================================
// website-app/src/features-main.tsx — Entry point for /app/features/
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initGlobalHandlers } from '../../ui/src/dom/globalHandlers';
import '../../ui/src/styles/tokens.css';
import '../../ui/src/styles/global.css';
import './features/features-demo.css';
import './features/features-stages.css';
import { FeaturesStudioApp } from './features/FeaturesStudioApp';

initGlobalHandlers();

const scheduleInteractive = () => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => import('../../ui/src/components/Content/InteractiveComponents'));
  } else {
    setTimeout(() => import('../../ui/src/components/Content/InteractiveComponents'), 200);
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
