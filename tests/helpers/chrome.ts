import { vi } from 'vitest';

export function createChromeMock(overrides = {}) {
  const listeners = new Map<string, Set<(msg: any) => void>>();
  const emittedMessages: any[] = [];
  const bus = {
    addEventListener(event: string, handler: any) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeEventListener(event: string, handler: any) {
      listeners.get(event)?.delete(handler);
    },
    dispatchEvent(event: { type: string; detail?: any }) {
      const handlers = listeners.get(event.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(event.detail ?? event);
        }
      }
    },
  };

  const chrome = {
    runtime: {
      getManifest: vi.fn(() => ({ version: '1.5.5' })),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      ...overrides.runtime,
    },
    tabs: {
      create: vi.fn(({ url }: { url: string }) => Promise.resolve()),
      ...overrides.tabs,
    },
  };

  return {
    chrome,
    bus,
    emitHostMessage(msg: any) {
      bus.dispatchEvent({ type: 'host-message', detail: msg });
    },
    emitWebviewMessage(msg: any) {
      bus.dispatchEvent({ type: 'webview-message', detail: msg });
    },
    getEmittedMessages: () => emittedMessages,
    getListeners: () => listeners,
    reset() {
      listeners.clear();
      emittedMessages.length = 0;
    },
  };
}
