// =============================================================================
// platform/vscode.ts — VS Code webview bridge implementation
// =============================================================================

import type { PlatformBridge } from './bridge';
import type { HostMessage, WebviewMessage } from '../types';

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export function createVsCodeBridge(): PlatformBridge {
  const api = acquireVsCodeApi();

  return {
    postMessage(msg: WebviewMessage) {
      api.postMessage(msg);
    },

    onMessage(handler: (msg: HostMessage) => void): () => void {
      const listener = (event: MessageEvent) => {
        const data = event.data;
        // Filter out iframe resize messages and other non-host messages
        if (data && typeof data.command === 'string') {
          handler(data as HostMessage);
        }
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },

    getState<T>(): T | undefined {
      return api.getState() as T | undefined;
    },

    setState<T>(state: T): void {
      api.setState(state);
    },

    copyToClipboard(text: string) {
      api.postMessage({ command: 'copyCode', text });
    },
  };
}
