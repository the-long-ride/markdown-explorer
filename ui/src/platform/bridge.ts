// =============================================================================
// platform/bridge.ts — Platform-agnostic communication interface
// =============================================================================

import type { HostMessage, WebviewMessage } from '../types';

/**
 * Abstract bridge between the UI and the host process.
 * Implemented by VsCodeBridge (extension) and ElectronBridge (desktop).
 */
export interface PlatformBridge {
  /** Send a message to the host process */
  postMessage(msg: WebviewMessage): void;

  /** Register a handler for messages from the host. Returns unsubscribe fn. */
  onMessage(handler: (msg: HostMessage) => void): () => void;

  /** Get persisted UI state */
  getState<T>(): T | undefined;

  /** Persist UI state */
  setState<T>(state: T): void;

  /** Copy text to clipboard (delegated to host) */
  copyToClipboard(text: string): void | Promise<void>;
}


export interface WorkspaceTextResourceResponse {
  ok: boolean;
  content?: string;
  resolvedPath?: string;
  reason?: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported' | 'timeout';
}

/** Request a workspace-local text resource through the active host bridge. */
export function readWorkspaceTextResource(
  bridge: PlatformBridge,
  documentPath: string,
  resourcePath: string,
  timeoutMs = 5000,
): Promise<WorkspaceTextResourceResponse> {
  const requestId = `html-resource-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'workspaceTextResourceResult' || message.requestId !== requestId) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve({
        ok: message.ok,
        content: message.content,
        resolvedPath: message.resolvedPath,
        reason: message.reason,
      });
    });
    const timer = window.setTimeout(() => {
      if (settled) return;
      unsubscribe();
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    bridge.postMessage({ command: 'readWorkspaceTextResource', requestId, documentPath, resourcePath });
  });
}
