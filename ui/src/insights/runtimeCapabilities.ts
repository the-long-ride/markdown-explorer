import type { AppRuntime } from '../types/settings';

declare global {
  interface Window {
    __webDemoBus?: EventTarget;
  }
}

export function isWebsiteDemoRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__webDemoBus);
}

export function supportsWorkspaceInsights(runtime: AppRuntime): boolean {
  if (runtime === 'vscode') return false;
  return runtime !== 'chrome' || !isWebsiteDemoRuntime();
}
