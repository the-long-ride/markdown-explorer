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
  copyToClipboard(text: string): void;
}
