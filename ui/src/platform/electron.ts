// =============================================================================
// platform/electron.ts — Electron bridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import type { HostMessage, WebviewMessage } from '../types';

interface ElectronApi {
  postMessage(msg: WebviewMessage): void;
  onMessage(callback: (msg: HostMessage) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

export function createElectronBridge(): PlatformBridge {
  const api = window.electronAPI;
  if (!api) {
    throw new Error('electronAPI is not available on window. Are you sure you are running in Electron?');
  }

  const STATE_KEY = 'markdown-explorer-ui-state';

  return {
    postMessage(msg: WebviewMessage) {
      api.postMessage(msg);
    },

    onMessage(handler: (msg: HostMessage) => void): () => void {
      return api.onMessage(handler);
    },

    getState<T>(): T | undefined {
      try {
        const val = localStorage.getItem(STATE_KEY);
        return val ? (JSON.parse(val) as T) : undefined;
      } catch (err) {
        console.error('Failed to get Electron state from localStorage:', err);
        return undefined;
      }
    },

    setState<T>(state: T): void {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (err) {
        console.error('Failed to set Electron state in localStorage:', err);
      }
    },

    copyToClipboard(text: string) {
      api.postMessage({ command: 'copyCode', text });
    },
  };
}
