import type { AppRuntime } from '../types';

/** System-browser access to an original local HTML file is unavailable in web/PWA builds. */
export function supportsLocalFileBrowserOpen(runtime: AppRuntime): boolean {
  return runtime === 'desktop' || runtime === 'tauri' || runtime === 'vscode';
}
