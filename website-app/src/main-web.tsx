// =============================================================================
// website-app/src/main-web.tsx — Web app entry point
// 1. Detects mode ('test' or 'web') from ?mode= query param
// 2. Sets up window.__webBus (EventTarget) for the platform bridge
// 3. Initialises the web host (which listens for messages on the bus)
// 4. Imports ui/src/main.tsx which detectBridge() picks up and boots React
//
// Import ORDER matters:
//   web-host.ts must run first → sets window.__webBus → registers bus listener
//   ui/src/main.tsx runs second → detectBridge() finds __webBus → creates bridge
//   React mounts → sends 'ready' message → web-host responds with readyAck
// =============================================================================

import { initWebHost } from './web-host';

export function detectMode(
  search: string = (typeof window !== 'undefined' ? window.location?.search || '' : ''),
): 'web' | 'test' {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'test' ? 'test' : 'web';
}

// Set mode BEFORE the UI boots so the host listener handles 'ready' correctly.
if (typeof document !== 'undefined' && document.getElementById('root')) {
  initWebHost(detectMode());

  // Boot the full React UI — detectBridge() in ui/src/main.tsx will find
  // window.__webBus and use createWebBridge().
  import('../../ui/src/main.tsx');
}
