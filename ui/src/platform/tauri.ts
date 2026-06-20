// =============================================================================
// platform/tauri.ts — Tauri bridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import type { HostMessage, WebviewMessage } from '../types';

// Dynamic imports to avoid bundling @tauri-apps/api in non-Tauri builds
type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriListen = (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;

interface TauriWindow {
  __TAURI__?: {
    core?: {
      invoke: TauriInvoke;
    };
    event?: {
      listen: TauriListen;
    };
  };
}

declare global {
  interface Window extends TauriWindow {}
}

export function createTauriBridge(): PlatformBridge {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) {
    throw new Error('Tauri invoke API is not available. Are you running in Tauri?');
  }

  const STATE_KEY = 'markdown-explorer-ui-state';

  return {
    async postMessage(msg: WebviewMessage) {
      try {
        const payload = JSON.stringify(msg);
        await tauri.core!.invoke('dispatch', {
          command: msg.command,
          payload,
        });
      } catch (err) {
        console.error('Tauri postMessage failed:', err);
      }
    },

    onMessage(handler: (msg: HostMessage) => void): () => void {
      let unlisten: (() => void) | null = null;

      if (tauri.event?.listen) {
        tauri.event.listen('host-message', (event) => {
          handler(event.payload as HostMessage);
        }).then((fn) => {
          unlisten = fn;
        }).catch((err) => {
          console.error('Tauri onMessage listen failed:', err);
        });
      }

      return () => {
        if (unlisten) unlisten();
      };
    },

    getState<T>(): T | undefined {
      try {
        const val = localStorage.getItem(STATE_KEY);
        return val ? (JSON.parse(val) as T) : undefined;
      } catch (err) {
        console.error('Failed to get Tauri state from localStorage:', err);
        return undefined;
      }
    },

    setState<T>(state: T): void {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (err) {
        console.error('Failed to set Tauri state in localStorage:', err);
      }
    },

    copyToClipboard(text: string) {
      // Use the Clipboard API if available, else fall back to execCommand
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.error('Clipboard writeText failed:', err);
        });
      } else {
        // Fallback: create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('execCommand copy failed:', err);
        }
        document.body.removeChild(textarea);
      }
    },
  };
}
