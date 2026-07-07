// =============================================================================
// platform/web.ts — Web demo PlatformBridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import type { HostMessage, WebviewMessage } from '../types';

declare global {
  interface Window {
    __webDemoBus?: EventTarget;
  }
}

export function createWebBridge(): PlatformBridge {
  const bus = window.__webDemoBus;
  if (!bus) {
    throw new Error('__webDemoBus is not available. Web demo host not initialized.');
  }

  const STATE_KEY = 'markdown-explorer-web-state';

  return {
    postMessage(msg: WebviewMessage) {
      bus.dispatchEvent(new CustomEvent('webview-message', { detail: msg }));
    },

    onMessage(handler: (msg: HostMessage) => void): () => void {
      const listener = (e: Event) => {
        const customEvent = e as CustomEvent<HostMessage>;
        handler(customEvent.detail);
      };
      bus.addEventListener('host-message', listener);
      return () => {
        bus.removeEventListener('host-message', listener);
      };
    },

    getState<T>(): T | undefined {
      try {
        const val = localStorage.getItem(STATE_KEY);
        return val ? (JSON.parse(val) as T) : undefined;
      } catch {
        return undefined;
      }
    },

    setState<T>(state: T): void {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch {}
    },

    copyToClipboard(text: string) {
      navigator.clipboard.writeText(text).catch(() => {});
    },
  };
}