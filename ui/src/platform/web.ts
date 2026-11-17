// =============================================================================
// platform/web.ts — Web PlatformBridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import { WEB_APP_STATE_STORAGE_KEY } from '../constants/storage';
import type { HostMessage, WebviewMessage } from '../types';

declare global {
  interface Window {
    __webBus?: EventTarget;
  }
}

export function createWebBridge(): PlatformBridge {
  const bus = window.__webBus;
  if (!bus) {
    throw new Error('__webBus is not available. Web host not initialized.');
  }

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
        const val = localStorage.getItem(WEB_APP_STATE_STORAGE_KEY);
        return val ? (JSON.parse(val) as T) : undefined;
      } catch {
        return undefined;
      }
    },

    setState<T>(state: T): void {
      try {
        localStorage.setItem(WEB_APP_STATE_STORAGE_KEY, JSON.stringify(state));
      } catch {}
    },

    copyToClipboard(text: string) {
      return navigator.clipboard.writeText(text);
    },
  };
}
