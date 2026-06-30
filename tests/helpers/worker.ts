import { vi } from 'vitest';

export function createWorkerMock() {
  const messages: any[] = [];
  let messageHandler: ((msg: any) => void) | null = null;
  let errorHandler: ((err: Error) => void) | null = null;
  let terminated = false;

  const worker = {
    on(event: string, handler: any) {
      if (event === 'message') messageHandler = handler;
      if (event === 'error') errorHandler = handler;
    },
    postMessage(msg: any) {
      if (terminated) throw new Error('Worker is terminated');
      messages.push(msg);
    },
    terminate() {
      terminated = true;
    },
    isTerminated: () => terminated,
  };

  return {
    worker,
    messages,
    simulateMessage(msg: any) {
      if (messageHandler) messageHandler(msg);
    },
    simulateError(error: Error) {
      if (errorHandler) errorHandler(error);
    },
    postMessageToParent(msg: any) {
      if (messageHandler) messageHandler(msg);
    },
    reset() {
      messages.length = 0;
      messageHandler = null;
      errorHandler = null;
      terminated = false;
    },
  };
}

export function createParentPortMock() {
  const messages: any[] = [];
  let messageHandler: ((msg: any) => void) | null = null;

  return {
    on(event: string, handler: (msg: any) => void) {
      if (event === 'message') messageHandler = handler;
    },
    postMessage(msg: any) {
      messages.push(msg);
    },
    messages,
    simulateMessage(msg: any) {
      if (messageHandler) messageHandler(msg);
    },
    reset() {
      messages.length = 0;
      messageHandler = null;
    },
  };
}
