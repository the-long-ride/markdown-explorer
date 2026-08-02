import { CONTENT_ENHANCEMENT_RETRY_DELAYS_MS } from '../../constants/limits.ts';

export interface EnhancementObserver {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
}

export interface ContentEnhancementSchedulerOptions {
  body: HTMLElement;
  hasPending: () => boolean;
  run: () => Promise<void>;
  onSettled: () => void;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  createObserver: (callback: MutationCallback) => EnhancementObserver;
  setDelay: (callback: () => void, delayMs: number) => number;
  clearDelay: (handle: number) => void;
}


export interface ContentEnhancementScheduler {
  dispose(): void;
  requestRun(): void;
}

export function createContentEnhancementScheduler(
  options: ContentEnhancementSchedulerOptions,
): ContentEnhancementScheduler {
  let disposed = false;
  let running = false;
  let rerunRequested = false;
  let frameHandle: number | null = null;
  let delayHandle: number | null = null;
  let retryIndex = 0;

  const bodyIsCurrent = () => options.body.isConnected !== false;

  const clearScheduledDelay = () => {
    if (delayHandle === null) return;
    options.clearDelay(delayHandle);
    delayHandle = null;
  };

  const requestRun = () => {
    if (disposed || !bodyIsCurrent()) return;
    rerunRequested = true;
    if (running || frameHandle !== null || delayHandle !== null) return;

    frameHandle = options.requestFrame(() => {
      frameHandle = null;
      void runPass();
    });
  };

  const requestRetry = () => {
    if (disposed || retryIndex >= CONTENT_ENHANCEMENT_RETRY_DELAYS_MS.length || delayHandle !== null) return;
    const delay = CONTENT_ENHANCEMENT_RETRY_DELAYS_MS[retryIndex++];
    delayHandle = options.setDelay(() => {
      delayHandle = null;
      requestRun();
    }, delay);
  };

  const runPass = async () => {
    if (disposed || running || !bodyIsCurrent()) return;
    running = true;
    rerunRequested = false;

    try {
      await options.run();
    } finally {
      running = false;
      if (disposed || !bodyIsCurrent()) return;
      options.onSettled();

      if (rerunRequested) {
        requestRun();
        return;
      }

      if (options.hasPending()) {
        requestRetry();
      } else {
        retryIndex = 0;
      }
    }
  };

  const observer = options.createObserver(() => {
    if (disposed || !bodyIsCurrent()) return;
    retryIndex = 0;
    clearScheduledDelay();
    requestRun();
  });
  observer.observe(options.body, { childList: true, subtree: true });
  requestRun();

  return {
    requestRun,
    dispose() {
      disposed = true;
      rerunRequested = false;
      observer.disconnect();
      clearScheduledDelay();
      if (frameHandle !== null) {
        options.cancelFrame(frameHandle);
        frameHandle = null;
      }
    },
  };
}
