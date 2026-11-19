import type { AppRuntime } from '../types/settings';

declare global {
  interface Window {
    __webBus?: EventTarget;
  }
}

export function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__webBus);
}

export function supportsWorkspaceInsights(runtime: AppRuntime): boolean {
  return runtime !== 'vscode';
}
