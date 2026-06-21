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
      convertFileSrc?: (src: string) => string;
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

  // ── Start listening IMMEDIATELY on bridge creation ────────────────────────
  // listen() is async — it does an IPC round-trip to register the listener in
  // Rust. If we only call it inside onMessage() (which is called from a React
  // useEffect), the registration may not complete before postMessage('ready')
  // fires, causing readyAck to be emitted and dropped before the handler
  // exists. Starting here, at module-evaluation time, gives maximum lead time.
  //
  // Any events that arrive before onMessage() attaches a handler are buffered
  // and replayed synchronously when the handler is registered.
  const earlyBuffer: HostMessage[] = [];
  let messageHandler: ((msg: HostMessage) => void) | null = null;
  let unlistenFn: (() => void) | null = null;

  if (tauri.event?.listen) {
    tauri.event.listen('host-message', (event) => {
      const msg = event.payload as HostMessage;
      if (messageHandler) {
        messageHandler(msg);
      } else {
        earlyBuffer.push(msg);
      }
    }).then((fn) => {
      unlistenFn = fn;
    }).catch((err) => {
      console.error('Tauri host-message listener failed:', err);
    });
  }

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
      messageHandler = handler;

      // Flush any events that arrived before this handler was registered
      if (earlyBuffer.length > 0) {
        for (const msg of earlyBuffer) {
          handler(msg);
        }
        earlyBuffer.length = 0;
      }

      return () => {
        messageHandler = null;
        if (unlistenFn) {
          unlistenFn();
          unlistenFn = null;
        }
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
