// =============================================================================
// website-app/src/main-web.tsx — Demo app entry point
// 1. Detects mode ('test' or 'file') from ?mode= query param
// 2. Sets up window.__webDemoBus (EventTarget) for the platform bridge
// 3. Initialises the web host (which listens for messages on the bus)
// 4. Imports ui/src/main.tsx which detectBridge() picks up and boots React
//
// Import ORDER matters:
//   web-host.ts must run first → sets window.__webDemoBus → registers bus listener
//   ui/src/main.tsx runs second → detectBridge() finds __webDemoBus → creates bridge
//   React mounts → sends 'ready' message → web-host responds with readyAck
// =============================================================================

import { detectMode, initWebHost } from './web-host';

// Set mode BEFORE the UI boots so the host listener handles 'ready' correctly.
initWebHost(detectMode());

// Boot the full React UI — detectBridge() in ui/src/main.tsx will find
// window.__webDemoBus and use createWebBridge().
import '../../ui/src/main.tsx';
