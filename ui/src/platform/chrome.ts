// =============================================================================
// platform/chrome.ts — Chromium extension bridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import type { HostMessage, WebviewMessage } from '../types';

declare global {
  interface Window {
    __chromeExtBus?: EventTarget;
  }
}

export function createChromeBridge(): PlatformBridge {
  const bus = window.__chromeExtBus;
  if (!bus) {
    throw new Error('__chromeExtBus is not available on window. Are you sure you are running in the Chromium extension?');
  }

  const STATE_KEY = 'markdown-explorer-chrome-state';

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
      } catch (err) {
        console.error('Failed to get Chrome state from localStorage:', err);
        return undefined;
      }
    },

    setState<T>(state: T): void {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (err) {
        console.error('Failed to set Chrome state in localStorage:', err);
      }
    },

    copyToClipboard(text: string) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to write to clipboard:', err);
      });
    },
  };
}
